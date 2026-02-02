-- ============================================================================
-- Migration 031: Laundry / Dry Cleaning Vertical
-- Adds: laundry_orders, laundry_items, machines, rack_locations
-- ============================================================================

-- 1. Laundry Orders (customer drop-offs)
CREATE TABLE laundry_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processing', 'washing', 'drying', 'ironing', 'ready', 'delivered', 'cancelled')),
  total_items INTEGER DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  rush_order BOOLEAN DEFAULT false,
  pickup_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_laundry_orders_store ON laundry_orders(store_id);
ALTER TABLE laundry_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laundry_orders_store_access" ON laundry_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER laundry_orders_updated_at
  BEFORE UPDATE ON laundry_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Laundry Items (individual items in an order)
CREATE TABLE laundry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES laundry_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  service_type TEXT DEFAULT 'wash_fold' CHECK (service_type IN ('wash_fold', 'dry_clean', 'press_only', 'stain_removal', 'alterations')),
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_laundry_items_order ON laundry_items(order_id);
ALTER TABLE laundry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "laundry_items_store_access" ON laundry_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM laundry_orders WHERE store_id IN (
        SELECT id FROM stores WHERE owner_id = auth.uid()
      )
      OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    )
  );

-- 3. Machines (washers / dryers)
CREATE TABLE machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  machine_type TEXT DEFAULT 'washer' CHECK (machine_type IN ('washer', 'dryer', 'iron_press', 'steam')),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_order')),
  capacity_kg NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_machines_store ON machines(store_id);
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_store_access" ON machines
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER machines_updated_at
  BEFORE UPDATE ON machines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Rack Locations (storage for ready items)
CREATE TABLE rack_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rack_number TEXT NOT NULL,
  order_id UUID REFERENCES laundry_orders(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'empty' CHECK (status IN ('empty', 'occupied')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rack_locations_store ON rack_locations(store_id);
ALTER TABLE rack_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rack_locations_store_access" ON rack_locations
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER rack_locations_updated_at
  BEFORE UPDATE ON rack_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable realtime for laundry_orders
ALTER PUBLICATION supabase_realtime ADD TABLE laundry_orders;
