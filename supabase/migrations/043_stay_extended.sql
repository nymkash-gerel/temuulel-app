-- ============================================================================
-- Migration 043: Stay / Hospitality Extended
-- Adds: rate_plans, leases
-- ============================================================================

-- 1. Rate Plans (pricing models for units)
CREATE TABLE rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  unit_type TEXT,
  name TEXT NOT NULL,
  pricing_model TEXT DEFAULT 'per_night' CHECK (pricing_model IN ('per_night', 'per_person', 'flat')),
  base_price NUMERIC(12,2) NOT NULL,
  weekend_price NUMERIC(12,2),
  seasonal_adjustments JSONB DEFAULT '[]',
  min_stay INTEGER DEFAULT 1,
  max_stay INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rate_plans_store ON rate_plans(store_id);
CREATE INDEX idx_rate_plans_active ON rate_plans(store_id, is_active);
ALTER TABLE rate_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_plans_store_access" ON rate_plans
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER rate_plans_updated_at
  BEFORE UPDATE ON rate_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Leases (long-term unit rentals)
CREATE TABLE leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_phone TEXT,
  tenant_email TEXT,
  lease_start DATE NOT NULL,
  lease_end DATE,
  monthly_rent NUMERIC(12,2) NOT NULL,
  deposit_amount NUMERIC(12,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leases_store ON leases(store_id);
CREATE INDEX idx_leases_unit ON leases(unit_id);
CREATE INDEX idx_leases_status ON leases(store_id, status);
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_store_access" ON leases
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER leases_updated_at
  BEFORE UPDATE ON leases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
