-- ============================================================================
-- Migration 029: Stay / Hospitality Vertical
-- Adds: units, guests, reservations, housekeeping_tasks,
--        maintenance_requests, damage_reports
-- ============================================================================

-- 1. Units (hotel rooms, cabins, apartments)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL,
  unit_number TEXT NOT NULL,
  unit_type TEXT DEFAULT 'standard' CHECK (unit_type IN ('standard', 'deluxe', 'suite', 'penthouse', 'dormitory', 'cabin', 'apartment')),
  floor TEXT,
  max_occupancy INTEGER DEFAULT 2,
  base_rate NUMERIC(12,2) NOT NULL,
  amenities JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_units_store ON units(store_id);
CREATE INDEX idx_units_resource ON units(resource_id);
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_store_access" ON units
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Guests (guest profiles)
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  document_type TEXT CHECK (document_type IN ('passport', 'national_id', 'driving_license')),
  document_number TEXT,
  nationality TEXT,
  phone TEXT,
  email TEXT,
  vip_level TEXT DEFAULT 'regular' CHECK (vip_level IN ('regular', 'silver', 'gold', 'platinum')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_guests_store ON guests(store_id);
CREATE INDEX idx_guests_customer ON guests(customer_id);
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests_store_access" ON guests
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Reservations (bookings for units)
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  rate_per_night NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  deposit_amount NUMERIC(12,2) DEFAULT 0,
  deposit_status TEXT DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'paid', 'refunded')),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
  source TEXT DEFAULT 'direct' CHECK (source IN ('direct', 'website', 'booking_com', 'airbnb', 'expedia', 'other')),
  special_requests TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reservations_store ON reservations(store_id);
CREATE INDEX idx_reservations_unit ON reservations(unit_id);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_store_access" ON reservations
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Housekeeping Tasks (cleaning and maintenance tasks)
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  task_type TEXT DEFAULT 'cleaning' CHECK (task_type IN ('cleaning', 'deep_cleaning', 'turnover', 'inspection', 'restocking')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_housekeeping_tasks_store ON housekeeping_tasks(store_id);
CREATE INDEX idx_housekeeping_tasks_unit ON housekeeping_tasks(unit_id);
CREATE INDEX idx_housekeeping_tasks_assigned ON housekeeping_tasks(assigned_to);
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "housekeeping_tasks_store_access" ON housekeeping_tasks
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER housekeeping_tasks_updated_at
  BEFORE UPDATE ON housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Maintenance Requests (repair and maintenance)
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'general')),
  description TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'in_progress', 'completed', 'cancelled')),
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_maintenance_requests_store ON maintenance_requests(store_id);
CREATE INDEX idx_maintenance_requests_unit ON maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_requests_assigned ON maintenance_requests(assigned_to);
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_requests_store_access" ON maintenance_requests
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Damage Reports (damage tracking)
CREATE TABLE damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  damage_type TEXT DEFAULT 'minor' CHECK (damage_type IN ('minor', 'moderate', 'major')),
  estimated_cost NUMERIC(12,2),
  charged_amount NUMERIC(12,2) DEFAULT 0,
  photos JSONB DEFAULT '[]',
  status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'assessed', 'charged', 'resolved', 'waived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_damage_reports_store ON damage_reports(store_id);
CREATE INDEX idx_damage_reports_reservation ON damage_reports(reservation_id);
CREATE INDEX idx_damage_reports_unit ON damage_reports(unit_id);
CREATE INDEX idx_damage_reports_guest ON damage_reports(guest_id);
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "damage_reports_store_access" ON damage_reports
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER damage_reports_updated_at
  BEFORE UPDATE ON damage_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_tasks;
