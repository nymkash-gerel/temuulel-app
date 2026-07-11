-- Per-customer order aggregates for churn analytics.
--
-- The churn endpoint previously loaded every customer id, then fetched EVERY order
-- for the store via a giant .in(customerIds) and aggregated last-activity / spend in
-- JS. This function does the grouping in the database and returns one row per
-- customer, avoiding transferring the full orders table on each dashboard load.

CREATE OR REPLACE FUNCTION churn_order_aggregates(p_store_id uuid)
RETURNS TABLE(
  customer_id uuid,
  last_order_at timestamptz,
  total_spent numeric,
  order_count int
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    customer_id,
    max(created_at) AS last_order_at,
    COALESCE(sum(total_amount), 0)::numeric AS total_spent,
    count(*)::int AS order_count
  FROM orders
  WHERE store_id = p_store_id AND customer_id IS NOT NULL
  GROUP BY customer_id;
$$;

COMMENT ON FUNCTION churn_order_aggregates(uuid) IS
  'Per-customer last_order_at, total_spent and order_count for a store (churn analytics).';
