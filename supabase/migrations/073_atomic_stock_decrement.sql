-- Atomic stock decrement to prevent oversell under concurrency.
--
-- Previously decrementStockAndNotify() did a read-modify-write in JS:
--   read stock_quantity -> compute max(0, q - n) -> write.
-- Two orders for the same variant confirmed concurrently both read the same base
-- and the second write clobbered the first (lost update) -> oversell.
--
-- This function performs the decrement in a single atomic statement. The `FOR UPDATE`
-- row lock serialises concurrent callers on the same variant, and it returns both the
-- pre- and post-decrement quantities so the caller can detect a low-stock threshold
-- crossing without a second (racy) read.

CREATE OR REPLACE FUNCTION decrement_variant_stock(
  p_variant_id uuid,
  p_quantity int
)
RETURNS TABLE(old_quantity int, new_quantity int, product_id uuid)
LANGUAGE sql
AS $$
  WITH locked AS (
    SELECT id, stock_quantity AS old_q, product_id
    FROM product_variants
    WHERE id = p_variant_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE product_variants pv
    SET stock_quantity = GREATEST(0, pv.stock_quantity - p_quantity)
    FROM locked
    WHERE pv.id = locked.id
    RETURNING pv.stock_quantity AS new_q
  )
  SELECT locked.old_q, updated.new_q, locked.product_id
  FROM locked, updated;
$$;

COMMENT ON FUNCTION decrement_variant_stock(uuid, int) IS
  'Atomically decrement a product variant stock (clamped at 0). Returns old/new quantity and product_id.';
