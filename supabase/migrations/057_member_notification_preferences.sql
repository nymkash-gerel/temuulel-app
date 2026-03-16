-- Add notification preferences to store_members
-- Each member can choose which notification types they want via Telegram
-- Example: {"new_order": true, "new_message": true, "low_stock": false, ...}

ALTER TABLE store_members
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{}';

COMMENT ON COLUMN store_members.notification_preferences IS 'Per-member Telegram notification preferences: new_order, new_message, new_customer, low_stock, order_status, escalation, delivery, payment';
