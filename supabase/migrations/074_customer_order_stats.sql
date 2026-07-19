-- Aggregate a customer's lifetime order stats in a single query.
--
-- buildCustomerProfile() runs on every chat message and previously SELECTed
-- total_amount for the customer's ENTIRE order history, then counted/summed in JS.
-- For a customer with a long history that transferred every order row on each
-- message. This function returns the count and sum from one aggregate query instead.

CREATE OR REPLACE FUNCTION customer_order_stats(
  p_customer_id uuid,
  p_store_id uuid
)
RETURNS TABLE(order_count int, total_spent numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::int, COALESCE(sum(total_amount), 0)::numeric
  FROM orders
  WHERE customer_id = p_customer_id AND store_id = p_store_id;
$$;

COMMENT ON FUNCTION customer_order_stats(uuid, uuid) IS
  'Returns lifetime order_count and total_spent for a customer within a store.';

-- ROLLBACK (revert src/lib/ai/customer-profile.ts to the full-history select first, then):
--   DROP FUNCTION IF EXISTS customer_order_stats(uuid, uuid);
