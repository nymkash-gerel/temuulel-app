-- 046: Customer Intelligence — Extended profile + preferences + interaction log
-- Enables personalized AI responses based on customer history and preferences

-- ── Extended customer profile fields ─────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', NULL)),
  ADD COLUMN IF NOT EXISTS age_range TEXT CHECK (age_range IN ('18-24', '25-34', '35-44', '45-54', '55+', NULL)),
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'mn',
  ADD COLUMN IF NOT EXISTS preferred_size TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── Customer preferences (interests, favorites, style) ───────────────
CREATE TABLE IF NOT EXISTS customer_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK (preference_type IN (
    'interest', 'favorite_category', 'favorite_product', 'dietary',
    'allergy', 'style', 'budget_range', 'communication'
  )),
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  confidence REAL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT DEFAULT 'inferred' CHECK (source IN ('explicit', 'inferred', 'observed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, store_id, preference_type, preference_key)
);

-- ── Customer interaction log (complaints, returns, positive feedback) ─
CREATE TABLE IF NOT EXISTS customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'complaint', 'return_request', 'exchange', 'positive_feedback',
    'inquiry', 'birthday_greeting', 'reorder', 'referral'
  )),
  related_order_id UUID REFERENCES orders(id),
  summary TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customer_preferences_lookup
  ON customer_preferences(customer_id, store_id);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_lookup
  ON customer_interactions(customer_id, store_id);

CREATE INDEX IF NOT EXISTS idx_customer_interactions_type
  ON customer_interactions(store_id, interaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_birthday
  ON customers(store_id, birthday) WHERE birthday IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage customer preferences"
  ON customer_preferences FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

CREATE POLICY "Store owners manage customer interactions"
  ON customer_interactions FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- ── Service role access ──────────────────────────────────────────────
CREATE POLICY "Service role full access on customer_preferences"
  ON customer_preferences FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on customer_interactions"
  ON customer_interactions FOR ALL
  USING (auth.role() = 'service_role');
