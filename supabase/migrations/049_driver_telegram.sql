-- Migration 049: Telegram bot integration for drivers
-- Adds Telegram chat_id to delivery_drivers for bot messaging

ALTER TABLE delivery_drivers
  ADD COLUMN IF NOT EXISTS telegram_chat_id  bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_drivers_telegram ON delivery_drivers(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;
