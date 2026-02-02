-- Phase 11: Sports/Gym + Repair Shop + Consulting
-- Tables: fitness_classes, class_bookings, equipment, repair_orders, repair_parts, consultations

-- ============================================================
-- SPORTS / GYM / FITNESS
-- ============================================================

CREATE TABLE IF NOT EXISTS fitness_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  class_type TEXT NOT NULL DEFAULT 'group',
  capacity INTEGER NOT NULL DEFAULT 20,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  schedule JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fitness_class_type_check CHECK (class_type IN ('group', 'personal', 'online', 'workshop', 'camp', 'other'))
);

CREATE INDEX idx_fitness_classes_store ON fitness_classes(store_id);
CREATE INDEX idx_fitness_classes_instructor ON fitness_classes(instructor_id);

ALTER TABLE fitness_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fitness_classes_store_owner" ON fitness_classes
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES fitness_classes(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT class_booking_status_check CHECK (status IN ('booked', 'attended', 'cancelled', 'no_show'))
);

CREATE INDEX idx_class_bookings_store ON class_bookings(store_id);
CREATE INDEX idx_class_bookings_class ON class_bookings(class_id);
CREATE INDEX idx_class_bookings_customer ON class_bookings(customer_id);
CREATE INDEX idx_class_bookings_date ON class_bookings(booking_date);

ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_bookings_store_owner" ON class_bookings
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment_type TEXT NOT NULL DEFAULT 'general',
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  location TEXT,
  purchase_date DATE,
  last_maintenance DATE,
  next_maintenance DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_type_check CHECK (equipment_type IN ('cardio', 'strength', 'flexibility', 'functional', 'recovery', 'general', 'other')),
  CONSTRAINT equipment_status_check CHECK (status IN ('available', 'in_use', 'maintenance', 'retired'))
);

CREATE INDEX idx_equipment_store ON equipment(store_id);
CREATE INDEX idx_equipment_status ON equipment(status);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_store_owner" ON equipment
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- REPAIR SHOP
-- ============================================================

CREATE TABLE IF NOT EXISTS repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES staff(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'phone',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  issue_description TEXT NOT NULL,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  priority TEXT NOT NULL DEFAULT 'medium',
  estimated_cost NUMERIC(12,2),
  actual_cost NUMERIC(12,2),
  deposit_amount NUMERIC(12,2),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  warranty_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT repair_device_type_check CHECK (device_type IN ('phone', 'tablet', 'laptop', 'desktop', 'tv', 'appliance', 'vehicle', 'jewelry', 'watch', 'other')),
  CONSTRAINT repair_status_check CHECK (status IN ('received', 'diagnosing', 'waiting_parts', 'in_repair', 'testing', 'completed', 'delivered', 'cancelled')),
  CONSTRAINT repair_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_repair_orders_store ON repair_orders(store_id);
CREATE INDEX idx_repair_orders_customer ON repair_orders(customer_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_number ON repair_orders(order_number);

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_orders_store_owner" ON repair_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================

CREATE TABLE IF NOT EXISTS repair_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  repair_order_id UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  part_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_parts_store ON repair_parts(store_id);
CREATE INDEX idx_repair_parts_order ON repair_parts(repair_order_id);

ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repair_parts_store_owner" ON repair_parts
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- CONSULTING / PROFESSIONAL SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  consultation_type TEXT NOT NULL DEFAULT 'general',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled',
  fee NUMERIC(12,2),
  location TEXT,
  meeting_url TEXT,
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT consultation_type_check CHECK (consultation_type IN ('general', 'initial', 'follow_up', 'review', 'strategy', 'technical', 'financial', 'other')),
  CONSTRAINT consultation_status_check CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'))
);

CREATE INDEX idx_consultations_store ON consultations(store_id);
CREATE INDEX idx_consultations_customer ON consultations(customer_id);
CREATE INDEX idx_consultations_scheduled ON consultations(scheduled_at);
CREATE INDEX idx_consultations_status ON consultations(status);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations_store_owner" ON consultations
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
