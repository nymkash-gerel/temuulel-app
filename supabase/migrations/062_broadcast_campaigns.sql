-- Broadcast campaigns: mass messaging to customers
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'ordered', 'active_30d')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_broadcast_store ON broadcast_campaigns(store_id, created_at DESC);

-- Broadcast recipients: tracks individual sends
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  messenger_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id, status);

-- RLS
ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Store members can manage broadcasts"
    ON broadcast_campaigns FOR ALL
    USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Store members can view broadcast recipients"
    ON broadcast_recipients FOR SELECT
    USING (campaign_id IN (SELECT id FROM broadcast_campaigns WHERE store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
