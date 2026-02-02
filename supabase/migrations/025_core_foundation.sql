-- ============================================================================
-- Migration 025: Core Foundation Infrastructure
-- Adds: audit_logs, attachments, blocks, booking_items tables
-- Alters: stores (add enabled_modules)
-- ============================================================================

-- 1. Audit Logs: Generic audit trail for any entity
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'status_change')),
  actor_id UUID REFERENCES users(id),
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'ai', 'customer')),
  changes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_store ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_store_created ON audit_logs(store_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_store_access" ON audit_logs
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- 2. Attachments: Universal file attachment system
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attachments_store ON attachments(store_id);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_store_access" ON attachments
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- 3. Blocks: Staff/resource unavailability
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES bookable_resources(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  block_type TEXT DEFAULT 'manual' CHECK (block_type IN ('manual', 'break', 'holiday', 'maintenance')),
  recurring JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (staff_id IS NOT NULL OR resource_id IS NOT NULL),
  CHECK (end_at > start_at)
);

CREATE INDEX idx_blocks_store ON blocks(store_id);
CREATE INDEX idx_blocks_staff ON blocks(staff_id);
CREATE INDEX idx_blocks_resource ON blocks(resource_id);
CREATE INDEX idx_blocks_time ON blocks(start_at, end_at);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_store_access" ON blocks
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER blocks_updated_at
  BEFORE UPDATE ON blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Booking Items: Multi-service appointments
CREATE TABLE booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES service_variations(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  resource_id UUID REFERENCES bookable_resources(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  price NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_booking_items_store ON booking_items(store_id);
CREATE INDEX idx_booking_items_appointment ON booking_items(appointment_id);
CREATE INDEX idx_booking_items_staff ON booking_items(staff_id);
CREATE INDEX idx_booking_items_resource ON booking_items(resource_id);
CREATE INDEX idx_booking_items_time ON booking_items(start_at, end_at);

ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_items_store_access" ON booking_items
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER booking_items_updated_at
  BEFORE UPDATE ON booking_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Add enabled_modules to stores for feature flags
ALTER TABLE stores ADD COLUMN IF NOT EXISTS enabled_modules JSONB DEFAULT NULL;

-- 6. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE booking_items;
