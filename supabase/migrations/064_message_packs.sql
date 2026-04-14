-- Message usage tracking + purchasable message packs
ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_message_limit integer DEFAULT 100;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS messages_used integer DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS messages_reset_at timestamptz DEFAULT now();

-- Message pack purchases
CREATE TABLE IF NOT EXISTS message_pack_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  pack_size integer NOT NULL,
  price integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  purchased_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_packs_store ON message_pack_purchases(store_id, created_at DESC);

ALTER TABLE message_pack_purchases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Store members can manage message packs"
    ON message_pack_purchases FOR ALL
    USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
