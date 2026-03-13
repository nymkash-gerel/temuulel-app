-- Add granular permissions to store_members
-- permissions is a JSONB object where keys are permission names and values are booleans
-- Example: {"chat": true, "orders": true, "products": false, "settings": false}
-- Owner role implicitly has all permissions (enforced in application code)
-- Admin role defaults to all permissions
-- Staff role defaults to chat-only

ALTER TABLE store_members
  ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Index for looking up members by telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_store_members_telegram_chat_id
  ON store_members (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

COMMENT ON COLUMN store_members.permissions IS 'Granular feature permissions: chat, orders, products, delivery, payments, reports, settings, staff_manage, telegram_connect';
COMMENT ON COLUMN store_members.telegram_chat_id IS 'Telegram chat ID for receiving store notifications';
