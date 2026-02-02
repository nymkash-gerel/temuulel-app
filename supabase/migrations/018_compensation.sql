-- Migration 018: AI Complaint Resolution & Compensation System
-- compensation_policies: store-level rules for auto-offering discounts on complaints
-- vouchers: actual issued vouchers/credits for customers

-- Add metadata JSONB to customers for structured customer-level data
ALTER TABLE customers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ==========================================================================
-- compensation_policies
-- ==========================================================================
CREATE TABLE compensation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  complaint_category TEXT NOT NULL CHECK (complaint_category IN (
    'food_quality', 'wrong_item', 'delivery_delay', 'service_quality',
    'damaged_item', 'pricing_error', 'staff_behavior', 'other'
  )),
  name TEXT NOT NULL,
  compensation_type TEXT NOT NULL CHECK (compensation_type IN (
    'percent_discount', 'fixed_discount', 'free_shipping', 'free_item'
  )),
  compensation_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC(12,2),
  valid_days INTEGER NOT NULL DEFAULT 30,
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  requires_confirmation BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, complaint_category)
);

-- Indexes
CREATE INDEX idx_compensation_policies_store ON compensation_policies(store_id);
CREATE INDEX idx_compensation_policies_category ON compensation_policies(store_id, complaint_category) WHERE is_active = true;

-- Trigger
CREATE TRIGGER set_compensation_policies_updated_at
  BEFORE UPDATE ON compensation_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE compensation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their compensation policies"
  ON compensation_policies
  FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "Store members can view compensation policies"
  ON compensation_policies
  FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ==========================================================================
-- vouchers
-- ==========================================================================
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES compensation_policies(id) ON DELETE SET NULL,
  voucher_code TEXT NOT NULL UNIQUE,
  compensation_type TEXT NOT NULL CHECK (compensation_type IN (
    'percent_discount', 'fixed_discount', 'free_shipping', 'free_item'
  )),
  compensation_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC(12,2),
  complaint_category TEXT,
  complaint_summary TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'pending_approval', 'approved', 'rejected', 'redeemed', 'expired'
  )),
  approved_by TEXT,
  approved_by_user_id UUID,
  redeemed_at TIMESTAMPTZ,
  redeemed_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vouchers_store ON vouchers(store_id);
CREATE INDEX idx_vouchers_customer ON vouchers(customer_id);
CREATE INDEX idx_vouchers_status ON vouchers(store_id, status);
CREATE INDEX idx_vouchers_active ON vouchers(customer_id, store_id, status, valid_until)
  WHERE status = 'approved';
CREATE INDEX idx_vouchers_code ON vouchers(voucher_code);

-- Trigger
CREATE TRIGGER set_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage their vouchers"
  ON vouchers
  FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "Store members can view vouchers"
  ON vouchers
  FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- Grant service role access
GRANT ALL ON compensation_policies TO service_role;
GRANT ALL ON vouchers TO service_role;
