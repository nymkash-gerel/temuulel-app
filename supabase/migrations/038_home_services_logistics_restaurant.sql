-- Phase 12: Home Services + Logistics/Fleet + Restaurant Extensions
-- Tables: service_requests, service_areas, fleet_vehicles, trip_logs, table_layouts, table_reservations

-- ============================================================
-- HOME SERVICES (cleaning, plumbing, electrical, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  request_number TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'general',
  address TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_estimate INTEGER, -- in minutes
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_request_type_check CHECK (service_type IN ('cleaning', 'plumbing', 'electrical', 'painting', 'carpentry', 'hvac', 'landscaping', 'moving', 'pest_control', 'general', 'other')),
  CONSTRAINT service_request_status_check CHECK (status IN ('pending', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT service_request_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_service_requests_store ON service_requests(store_id);
CREATE INDEX idx_service_requests_customer ON service_requests(customer_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_scheduled ON service_requests(scheduled_at);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_requests_store_owner" ON service_requests
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  zip_codes TEXT[], -- array of zip/postal codes
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_areas_store ON service_areas(store_id);

ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_areas_store_owner" ON service_areas
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- LOGISTICS / FLEET MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  plate_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'car',
  brand TEXT,
  model TEXT,
  year INTEGER,
  status TEXT NOT NULL DEFAULT 'available',
  insurance_expiry DATE,
  registration_expiry DATE,
  mileage NUMERIC(12,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fleet_vehicle_type_check CHECK (vehicle_type IN ('car', 'van', 'truck', 'motorcycle', 'bicycle', 'other')),
  CONSTRAINT fleet_vehicle_status_check CHECK (status IN ('available', 'in_use', 'maintenance', 'retired'))
);

CREATE INDEX idx_fleet_vehicles_store ON fleet_vehicles(store_id);
CREATE INDEX idx_fleet_vehicles_status ON fleet_vehicles(status);
CREATE INDEX idx_fleet_vehicles_driver ON fleet_vehicles(driver_id);

ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fleet_vehicles_store_owner" ON fleet_vehicles
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS trip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  start_location TEXT,
  end_location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  distance_km NUMERIC(10,2),
  fuel_cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trip_log_status_check CHECK (status IN ('in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_trip_logs_store ON trip_logs(store_id);
CREATE INDEX idx_trip_logs_vehicle ON trip_logs(vehicle_id);
CREATE INDEX idx_trip_logs_driver ON trip_logs(driver_id);
CREATE INDEX idx_trip_logs_start_time ON trip_logs(start_time);

ALTER TABLE trip_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_logs_store_owner" ON trip_logs
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- RESTAURANT EXTENSIONS (table management)
-- ============================================================

CREATE TABLE IF NOT EXISTS table_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  shape TEXT NOT NULL DEFAULT 'rectangle',
  position_x NUMERIC(6,1) DEFAULT 0,
  position_y NUMERIC(6,1) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT table_shape_check CHECK (shape IN ('rectangle', 'circle', 'square', 'oval')),
  CONSTRAINT table_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning', 'out_of_service'))
);

CREATE INDEX idx_table_layouts_store ON table_layouts(store_id);
CREATE INDEX idx_table_layouts_status ON table_layouts(status);

ALTER TABLE table_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_layouts_store_owner" ON table_layouts
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES table_layouts(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  reservation_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT table_reservation_status_check CHECK (status IN ('confirmed', 'seated', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX idx_table_reservations_store ON table_reservations(store_id);
CREATE INDEX idx_table_reservations_table ON table_reservations(table_id);
CREATE INDEX idx_table_reservations_time ON table_reservations(reservation_time);
CREATE INDEX idx_table_reservations_status ON table_reservations(status);

ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_reservations_store_owner" ON table_reservations
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
