-- Add per-store Facebook OAuth fields to stores table
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS facebook_page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS facebook_page_name TEXT,
  ADD COLUMN IF NOT EXISTS facebook_connected_at TIMESTAMPTZ;

COMMENT ON COLUMN stores.facebook_page_access_token IS 'Long-lived page access token from Facebook OAuth';
COMMENT ON COLUMN stores.facebook_page_name IS 'Name of the connected Facebook Page';
COMMENT ON COLUMN stores.facebook_connected_at IS 'Timestamp when Messenger was connected via OAuth';
