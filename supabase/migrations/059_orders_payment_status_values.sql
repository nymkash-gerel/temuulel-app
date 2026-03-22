-- Migration 059: Add 'partial' and 'failed' to orders.payment_status allowed values
--
-- Root cause: orders.payment_status had CHECK (payment_status IN ('paid','pending','refunded'))
-- Driver bot partial/failed payment handling was silently failing on UPDATE.

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('paid', 'pending', 'refunded', 'partial', 'failed'));
