-- Operator mode: per-conversation AI pause with auto-return
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS operator_mode boolean DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS operator_mode_at timestamptz;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES auth.users(id);

-- Index for auto-return cron job
CREATE INDEX IF NOT EXISTS idx_conversations_operator_mode
  ON conversations(operator_mode, operator_mode_at)
  WHERE operator_mode = true;
