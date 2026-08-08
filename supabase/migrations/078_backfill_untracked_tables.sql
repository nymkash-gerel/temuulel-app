-- Backfill five tables that live code queries but no migration ever created.
--
-- Same historical gap as product_faqs (052) and reviews (077): the table was
-- made by hand against the cloud project and never captured in version
-- control. A fresh environment provisioned purely from migrations would be
-- missing all five, and these endpoints would 500:
--
--   ab_tests, ab_test_events  →  /api/ab-tests, src/lib/ab-test.ts
--   referrals                 →  /api/referrals
--   user_2fa                  →  /api/2fa/setup, /api/2fa/disable, /api/2fa/verify
--   user_sessions             →  /api/sessions
--
-- Definitions are transcribed from the live database (pg_dump --schema-only),
-- not reconstructed from the routes, so they match what production already has.
-- Every statement is IF NOT EXISTS / idempotent, making this a safe no-op
-- against an environment where the tables already exist.
--
-- NOTE: `referrals` is NOT `affiliate_referrals` (067). They are separate
-- features — 067 tracks affiliate partner commissions, this one tracks
-- store-to-store referral codes and free-month rewards.

-- ---------------------------------------------------------------------------
-- A/B testing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  winner TEXT CHECK (winner IN ('a', 'b', 'tie')),
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ab_test_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('a', 'b')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'conversion')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_events_test ON ab_test_events(test_id, variant, event_type);

-- ---------------------------------------------------------------------------
-- Store-to-store referrals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  referee_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'rewarded', 'expired')),
  reward_granted_at TIMESTAMPTZ,
  reward_months INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_store_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Two-factor auth + session listing (per-user, keyed on auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_2fa (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[] DEFAULT '{}'::TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id, last_active_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — transcribed from the live database
--
-- The 2FA secret and session rows are per-user and never cross-user readable.
-- The A/B and referral tables are scoped through store_members, matching how
-- the rest of the schema grants store-team access.
-- ---------------------------------------------------------------------------

ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Store members manage AB tests" ON ab_tests
    FOR ALL USING (
      store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Store members view AB events" ON ab_test_events
    FOR SELECT USING (
      test_id IN (
        SELECT id FROM ab_tests
        WHERE store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Referrers can view their referrals" ON referrals
    FOR SELECT USING (
      referrer_store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage own 2FA" ON user_2fa
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users view own sessions" ON user_sessions
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE ab_tests IS 'A/B tests per store. Backfilled in 078 — created by hand on cloud, never in a migration.';
COMMENT ON TABLE referrals IS 'Store-to-store referral codes. Distinct from affiliate_referrals (067).';
COMMENT ON TABLE user_2fa IS 'TOTP secret + backup codes per user. Writes go through /api/2fa/* with the service-role client.';
COMMENT ON TABLE user_sessions IS 'Active session listing for /api/sessions. No public INSERT policy — rows are written server-side.';
