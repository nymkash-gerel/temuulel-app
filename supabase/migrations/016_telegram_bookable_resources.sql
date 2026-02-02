-- 016_telegram_bookable_resources.sql
--
-- 1. bookable_resources table (tables, rooms, tent sites, cabins, ger)
-- 2. Staff telegram/messenger fields
-- 3. Appointment resource / check-in/out / party_size fields

-- ============================================================
-- 0. Utility trigger function (used by many tables)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. bookable_resources
-- ============================================================
CREATE TABLE IF NOT EXISTS bookable_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('table', 'room', 'tent_site', 'rv_site', 'ger', 'cabin')),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 2,
  price_per_unit NUMERIC(12,2) DEFAULT 0,
  features JSONB DEFAULT '{}',
  images JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookable_resources_store ON bookable_resources(store_id);
CREATE INDEX idx_bookable_resources_type ON bookable_resources(store_id, type);

-- RLS
ALTER TABLE bookable_resources ENABLE ROW LEVEL SECURITY;

-- Owner can manage their store's resources
CREATE POLICY "bookable_resources_owner_all"
  ON bookable_resources
  FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Store members can read resources
CREATE POLICY "bookable_resources_member_read"
  ON bookable_resources
  FOR SELECT
  USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER set_bookable_resources_updated_at
  BEFORE UPDATE ON bookable_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Staff: add telegram_chat_id and messenger_psid
-- ============================================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS messenger_psid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_telegram
  ON staff(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_messenger_psid
  ON staff(messenger_psid) WHERE messenger_psid IS NOT NULL;

-- ============================================================
-- 3. Appointments: add resource and booking fields
-- ============================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_in_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS check_out_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS party_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_appointments_resource
  ON appointments(resource_id) WHERE resource_id IS NOT NULL;
