-- ROLLBACK:
-- To undo this migration, run the following SQL:
--   ALTER TABLE orders DROP COLUMN IF EXISTS order_type;
--   ALTER TABLE orders DROP COLUMN IF EXISTS table_session_id;
--   ALTER TABLE orders DROP COLUMN IF EXISTS scheduled_pickup_time;
--   ALTER TABLE orders DROP COLUMN IF EXISTS kitchen_start_time;
--   ALTER TABLE products DROP COLUMN IF EXISTS available_today;
--   ALTER TABLE products DROP COLUMN IF EXISTS daily_limit;
--   ALTER TABLE products DROP COLUMN IF EXISTS daily_sold;
--   ALTER TABLE products DROP COLUMN IF EXISTS sold_out;
--   ALTER TABLE products DROP COLUMN IF EXISTS allergens;
--   ALTER TABLE products DROP COLUMN IF EXISTS spicy_level;
--   ALTER TABLE products DROP COLUMN IF EXISTS is_vegan;
--   ALTER TABLE products DROP COLUMN IF EXISTS is_halal;
--   ALTER TABLE products DROP COLUMN IF EXISTS is_gluten_free;
--   ALTER TABLE products DROP COLUMN IF EXISTS dietary_tags;
--   ALTER TABLE stores DROP COLUMN IF EXISTS busy_mode;
--   ALTER TABLE stores DROP COLUMN IF EXISTS busy_message;
--   ALTER TABLE stores DROP COLUMN IF EXISTS estimated_wait_minutes;
--   ALTER TABLE table_layouts DROP COLUMN IF EXISTS qr_code_token;
--   ALTER TABLE table_layouts DROP COLUMN IF EXISTS qr_enabled;
--   ALTER TABLE table_reservations DROP COLUMN IF EXISTS guest_name;
--   ALTER TABLE table_reservations DROP COLUMN IF EXISTS guest_phone;
--   DROP FUNCTION IF EXISTS reset_daily_sold_counters();

-- ============================================================================
-- Migration 047: Restaurant Features
-- Adds: order_type, menu availability, allergens, busy mode, QR ordering
-- ============================================================================

-- 1. Order type + scheduling on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery'
  CHECK (order_type IN ('dine_in', 'pickup', 'delivery', 'catering'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_pickup_time TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_start_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(store_id, order_type);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);

-- 2. Menu availability on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_today BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_limit INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS daily_sold INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_out BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_available ON products(store_id, available_today, sold_out);

-- 3. Allergen / dietary tags on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS spicy_level INTEGER DEFAULT 0
  CHECK (spicy_level BETWEEN 0 AND 5);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_halal BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';

-- 4. Store busy mode
ALTER TABLE stores ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS busy_message TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS estimated_wait_minutes INTEGER;

-- 5. QR code token on table_layouts
ALTER TABLE table_layouts ADD COLUMN IF NOT EXISTS qr_code_token UUID DEFAULT gen_random_uuid();
ALTER TABLE table_layouts ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_table_layouts_qr_token ON table_layouts(qr_code_token);

-- 6. Guest info on table_reservations (walk-ins without customer_id)
ALTER TABLE table_reservations ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE table_reservations ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- 7. Daily sold counter reset function (call via Supabase cron at midnight)
CREATE OR REPLACE FUNCTION reset_daily_sold_counters()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products SET daily_sold = 0, sold_out = false
  WHERE daily_sold > 0 OR sold_out = true;
END;
$$;
