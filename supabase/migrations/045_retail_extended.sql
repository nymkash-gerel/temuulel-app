-- ============================================================================
-- Migration 045: Retail Extended
-- Adds: stock_transfers, transfer_items
-- ============================================================================

-- 1. Stock Transfers (between inventory locations)
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  initiated_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stock_transfers_store ON stock_transfers(store_id);
CREATE INDEX idx_stock_transfers_status ON stock_transfers(store_id, status);
CREATE INDEX idx_stock_transfers_from ON stock_transfers(from_location_id);
CREATE INDEX idx_stock_transfers_to ON stock_transfers(to_location_id);
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_transfers_store_access" ON stock_transfers
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

CREATE TRIGGER stock_transfers_updated_at
  BEFORE UPDATE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Transfer Items (line items for each transfer)
CREATE TABLE transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX idx_transfer_items_product ON transfer_items(product_id);
ALTER TABLE transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfer_items_store_access" ON transfer_items
  FOR ALL USING (
    transfer_id IN (
      SELECT id FROM stock_transfers WHERE store_id IN (
        SELECT id FROM stores WHERE owner_id = auth.uid()
      )
    )
    OR transfer_id IN (
      SELECT id FROM stock_transfers WHERE store_id IN (
        SELECT store_id FROM store_members WHERE user_id = auth.uid()
      )
    )
  );
