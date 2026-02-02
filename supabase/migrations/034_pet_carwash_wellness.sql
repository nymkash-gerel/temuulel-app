-- Phase 8: Pet Services + Car Wash + Wellness
-- Tables: pets, pet_appointments, vehicles, wash_orders, treatment_plans, treatment_sessions

-- ============================================================
-- PET SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL DEFAULT 'dog',
  breed TEXT,
  weight NUMERIC(6,2),
  date_of_birth DATE,
  medical_notes TEXT,
  vaccinations JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pets_store ON pets(store_id);
CREATE INDEX idx_pets_customer ON pets(customer_id);

ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pets_store_owner" ON pets
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS pet_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  total_amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pet_appointment_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX idx_pet_appointments_store ON pet_appointments(store_id);
CREATE INDEX idx_pet_appointments_pet ON pet_appointments(pet_id);
CREATE INDEX idx_pet_appointments_scheduled ON pet_appointments(scheduled_at);

ALTER TABLE pet_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pet_appointments_store_owner" ON pet_appointments
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- CAR WASH
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  plate_number TEXT NOT NULL,
  make TEXT,
  model TEXT,
  color TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'sedan',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_type_check CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'van', 'motorcycle', 'bus', 'other'))
);

CREATE INDEX idx_vehicles_store ON vehicles(store_id);
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_store_owner" ON vehicles
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS wash_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  bay_number INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wash_service_type_check CHECK (service_type IN ('basic', 'standard', 'premium', 'deluxe', 'interior_only', 'exterior_only')),
  CONSTRAINT wash_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_wash_orders_store ON wash_orders(store_id);
CREATE INDEX idx_wash_orders_vehicle ON wash_orders(vehicle_id);
CREATE INDEX idx_wash_orders_status ON wash_orders(status);

ALTER TABLE wash_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wash_orders_store_owner" ON wash_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- WELLNESS (Treatment Plans)
-- ============================================================

CREATE TABLE IF NOT EXISTS treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sessions_total INTEGER NOT NULL DEFAULT 1,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT treatment_plan_status_check CHECK (status IN ('active', 'completed', 'paused', 'cancelled'))
);

CREATE INDEX idx_treatment_plans_store ON treatment_plans(store_id);
CREATE INDEX idx_treatment_plans_customer ON treatment_plans(customer_id);

ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_plans_store_owner" ON treatment_plans
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS treatment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  treatment_plan_id UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  session_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  results TEXT,
  performed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT treatment_session_status_check CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled'))
);

CREATE INDEX idx_treatment_sessions_store ON treatment_sessions(store_id);
CREATE INDEX idx_treatment_sessions_plan ON treatment_sessions(treatment_plan_id);

ALTER TABLE treatment_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_sessions_store_owner" ON treatment_sessions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
