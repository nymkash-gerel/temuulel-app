-- ============================================================
-- Performance Indexes Migration
-- Migration: 014_performance_indexes.sql
--
-- Adds indexes for common query patterns identified during
-- codebase audit. All CREATE INDEX IF NOT EXISTS to be safe.
-- ============================================================

-- Enable pg_trgm extension for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add search_aliases column to products (used by product search + AI enrichment)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_aliases TEXT[] DEFAULT '{}';

-- Orders: payment_status is filtered in payment check routes
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Orders: order_number trigram index for ILIKE searches
CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm ON orders USING gin (order_number gin_trgm_ops);

-- Products: GIN index for search_aliases array containment queries
CREATE INDEX IF NOT EXISTS idx_products_search_aliases ON products USING gin (search_aliases);

-- Products: composite index for store + status (common filter combo)
CREATE INDEX IF NOT EXISTS idx_products_store_status ON products(store_id, status);

-- Customers: email lookups (team invite, customer matching)
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Customers: Instagram ID lookups (DM integration)
CREATE INDEX IF NOT EXISTS idx_customers_instagram_id ON customers(instagram_id);

-- Chat sessions: store_id lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_store_id ON chat_sessions(store_id);

-- Chat messages: session_id lookups with created_at ordering
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- Comment auto rules: store_id + priority ordering
CREATE INDEX IF NOT EXISTS idx_comment_auto_rules_store_priority ON comment_auto_rules(store_id, priority);
