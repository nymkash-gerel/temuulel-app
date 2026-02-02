-- 021: Driver Payouts Table + Realtime for delivery_drivers

-- Driver payouts table for tracking payment periods
CREATE TABLE IF NOT EXISTS driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver_id ON driver_payouts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_store_id ON driver_payouts(store_id);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_status ON driver_payouts(status);

-- RLS
ALTER TABLE driver_payouts ENABLE ROW LEVEL SECURITY;

-- Store owner: full access to their store's payouts
CREATE POLICY "Store owners can manage payouts"
  ON driver_payouts
  FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Driver: read-only access to their own payouts
CREATE POLICY "Drivers can view own payouts"
  ON driver_payouts
  FOR SELECT
  USING (
    driver_id IN (SELECT id FROM delivery_drivers WHERE user_id = auth.uid())
  );

-- Enable Realtime for delivery_drivers (for live map tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_drivers;
