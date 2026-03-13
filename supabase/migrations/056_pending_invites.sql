-- Pending invites for users who haven't signed up yet
-- Owner invites by email → token generated → staff signs up via /invite/[token]
-- On signup, pending invite is consumed and staff is added to store_members

CREATE TABLE IF NOT EXISTS pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  permissions jsonb DEFAULT '{}',
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique: one pending invite per email per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_invites_store_email
  ON pending_invites (store_id, email);

-- Fast lookup by token
CREATE INDEX IF NOT EXISTS idx_pending_invites_token
  ON pending_invites (token);

-- Clean up expired invites periodically (can be done via cron)
CREATE INDEX IF NOT EXISTS idx_pending_invites_expires
  ON pending_invites (expires_at);

-- RLS
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

-- Store owner can manage invites
CREATE POLICY "Owner can manage pending invites"
  ON pending_invites
  FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Anyone can read by token (for signup page)
CREATE POLICY "Anyone can read invite by token"
  ON pending_invites
  FOR SELECT
  USING (true);

COMMENT ON TABLE pending_invites IS 'Stores pending team invitations for users who have not yet signed up';
