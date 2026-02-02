-- Phase 13: Construction Extended
-- Tables: material_orders, inspections, permits, crew_members, daily_logs

-- ============================================================
-- MATERIAL ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS material_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  status TEXT NOT NULL DEFAULT 'ordered',
  total_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_order_status_check CHECK (status IN ('ordered', 'shipped', 'delivered', 'cancelled'))
);

CREATE INDEX idx_material_orders_store ON material_orders(store_id);
CREATE INDEX idx_material_orders_project ON material_orders(project_id);
CREATE INDEX idx_material_orders_status ON material_orders(status);

ALTER TABLE material_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_orders_store_owner" ON material_orders
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- updated_at trigger
CREATE TRIGGER set_material_orders_updated_at
  BEFORE UPDATE ON material_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INSPECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL DEFAULT 'other',
  inspector_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  required_corrections TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspection_type_check CHECK (inspection_type IN ('structural', 'electrical', 'plumbing', 'fire', 'final', 'other')),
  CONSTRAINT inspection_result_check CHECK (result IN ('pass', 'fail', 'partial', 'pending'))
);

CREATE INDEX idx_inspections_store ON inspections(store_id);
CREATE INDEX idx_inspections_project ON inspections(project_id);
CREATE INDEX idx_inspections_result ON inspections(result);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_store_owner" ON inspections
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PERMITS
-- ============================================================

CREATE TABLE IF NOT EXISTS permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  permit_type TEXT NOT NULL DEFAULT 'building',
  permit_number TEXT,
  issued_date DATE,
  expiry_date DATE,
  cost NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'applied',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permit_type_check CHECK (permit_type IN ('building', 'electrical', 'plumbing', 'demolition', 'environmental', 'other')),
  CONSTRAINT permit_status_check CHECK (status IN ('applied', 'approved', 'expired', 'rejected'))
);

CREATE INDEX idx_permits_store ON permits(store_id);
CREATE INDEX idx_permits_project ON permits(project_id);
CREATE INDEX idx_permits_status ON permits(status);

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permits_store_owner" ON permits
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_permits_updated_at
  BEFORE UPDATE ON permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- CREW MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  hourly_rate NUMERIC(10,2),
  certifications TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crew_member_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_crew_members_store ON crew_members(store_id);
CREATE INDEX idx_crew_members_status ON crew_members(status);

ALTER TABLE crew_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crew_members_store_owner" ON crew_members
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_crew_members_updated_at
  BEFORE UPDATE ON crew_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DAILY LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weather TEXT,
  work_completed TEXT,
  issues TEXT,
  author_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_logs_store ON daily_logs(store_id);
CREATE INDEX idx_daily_logs_project ON daily_logs(project_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_logs_store_owner" ON daily_logs
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER set_daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
