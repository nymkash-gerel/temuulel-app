-- Audit log for Facebook/Meta data deletion callbacks
CREATE TABLE IF NOT EXISTS data_deletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_user_id TEXT NOT NULL,
  confirmation_code TEXT NOT NULL UNIQUE,
  deleted_customer_ids UUID[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_deletion_code ON data_deletion_log(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_data_deletion_fb_user ON data_deletion_log(fb_user_id);

-- No RLS — only service role writes to this
ALTER TABLE data_deletion_log ENABLE ROW LEVEL SECURITY;
-- No policies = denies all client access. Only service_role bypasses RLS.
