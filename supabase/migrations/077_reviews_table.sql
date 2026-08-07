-- Backfill the reviews table into migrations.
--
-- The `reviews` table (used by GET/POST /api/reviews) exists on the cloud
-- Supabase project but was never captured in a migration — the same historical
-- gap as product_faqs (fixed by 052_product_faqs.sql). Columns match the API
-- route: id, store_id, customer_id, order_id, product_id, rating, comment,
-- created_at.
--
-- Access model:
--   - Public reads and writes go through /api/reviews, which uses the
--     service-role client (bypasses RLS) and verifies orders before insert.
--   - RLS grants store owners/members SELECT on their own store's reviews.
--   - There is intentionally NO public INSERT policy (see 076 for the same
--     hardening on driver_ratings).

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_store_id ON reviews(store_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id) WHERE product_id IS NOT NULL;

-- One review per product per order, and one order-level review (no product)
-- per order. Backs the code-level 409 dedupe in POST /api/reviews.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_order_product
  ON reviews(order_id, product_id)
  WHERE order_id IS NOT NULL AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_order_no_product
  ON reviews(order_id)
  WHERE order_id IS NOT NULL AND product_id IS NULL;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "reviews_store_select" ON reviews
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM stores
        WHERE stores.id = reviews.store_id
          AND (stores.owner_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM store_members
              WHERE store_members.store_id = stores.id
                AND store_members.user_id = auth.uid()
            ))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE reviews IS 'Customer reviews (store/product/order level). Inserts only via service-role /api/reviews route; no public INSERT policy.';
