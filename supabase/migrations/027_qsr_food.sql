-- ============================================================================
-- Migration 027: QSR / Food Vertical
-- Adds: menu_categories, modifier_groups, modifiers, product_modifier_groups,
--        kds_stations, order_item_modifiers, promotions
-- Alters: products (add menu_category_id)
-- ============================================================================

-- 1. Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  available_from TIME,
  available_until TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_menu_categories_store ON menu_categories(store_id);
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_categories_store_access" ON menu_categories
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER menu_categories_updated_at
  BEFORE UPDATE ON menu_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Modifier Groups
CREATE TABLE modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  selection_type TEXT DEFAULT 'single' CHECK (selection_type IN ('single', 'multiple')),
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_modifier_groups_store ON modifier_groups(store_id);
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifier_groups_store_access" ON modifier_groups
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER modifier_groups_updated_at
  BEFORE UPDATE ON modifier_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Modifiers (individual options within a group)
CREATE TABLE modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment NUMERIC(12,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_modifiers_group ON modifiers(group_id);
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifiers_access" ON modifiers
  FOR ALL USING (
    group_id IN (
      SELECT id FROM modifier_groups WHERE store_id IN (
        SELECT id FROM stores WHERE owner_id = auth.uid()
      )
      OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    )
  );

-- 4. Product-Modifier Group association
CREATE TABLE product_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(product_id, modifier_group_id)
);

CREATE INDEX idx_product_modifier_groups_product ON product_modifier_groups(product_id);
CREATE INDEX idx_product_modifier_groups_group ON product_modifier_groups(modifier_group_id);
ALTER TABLE product_modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_modifier_groups_access" ON product_modifier_groups
  FOR ALL USING (
    product_id IN (
      SELECT id FROM products WHERE store_id IN (
        SELECT id FROM stores WHERE owner_id = auth.uid()
      )
      OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
    )
  );

-- 5. KDS Stations (Kitchen Display System)
CREATE TABLE kds_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  station_type TEXT DEFAULT 'kitchen' CHECK (station_type IN ('kitchen', 'bar', 'prep', 'expo', 'packaging')),
  display_categories TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kds_stations_store ON kds_stations(store_id);
ALTER TABLE kds_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kds_stations_store_access" ON kds_stations
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER kds_stations_updated_at
  BEFORE UPDATE ON kds_stations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Order Item Modifiers (which modifiers were selected per order item)
CREATE TABLE order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  price_adjustment NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_item_modifiers_access" ON order_item_modifiers
  FOR ALL USING (
    order_item_id IN (
      SELECT id FROM order_items WHERE order_id IN (
        SELECT id FROM orders WHERE store_id IN (
          SELECT id FROM stores WHERE owner_id = auth.uid()
        )
        OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
      )
    )
  );

-- 7. Promotions
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  promo_type TEXT NOT NULL CHECK (promo_type IN ('item_discount', 'order_discount', 'bogo', 'combo', 'free_item', 'loyalty')),
  discount_type TEXT CHECK (discount_type IN ('percent', 'fixed', 'free')),
  discount_value NUMERIC(12,2) DEFAULT 0,
  conditions JSONB DEFAULT '{}',
  min_order_amount NUMERIC(12,2),
  max_discount_amount NUMERIC(12,2),
  applicable_products UUID[],
  applicable_categories TEXT[],
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_promotions_store ON promotions(store_id);
CREATE INDEX idx_promotions_active ON promotions(store_id, is_active) WHERE is_active = true;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_store_access" ON promotions
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Add menu_category_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS menu_category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_menu_category ON products(menu_category_id);

-- 9. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kds_stations;
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
