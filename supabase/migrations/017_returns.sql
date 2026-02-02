-- Migration 017: Returns & Refunds
-- Tracks return requests with handler info, full/partial returns, status workflow

-- ============================================================
-- 1. RETURN REQUESTS TABLE
-- ============================================================

CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  return_number TEXT UNIQUE NOT NULL,
  handled_by TEXT,
  handled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  return_type TEXT NOT NULL DEFAULT 'full' CHECK (return_type IN ('full', 'partial')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),

  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method TEXT CHECK (refund_method IN ('qpay', 'bank', 'cash', 'original')),
  admin_notes TEXT,

  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. RETURN ITEMS TABLE (for partial returns)
-- ============================================================

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_return_requests_store_id ON return_requests(store_id);
CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_customer_id ON return_requests(customer_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);
CREATE INDEX idx_return_requests_created_at ON return_requests(created_at);
CREATE INDEX idx_return_requests_store_status ON return_requests(store_id, status);

CREATE INDEX idx_return_items_return_id ON return_items(return_id);
CREATE INDEX idx_return_items_order_item_id ON return_items(order_item_id);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

CREATE TRIGGER set_return_requests_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_requests_store_access" ON return_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = return_requests.store_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

CREATE POLICY "return_items_access" ON return_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM return_requests
      JOIN stores ON stores.id = return_requests.store_id
      WHERE return_requests.id = return_items.return_id
        AND (stores.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM store_members
            WHERE store_members.store_id = stores.id
              AND store_members.user_id = auth.uid()
          ))
    )
  );

-- ============================================================
-- 6. COMMENTS
-- ============================================================

COMMENT ON TABLE return_requests IS 'Return/refund requests linked to orders';
COMMENT ON TABLE return_items IS 'Individual items in a partial return';
