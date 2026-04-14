-- Performance indexes for common queries
-- Conversations by store + updated (inbox)
CREATE INDEX IF NOT EXISTS idx_conversations_store_updated ON conversations(store_id, updated_at DESC) WHERE status != 'closed';

-- Messages by conversation + created (chat view)
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);

-- Orders by store + status (dashboard)
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status, created_at DESC);

-- Customers lookup by messenger_id (webhook)
CREATE INDEX IF NOT EXISTS idx_customers_messenger ON customers(messenger_id) WHERE messenger_id IS NOT NULL;

-- Customers lookup by phone (order collection)
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(store_id, phone) WHERE phone IS NOT NULL;

-- OpenAI usage logs analytics queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_created ON openai_usage_logs(created_at DESC);

-- Products active lookup
CREATE INDEX IF NOT EXISTS idx_products_store_status ON products(store_id, status) WHERE status = 'active';
