-- Migration 023: Delivery Scheduling, Driver Chat, Multi-Store Sharing, Proof Storage
-- =================================================================================

-- -------------------------------------------------------------------------
-- 1. Delivery Scheduling columns
-- -------------------------------------------------------------------------
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS scheduled_time_slot text;

-- Store-configurable time slots
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_time_slots jsonb DEFAULT '[]'::jsonb;

-- -------------------------------------------------------------------------
-- 2. Driver Chat Messages
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('store', 'driver')),
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_messages_conversation
  ON driver_messages (store_id, driver_id, created_at);

CREATE INDEX IF NOT EXISTS idx_driver_messages_unread
  ON driver_messages (store_id, driver_id)
  WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE driver_messages ENABLE ROW LEVEL SECURITY;

-- Store owner can read/insert messages for their store
CREATE POLICY "store_owner_driver_messages_select"
  ON driver_messages FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "store_owner_driver_messages_insert"
  ON driver_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    AND sender_type = 'store'
  );

-- Driver can read messages where they are the driver
CREATE POLICY "driver_messages_select"
  ON driver_messages FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT dd.id FROM delivery_drivers dd
      WHERE dd.user_id = auth.uid()
    )
  );

-- Driver can insert messages as driver
CREATE POLICY "driver_messages_insert"
  ON driver_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IN (
      SELECT dd.id FROM delivery_drivers dd
      WHERE dd.user_id = auth.uid()
    )
    AND sender_type = 'driver'
  );

-- Driver can update read_at on messages sent to them
CREATE POLICY "driver_messages_update_read"
  ON driver_messages FOR UPDATE
  TO authenticated
  USING (
    driver_id IN (
      SELECT dd.id FROM delivery_drivers dd
      WHERE dd.user_id = auth.uid()
    )
    AND sender_type = 'store'
  )
  WITH CHECK (
    driver_id IN (
      SELECT dd.id FROM delivery_drivers dd
      WHERE dd.user_id = auth.uid()
    )
    AND sender_type = 'store'
  );

-- Store owner can update read_at on messages sent to them
CREATE POLICY "store_owner_messages_update_read"
  ON driver_messages FOR UPDATE
  TO authenticated
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    AND sender_type = 'driver'
  )
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    AND sender_type = 'driver'
  );

-- Enable realtime for driver_messages
ALTER PUBLICATION supabase_realtime ADD TABLE driver_messages;

-- -------------------------------------------------------------------------
-- 3. Multi-Store Driver Sharing (junction table)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driver_store_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (driver_id, store_id)
);

-- Enable RLS
ALTER TABLE driver_store_assignments ENABLE ROW LEVEL SECURITY;

-- Store owner can manage assignments for their store
CREATE POLICY "store_owner_assignments_select"
  ON driver_store_assignments FOR SELECT
  TO authenticated
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "store_owner_assignments_insert"
  ON driver_store_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

CREATE POLICY "store_owner_assignments_delete"
  ON driver_store_assignments FOR DELETE
  TO authenticated
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

-- Driver can see their own assignments
CREATE POLICY "driver_assignments_select"
  ON driver_store_assignments FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT dd.id FROM delivery_drivers dd
      WHERE dd.user_id = auth.uid()
    )
  );

-- Seed existing relationships from delivery_drivers.store_id
INSERT INTO driver_store_assignments (driver_id, store_id)
SELECT id, store_id FROM delivery_drivers
WHERE store_id IS NOT NULL
ON CONFLICT (driver_id, store_id) DO NOTHING;

-- -------------------------------------------------------------------------
-- 4. Delivery Proofs Storage Bucket
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  true,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to delivery-proofs
CREATE POLICY "delivery_proofs_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs');

-- Public read access for delivery proof photos
CREATE POLICY "delivery_proofs_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'delivery-proofs');

-- Authenticated users can delete their uploads
CREATE POLICY "delivery_proofs_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'delivery-proofs');
