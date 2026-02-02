-- Migration 019: Delivery Management System
-- Tracks delivery drivers, deliveries, and delivery status audit trail

-- ============================================================
-- 1. DELIVERY DRIVERS TABLE
-- ============================================================

CREATE TABLE delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('motorcycle', 'car', 'bicycle', 'on_foot')),
  vehicle_number TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_delivery')),
  current_location JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, phone)
);

-- ============================================================
-- 2. DELIVERIES TABLE
-- ============================================================

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,

  delivery_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'delayed'
  )),
  delivery_type TEXT NOT NULL DEFAULT 'own_driver' CHECK (delivery_type IN ('own_driver', 'external_provider')),

  provider_name TEXT,
  provider_tracking_id TEXT,

  pickup_address TEXT,
  delivery_address TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,

  estimated_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  delivery_fee NUMERIC(12,2) DEFAULT 0,

  notes TEXT,
  failure_reason TEXT,
  proof_photo_url TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. DELIVERY STATUS LOG (audit trail)
-- ============================================================

CREATE TABLE delivery_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX idx_delivery_drivers_store_id ON delivery_drivers(store_id);
CREATE INDEX idx_delivery_drivers_user_id ON delivery_drivers(user_id);
CREATE INDEX idx_delivery_drivers_status ON delivery_drivers(status);
CREATE INDEX idx_delivery_drivers_store_status ON delivery_drivers(store_id, status);

CREATE INDEX idx_deliveries_store_id ON deliveries(store_id);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_delivery_number ON deliveries(delivery_number);
CREATE INDEX idx_deliveries_store_status ON deliveries(store_id, status);
CREATE INDEX idx_deliveries_created_at ON deliveries(created_at);

CREATE INDEX idx_delivery_status_log_delivery_id ON delivery_status_log(delivery_id);
CREATE INDEX idx_delivery_status_log_created_at ON delivery_status_log(created_at);

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

CREATE TRIGGER set_delivery_drivers_updated_at
  BEFORE UPDATE ON delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_drivers_store_access" ON delivery_drivers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = delivery_drivers.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

CREATE POLICY "deliveries_store_access" ON deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = deliveries.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

CREATE POLICY "delivery_status_log_access" ON delivery_status_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM deliveries
      JOIN stores ON stores.id = deliveries.store_id
      WHERE deliveries.id = delivery_status_log.delivery_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ============================================================
-- 7. REALTIME
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- 8. SERVICE ROLE GRANTS
-- ============================================================

GRANT ALL ON delivery_drivers TO service_role;
GRANT ALL ON deliveries TO service_role;
GRANT ALL ON delivery_status_log TO service_role;

-- ============================================================
-- 9. COMMENTS
-- ============================================================

COMMENT ON TABLE delivery_drivers IS 'Delivery drivers managed by store owners (own fleet or linked accounts)';
COMMENT ON TABLE deliveries IS 'Delivery records linked to orders with status tracking';
COMMENT ON TABLE delivery_status_log IS 'Audit trail for delivery status changes';

-- Migration registration handled by Supabase CLI
