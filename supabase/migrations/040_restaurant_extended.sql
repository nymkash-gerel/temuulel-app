-- ============================================================================
-- Migration 040: Restaurant Extended (Table Sessions, Events, Catering, Production, KDS Tickets)
-- ============================================================================

-- 1. Table Sessions (active seating tracking)
CREATE TABLE table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES table_layouts(id) ON DELETE CASCADE,
  server_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  guest_count INT NOT NULL DEFAULT 1,
  seated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_table_sessions_store ON table_sessions(store_id);
CREATE INDEX idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX idx_table_sessions_status ON table_sessions(store_id, status);
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_sessions_store_access" ON table_sessions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER table_sessions_updated_at
  BEFORE UPDATE ON table_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. KDS Tickets (kitchen display tickets)
CREATE TABLE kds_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  station_id UUID REFERENCES kds_stations(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]',
  priority INT DEFAULT 0,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'ready', 'served', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kds_tickets_store ON kds_tickets(store_id);
CREATE INDEX idx_kds_tickets_station ON kds_tickets(station_id);
CREATE INDEX idx_kds_tickets_status ON kds_tickets(store_id, status);
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kds_tickets_store_access" ON kds_tickets
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER kds_tickets_updated_at
  BEFORE UPDATE ON kds_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Event Bookings
CREATE TABLE event_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  event_type TEXT DEFAULT 'other' CHECK (event_type IN ('wedding', 'corporate', 'birthday', 'conference', 'other')),
  event_date DATE NOT NULL,
  event_start_time TIME,
  event_end_time TIME,
  guest_count INT NOT NULL DEFAULT 1,
  venue_resource_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'quoted', 'deposit_paid', 'confirmed', 'in_service', 'closed', 'cancelled')),
  budget_estimate NUMERIC,
  quoted_amount NUMERIC,
  final_amount NUMERIC,
  special_requirements TEXT,
  menu_selection JSONB DEFAULT '{}',
  setup_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_bookings_store ON event_bookings(store_id);
CREATE INDEX idx_event_bookings_date ON event_bookings(store_id, event_date);
CREATE INDEX idx_event_bookings_status ON event_bookings(store_id, status);
ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_bookings_store_access" ON event_bookings
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER event_bookings_updated_at
  BEFORE UPDATE ON event_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Event Timeline (milestones for events)
CREATE TABLE event_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_booking_id UUID NOT NULL REFERENCES event_bookings(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('deposit_due', 'menu_selection', 'final_payment', 'setup', 'event_start', 'teardown')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_event_timeline_event ON event_timeline(event_booking_id);
ALTER TABLE event_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_timeline_store_access" ON event_timeline
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- 5. Catering Orders
CREATE TABLE catering_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  serving_date DATE NOT NULL,
  serving_time TIME NOT NULL,
  location_type TEXT DEFAULT 'customer_location' CHECK (location_type IN ('on_site', 'customer_location')),
  address_text TEXT,
  guest_count INT NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'confirmed', 'preparing', 'dispatched', 'served', 'closed', 'cancelled')),
  quoted_amount NUMERIC,
  final_amount NUMERIC,
  logistics_notes TEXT,
  equipment_needed JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_catering_orders_store ON catering_orders(store_id);
CREATE INDEX idx_catering_orders_date ON catering_orders(store_id, serving_date);
CREATE INDEX idx_catering_orders_status ON catering_orders(store_id, status);
ALTER TABLE catering_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catering_orders_store_access" ON catering_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER catering_orders_updated_at
  BEFORE UPDATE ON catering_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Production Batches (meal prep)
CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  production_date DATE NOT NULL,
  target_qty INT NOT NULL,
  produced_qty INT DEFAULT 0,
  cost_per_unit NUMERIC,
  expiry_date DATE,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_production_batches_store ON production_batches(store_id);
CREATE INDEX idx_production_batches_date ON production_batches(store_id, production_date);
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_batches_store_access" ON production_batches
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER production_batches_updated_at
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE kds_tickets;
