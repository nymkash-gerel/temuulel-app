-- Give store_subscriptions the columns the Stripe webhook actually needs.
--
-- /api/stripe/webhook wrote to `subscriptions`, but that is the subscription-BOX
-- vertical table from 036_legal_construction_subscription.sql — per-customer
-- recurring boxes, with customer_id / plan_name / amount all NOT NULL and no
-- default. None of stripe_customer_id, stripe_subscription_id, plan or
-- current_period_end exist on it. Every checkout.session.completed would have
-- failed with a 42703 undefined_column and returned 500, so Stripe would retry
-- for three days and the paying store would never be provisioned. Nothing caught
-- it at compile time because the route cast the client to a hand-written
-- loosely-typed shape.
--
-- A store's own SaaS plan lives in store_subscriptions (001_initial_schema.sql).
-- That is the table every entitlement read in the app joins to subscription_plans
-- (dashboard/layout, dashboard/page, dashboard/products, api/team/invite,
-- dashboard/analytics, dashboard/settings/billing), so it is where a Stripe
-- payment has to land for the plan to take effect.
--
-- QPay is the live billing path today, so no production row carries Stripe state
-- yet and there is nothing to backfill.

-- 1. Stripe identifiers, plus an updated_at the webhook can stamp.
--    store_subscriptions has only created_at; every other billing-ish table in
--    this schema carries updated_at.
ALTER TABLE store_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. One SaaS subscription per store.
--
--    Four call sites already assume this and would throw on a second row:
--    dashboard/layout.tsx:57, dashboard/page.tsx:83, dashboard/products/page.tsx:31
--    and api/team/invite/route.ts:53 all do .eq('store_id', …).single().
--
--    It also has to exist before the webhook can upsert: PostgREST turns
--    .upsert({store_id}, {onConflict:'store_id'}) into ON CONFLICT (store_id),
--    which requires a unique index. Without one the upsert degrades to a plain
--    INSERT and the second Stripe event for a store appends a duplicate row —
--    breaking exactly those four screens.
--
--    Collapse any pre-existing duplicates first (newest period wins). This is
--    plan state, not history: signup inserts one row per store and the billing
--    page updates it in place, so a second row is already a bug.
DO $$
DECLARE removed INTEGER;
BEGIN
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY store_id
             ORDER BY current_period_end DESC NULLS LAST,
                      created_at         DESC NULLS LAST,
                      id
           ) AS rn
      FROM store_subscriptions
  )
  DELETE FROM store_subscriptions s
   USING ranked r
   WHERE s.id = r.id
     AND r.rn > 1;

  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed > 0 THEN
    RAISE NOTICE '079: removed % duplicate store_subscriptions row(s) before adding UNIQUE(store_id)', removed;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_subscriptions_store_id
  ON store_subscriptions (store_id);

-- 3. Stripe subscription ids are globally unique, and the
--    customer.subscription.updated / .deleted handler matches rows on this
--    column — so it needs to hit at most one row, and needs an index to do it.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_subscriptions_stripe_subscription_id
  ON store_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- 4. Widen the status CHECK to Stripe's vocabulary.
--
--    The 001 constraint allowed only active/cancelled/expired, so a real
--    subscription lifecycle — trialing → active → past_due → unpaid — would have
--    been rejected by the CHECK even once the columns existed.
--
--    Stripe spells it 'canceled'; this app has always stored 'cancelled', and the
--    route normalises to that. The US spelling is deliberately NOT accepted, so
--    there is exactly one spelling in the column.
--
--    'expired' is not a Stripe status; it is kept because the pre-Stripe QPay
--    path and existing rows use it.
ALTER TABLE store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_status_check;

ALTER TABLE store_subscriptions
  ADD CONSTRAINT store_subscriptions_status_check
  CHECK (status IN (
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
    'cancelled',
    'expired'
  ));

-- 5. Keep updated_at honest on every write, using the same trigger function as
--    users / stores / products / orders (001_initial_schema.sql:11).
DROP TRIGGER IF EXISTS store_subscriptions_updated_at ON store_subscriptions;
CREATE TRIGGER store_subscriptions_updated_at
  BEFORE UPDATE ON store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Support looking a store up from a Stripe customer id (dunning, support).
CREATE INDEX IF NOT EXISTS idx_store_subscriptions_stripe_customer_id
  ON store_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
