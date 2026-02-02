-- ============================================================================
-- Migration 028: Beauty / Wellness Vertical
-- Adds: service_packages, package_services, memberships, customer_memberships,
--        client_preferences, staff_commissions
-- ============================================================================

-- 1. Service Packages
CREATE TABLE service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  original_price NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  valid_days INTEGER DEFAULT 365,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_packages_store ON service_packages(store_id);
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_packages_store_access" ON service_packages
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER service_packages_updated_at
  BEFORE UPDATE ON service_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Package Services (what services are included in a package)
CREATE TABLE package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(package_id, service_id)
);

CREATE INDEX idx_package_services_package ON package_services(package_id);
CREATE INDEX idx_package_services_service ON package_services(service_id);
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "package_services_access" ON package_services
  FOR ALL USING (
    package_id IN (
      SELECT id FROM service_packages WHERE store_id IN (
        SELECT id FROM stores WHERE owner_id = auth.uid()
      )
      OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    )
  );

-- 3. Memberships
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  billing_period TEXT DEFAULT 'monthly' CHECK (billing_period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  benefits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memberships_store ON memberships(store_id);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_store_access" ON memberships
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Customer Memberships
CREATE TABLE customer_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  services_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customer_memberships_store ON customer_memberships(store_id);
CREATE INDEX idx_customer_memberships_customer ON customer_memberships(customer_id);
CREATE INDEX idx_customer_memberships_membership ON customer_memberships(membership_id);
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_memberships_store_access" ON customer_memberships
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER customer_memberships_updated_at
  BEFORE UPDATE ON customer_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Client Preferences
CREATE TABLE client_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  skin_type TEXT CHECK (skin_type IN ('normal', 'dry', 'oily', 'combination', 'sensitive')),
  hair_type TEXT CHECK (hair_type IN ('straight', 'wavy', 'curly', 'coily', 'fine', 'thick')),
  allergies TEXT[] DEFAULT '{}',
  preferred_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  color_history JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, customer_id)
);

CREATE INDEX idx_client_preferences_store ON client_preferences(store_id);
CREATE INDEX idx_client_preferences_customer ON client_preferences(customer_id);
ALTER TABLE client_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_preferences_store_access" ON client_preferences
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER client_preferences_updated_at
  BEFORE UPDATE ON client_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Staff Commissions
CREATE TABLE staff_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  sale_type TEXT DEFAULT 'service' CHECK (sale_type IN ('service', 'product', 'package', 'membership')),
  sale_amount NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_staff_commissions_store ON staff_commissions(store_id);
CREATE INDEX idx_staff_commissions_staff ON staff_commissions(staff_id);
CREATE INDEX idx_staff_commissions_status ON staff_commissions(store_id, status) WHERE status = 'pending';
ALTER TABLE staff_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_commissions_store_access" ON staff_commissions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER staff_commissions_updated_at
  BEFORE UPDATE ON staff_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customer_memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_commissions;
