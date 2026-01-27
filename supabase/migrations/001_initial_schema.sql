-- ============================================================
-- Temuulel Commerce Platform - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- 2.1 users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  password_hash TEXT DEFAULT 'supabase_auth',
  is_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'owner',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 subscription_plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  limits JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 stores
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  business_type TEXT,
  logo_url TEXT,
  website TEXT,
  facebook_page_id TEXT,
  ai_auto_reply BOOLEAN DEFAULT true,
  chatbot_settings JSONB DEFAULT '{}',
  product_settings JSONB DEFAULT '{}',
  payment_settings JSONB DEFAULT '{}',
  shipping_settings JSONB DEFAULT '{}',
  api_key TEXT,
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 store_subscriptions
CREATE TABLE store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  messages_used INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 store_members
CREATE TABLE store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- 2.6 products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  base_price NUMERIC(12,2) DEFAULT 0,
  sku TEXT,
  images JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
  has_variants BOOLEAN DEFAULT false,
  sales_script TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 product_variants
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.8 customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  email TEXT,
  messenger_id TEXT,
  instagram_id TEXT,
  whatsapp_id TEXT,
  channel TEXT DEFAULT 'web' CHECK (channel IN ('messenger', 'instagram', 'whatsapp', 'web')),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.9 orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('qpay', 'bank', 'cash')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'refunded')),
  tracking_number TEXT,
  shipping_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.10 order_items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  variant_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.11 conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  channel TEXT DEFAULT 'web' CHECK (channel IN ('messenger', 'instagram', 'whatsapp', 'web')),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.12 messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_from_customer BOOLEAN DEFAULT true,
  is_ai_response BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.13 chat_sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_sender_id TEXT NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.14 notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.15 chat_messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_stores_owner_id ON stores(owner_id);
CREATE INDEX idx_stores_facebook_page_id ON stores(facebook_page_id);

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_status ON products(status);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_messenger_id ON customers(messenger_id);

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE INDEX idx_conversations_store_id ON conversations(store_id);
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_notifications_store_read_created ON notifications(store_id, is_read, created_at);

CREATE INDEX idx_chat_sessions_facebook_sender_id ON chat_sessions(facebook_sender_id);

CREATE INDEX idx_store_subscriptions_store_id ON store_subscriptions(store_id);

CREATE INDEX idx_store_members_store_id ON store_members(store_id);
CREATE INDEX idx_store_members_user_id ON store_members(user_id);

-- ============================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ---- users ----
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ---- subscription_plans (public read) ----
CREATE POLICY "plans_public_read" ON subscription_plans
  FOR SELECT USING (true);

-- ---- stores ----
CREATE POLICY "stores_owner_all" ON stores
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "stores_member_select" ON stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = stores.id
        AND store_members.user_id = auth.uid()
    )
  );

-- ---- store_subscriptions ----
CREATE POLICY "store_subscriptions_owner" ON store_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = store_subscriptions.store_id
        AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "store_subscriptions_member_select" ON store_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = store_subscriptions.store_id
        AND store_members.user_id = auth.uid()
    )
  );

-- ---- store_members ----
CREATE POLICY "store_members_owner" ON store_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = store_members.store_id
        AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "store_members_self_select" ON store_members
  FOR SELECT USING (user_id = auth.uid());

-- ---- products ----
CREATE POLICY "products_store_access" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = products.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- product_variants ----
CREATE POLICY "product_variants_access" ON product_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products
      JOIN stores ON stores.id = products.store_id
      WHERE products.id = product_variants.product_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- customers ----
CREATE POLICY "customers_store_access" ON customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = customers.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- orders ----
CREATE POLICY "orders_store_access" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = orders.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- order_items ----
CREATE POLICY "order_items_access" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN stores ON stores.id = orders.store_id
      WHERE orders.id = order_items.order_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- conversations ----
CREATE POLICY "conversations_store_access" ON conversations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = conversations.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- messages ----
CREATE POLICY "messages_access" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      JOIN stores ON stores.id = conversations.store_id
      WHERE conversations.id = messages.conversation_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- notifications ----
CREATE POLICY "notifications_owner_select" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = notifications.store_id
        AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "notifications_owner_update" ON notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = notifications.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- ---- chat_sessions ----
CREATE POLICY "chat_sessions_store_access" ON chat_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = chat_sessions.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ---- chat_messages ----
CREATE POLICY "chat_messages_access" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      JOIN stores ON stores.id = chat_sessions.store_id
      WHERE chat_sessions.id = chat_messages.session_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ============================================================
-- 6. REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================================
-- 7. SEED DATA - Subscription Plans
-- ============================================================

INSERT INTO subscription_plans (slug, name, price, limits) VALUES
  ('free', 'Free', 0, '{
    "products": 10,
    "messages": 100,
    "team_members": 1,
    "ai_replies": 50,
    "orders": 50,
    "channels": ["web"],
    "analytics": false,
    "api_access": false
  }'::jsonb),
  ('basic', 'Basic', 29900, '{
    "products": 100,
    "messages": 1000,
    "team_members": 3,
    "ai_replies": 500,
    "orders": 500,
    "channels": ["web", "messenger"],
    "analytics": true,
    "api_access": false
  }'::jsonb),
  ('pro', 'Pro', 79900, '{
    "products": 1000,
    "messages": 10000,
    "team_members": 10,
    "ai_replies": 5000,
    "orders": 5000,
    "channels": ["web", "messenger", "instagram", "whatsapp"],
    "analytics": true,
    "api_access": true
  }'::jsonb),
  ('enterprise', 'Enterprise', 199900, '{
    "products": -1,
    "messages": -1,
    "team_members": -1,
    "ai_replies": -1,
    "orders": -1,
    "channels": ["web", "messenger", "instagram", "whatsapp"],
    "analytics": true,
    "api_access": true
  }'::jsonb);

-- ================================================
-- Storage: Products bucket & RLS policies
-- ================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read product images (public bucket)
CREATE POLICY "Public read access for product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

-- Authenticated users can upload to their store folder
CREATE POLICY "Store owners can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM stores s
      JOIN store_members sm ON sm.store_id = s.id
      WHERE sm.user_id = auth.uid()
      UNION
      SELECT s.id::text FROM stores s
      WHERE s.owner_id = auth.uid()
    )
  );

-- Store owners/members can delete their own images
CREATE POLICY "Store owners can delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM stores s
      JOIN store_members sm ON sm.store_id = s.id
      WHERE sm.user_id = auth.uid()
      UNION
      SELECT s.id::text FROM stores s
      WHERE s.owner_id = auth.uid()
    )
  );
