-- Migration 013: Business Types with Services and Appointments
-- Adds support for different business types (Beauty Salon, E-commerce, etc.)

-- ============================================================
-- 0. ENSURE HELPER FUNCTION EXISTS
-- ============================================================

-- Auto-update updated_at timestamp (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. UPDATE STORES TABLE - Add business type constraint
-- ============================================================

-- Add default value for existing stores
UPDATE stores SET business_type = 'ecommerce' WHERE business_type IS NULL;

-- Note: Not adding CHECK constraint to allow flexibility for future business types

-- ============================================================
-- 2. SERVICES TABLE (for Beauty Salon, Spa, etc.)
-- ============================================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  duration_minutes INTEGER DEFAULT 60,
  base_price NUMERIC(12,2) DEFAULT 0,
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  ai_context TEXT,
  facebook_post_id TEXT,
  instagram_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. SERVICE VARIATIONS (pricing tiers, add-ons)
-- ============================================================

CREATE TABLE service_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  duration_minutes INTEGER,
  is_addon BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. STAFF MEMBERS (for appointment assignments)
-- ============================================================

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  specialties TEXT[],
  working_hours JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. APPOINTMENTS TABLE
-- ============================================================

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES service_variations(id) ON DELETE SET NULL,

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Awaiting confirmation
    'confirmed',    -- Confirmed by staff
    'in_progress',  -- Currently happening
    'completed',    -- Successfully completed
    'cancelled',    -- Cancelled by customer or staff
    'no_show'       -- Customer didn't show up
  )),

  -- Payment
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'refunded', 'partial')),
  payment_method TEXT CHECK (payment_method IN ('qpay', 'bank', 'cash', 'card')),

  -- Customer info (for walk-ins without customer record)
  customer_name TEXT,
  customer_phone TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Source tracking
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'chat', 'messenger', 'instagram', 'website')),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. APPOINTMENT ADDONS (additional services in one appointment)
-- ============================================================

CREATE TABLE appointment_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES service_variations(id) ON DELETE SET NULL,
  price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. WORKING HOURS / AVAILABILITY
-- ============================================================

CREATE TABLE store_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false,
  UNIQUE(store_id, day_of_week)
);

-- Special closures/holidays
CREATE TABLE store_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. INDEXES
-- ============================================================

CREATE INDEX idx_services_store_id ON services(store_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_facebook_post_id ON services(facebook_post_id);
CREATE INDEX idx_services_instagram_post_id ON services(instagram_post_id);

CREATE INDEX idx_service_variations_service_id ON service_variations(service_id);

CREATE INDEX idx_staff_store_id ON staff(store_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);

CREATE INDEX idx_appointments_store_id ON appointments(store_id);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_store_scheduled ON appointments(store_id, scheduled_at);

CREATE INDEX idx_appointment_addons_appointment_id ON appointment_addons(appointment_id);

CREATE INDEX idx_store_hours_store_id ON store_hours(store_id);
CREATE INDEX idx_store_closures_store_id_date ON store_closures(store_id, date);

-- ============================================================
-- 9. TRIGGERS
-- ============================================================

CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_closures ENABLE ROW LEVEL SECURITY;

-- Services RLS (owner-only access)
CREATE POLICY "services_store_access" ON services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = services.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Service Variations RLS
CREATE POLICY "service_variations_access" ON service_variations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM services
      JOIN stores ON stores.id = services.store_id
      WHERE services.id = service_variations.service_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Staff RLS
CREATE POLICY "staff_store_access" ON staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = staff.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Appointments RLS
CREATE POLICY "appointments_store_access" ON appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = appointments.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Appointment Addons RLS
CREATE POLICY "appointment_addons_access" ON appointment_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM appointments
      JOIN stores ON stores.id = appointments.store_id
      WHERE appointments.id = appointment_addons.appointment_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Store Hours RLS
CREATE POLICY "store_hours_access" ON store_hours
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = store_hours.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Store Closures RLS
CREATE POLICY "store_closures_access" ON store_closures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = store_closures.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 11. REALTIME
-- ============================================================

-- Add appointments to realtime (ignore if already added or publication doesn't exist)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- 12. COMMENTS
-- ============================================================

COMMENT ON TABLE services IS 'Services offered by service-based businesses (salons, spas, etc.)';
COMMENT ON TABLE service_variations IS 'Price tiers and add-ons for services';
COMMENT ON TABLE staff IS 'Staff members who can be assigned to appointments';
COMMENT ON TABLE appointments IS 'Customer appointments/bookings';
COMMENT ON TABLE store_hours IS 'Regular business hours for each day of the week';
COMMENT ON TABLE store_closures IS 'Special closures and holidays';
