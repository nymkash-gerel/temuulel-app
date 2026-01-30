-- Smart escalation: add scoring and assignment columns to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS escalation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id);

-- Index for dashboard queries filtering by escalation level
CREATE INDEX IF NOT EXISTS idx_conversations_escalation
  ON conversations (store_id, escalation_level, updated_at DESC);

-- Index for agent assignment lookups
CREATE INDEX IF NOT EXISTS idx_conversations_assigned
  ON conversations (assigned_to, status)
  WHERE assigned_to IS NOT NULL;
