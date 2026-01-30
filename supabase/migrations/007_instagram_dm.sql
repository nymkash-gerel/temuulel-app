-- Add Instagram DM integration fields to stores table
-- Instagram uses the same page access token as the linked Facebook Page,
-- so no separate token column is needed.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS instagram_business_account_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_page_name TEXT,
  ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMPTZ;

-- Add instagram_id to customers table (was missing from initial schema)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS instagram_id TEXT;

-- Index for webhook lookup by Instagram business account ID
CREATE INDEX IF NOT EXISTS idx_stores_instagram_id ON stores(instagram_business_account_id);

-- Index for customer lookup by Instagram ID
CREATE INDEX IF NOT EXISTS idx_customers_instagram_id ON customers(instagram_id);
