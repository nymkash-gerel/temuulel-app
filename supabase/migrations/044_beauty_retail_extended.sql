-- ============================================================================
-- Migration 044: Beauty / Retail Extended
-- Adds: loyalty_transactions, package_purchases, gift_cards
-- ============================================================================

-- 1. Loyalty Transactions (points earn/redeem tracking)
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjust', 'expire')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_loyalty_transactions_store ON loyalty_transactions(store_id);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(store_id, customer_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(store_id, transaction_type);
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_transactions_store_access" ON loyalty_transactions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- 2. Package Purchases (tracking service package usage)
CREATE TABLE package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  package_id UUID REFERENCES service_packages(id) ON DELETE SET NULL,
  purchase_date DATE DEFAULT CURRENT_DATE,
  sessions_total INTEGER NOT NULL,
  sessions_used INTEGER DEFAULT 0,
  expires_at DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed', 'cancelled')),
  amount_paid NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_package_purchases_store ON package_purchases(store_id);
CREATE INDEX idx_package_purchases_customer ON package_purchases(store_id, customer_id);
CREATE INDEX idx_package_purchases_status ON package_purchases(store_id, status);
ALTER TABLE package_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_purchases_store_access" ON package_purchases
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER package_purchases_updated_at
  BEFORE UPDATE ON package_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Gift Cards
CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  initial_balance NUMERIC(12,2) NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'disabled')),
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gift_cards_store ON gift_cards(store_id);
CREATE INDEX idx_gift_cards_code ON gift_cards(code);
CREATE INDEX idx_gift_cards_customer ON gift_cards(store_id, customer_id);
CREATE INDEX idx_gift_cards_status ON gift_cards(store_id, status);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_cards_store_access" ON gift_cards
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER gift_cards_updated_at
  BEFORE UPDATE ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
