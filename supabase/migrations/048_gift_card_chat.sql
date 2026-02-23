-- Migration 048: Gift card chat feature
-- Adds: gift_card_transactions table, recipient fields on gift_cards
-- Used by: gift card purchase, redeem, and transfer flows via chat

-- ---------------------------------------------------------------------------
-- gift_card_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id       uuid        NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  store_id           uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  transaction_type   text        NOT NULL CHECK (transaction_type IN ('purchase','redeem','transfer','refund')),
  amount             numeric     NOT NULL,
  order_id           uuid        REFERENCES orders(id) ON DELETE SET NULL,
  from_customer_id   uuid        REFERENCES customers(id) ON DELETE SET NULL,
  to_customer_id     uuid        REFERENCES customers(id) ON DELETE SET NULL,
  note               text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gct_gift_card ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gct_store     ON gift_card_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_gct_type      ON gift_card_transactions(store_id, transaction_type);

ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gct_store_access" ON gift_card_transactions
  USING (store_id IN (
    SELECT id FROM stores WHERE owner_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Extend gift_cards table for chat-based transfer
-- ---------------------------------------------------------------------------
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS recipient_contact text;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS transferred_at    timestamptz;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS purchased_via     text DEFAULT 'dashboard';
-- purchased_via: 'dashboard' | 'chat'
