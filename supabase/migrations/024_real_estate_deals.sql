-- Migration 024: Real Estate Deals & Agent Commissions
-- Adds deal pipeline tracking and agent commission management for real_estate business type.

-- ============================================================
-- Table: deals
-- Tracks property transactions through a pipeline:
-- lead → viewing → offer → contract → closed
-- ============================================================

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  deal_number TEXT UNIQUE NOT NULL,
  property_id UUID REFERENCES products(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','viewing','offer','contract','closed','withdrawn','lost')),
  deal_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (deal_type IN ('sale','rent','lease')),
  asking_price NUMERIC(14,2),
  offer_price NUMERIC(14,2),
  final_price NUMERIC(14,2),
  commission_rate NUMERIC(5,2) DEFAULT 5.00,
  commission_amount NUMERIC(14,2),
  agent_share_rate NUMERIC(5,2) DEFAULT 50.00,
  agent_share_amount NUMERIC(14,2),
  company_share_amount NUMERIC(14,2),
  viewing_date TIMESTAMPTZ,
  offer_date TIMESTAMPTZ,
  contract_date TIMESTAMPTZ,
  closed_date TIMESTAMPTZ,
  withdrawn_date TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: agent_commissions
-- Tracks commission payouts to agents per closed deal.
-- Follows the same pattern as driver_payouts.
-- ============================================================

CREATE TABLE agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  agent_share NUMERIC(14,2) NOT NULL DEFAULT 0,
  company_share NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_deals_store_id ON deals(store_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_agent_id ON deals(agent_id);
CREATE INDEX idx_deals_customer_id ON deals(customer_id);
CREATE INDEX idx_deals_property_id ON deals(property_id);
CREATE INDEX idx_deals_created_at ON deals(created_at);
CREATE INDEX idx_deals_store_status ON deals(store_id, status);

CREATE INDEX idx_agent_commissions_deal_id ON agent_commissions(deal_id);
CREATE INDEX idx_agent_commissions_agent_id ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_store_id ON agent_commissions(store_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);

-- ============================================================
-- Triggers (auto-update updated_at)
-- ============================================================

CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_agent_commissions_updated_at
  BEFORE UPDATE ON agent_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commissions ENABLE ROW LEVEL SECURITY;

-- Store owners can manage their own deals
CREATE POLICY "deals_store_owner" ON deals
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  ) WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Store owners can manage commissions for their store
CREATE POLICY "agent_commissions_store_owner" ON agent_commissions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  ) WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- ============================================================
-- Realtime publication
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deals;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- Grants for authenticated users (PostgREST access)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON deals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_commissions TO authenticated;
