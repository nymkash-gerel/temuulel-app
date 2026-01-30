-- Migration 009: Comment Auto-Reply Feature
-- Adds tables for ManyChat-style comment auto-reply rules

-- Comment auto-reply rules
CREATE TABLE comment_auto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Rule configuration
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,  -- Lower number = higher priority

  -- Trigger conditions
  trigger_type VARCHAR(20) NOT NULL DEFAULT 'keyword'
    CHECK (trigger_type IN ('keyword', 'any', 'first_comment', 'contains_question')),
  keywords TEXT[],  -- Array of keywords for 'keyword' trigger
  match_mode VARCHAR(10) DEFAULT 'any'
    CHECK (match_mode IN ('any', 'all')),

  -- Reply configuration
  reply_comment BOOLEAN NOT NULL DEFAULT true,   -- Reply publicly to comment
  reply_dm BOOLEAN NOT NULL DEFAULT false,       -- Send private DM
  comment_template TEXT,   -- Template for public reply (supports {{variables}})
  dm_template TEXT,        -- Template for private DM
  delay_seconds INTEGER DEFAULT 0 CHECK (delay_seconds >= 0 AND delay_seconds <= 300),

  -- Targeting
  platforms TEXT[] DEFAULT ARRAY['facebook', 'instagram'],
  post_filter JSONB,  -- Optional: specific post IDs to target

  -- Analytics
  matches_count INTEGER NOT NULL DEFAULT 0,
  replies_sent INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient rule lookup
CREATE INDEX idx_comment_auto_rules_store_priority
  ON comment_auto_rules (store_id, enabled, priority);

CREATE INDEX idx_comment_auto_rules_keywords
  ON comment_auto_rules USING GIN (keywords);

-- Comment reply logs for analytics
CREATE TABLE comment_reply_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES comment_auto_rules(id) ON DELETE SET NULL,

  -- Comment info
  comment_id VARCHAR(100) NOT NULL,
  post_id VARCHAR(100) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  commenter_id VARCHAR(100) NOT NULL,
  commenter_name VARCHAR(255),
  comment_text TEXT,

  -- Reply info
  reply_type VARCHAR(20) NOT NULL CHECK (reply_type IN ('comment', 'dm', 'both')),
  reply_comment_id VARCHAR(100),    -- ID of our reply comment
  reply_dm_sent BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for logs
CREATE INDEX idx_comment_reply_logs_store_date
  ON comment_reply_logs (store_id, created_at DESC);

CREATE INDEX idx_comment_reply_logs_rule
  ON comment_reply_logs (rule_id, created_at DESC);

-- RLS Policies
ALTER TABLE comment_auto_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reply_logs ENABLE ROW LEVEL SECURITY;

-- Policy for rules: owners and store members can manage
CREATE POLICY "comment_auto_rules_access" ON comment_auto_rules
  FOR ALL USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Policy for logs: owners can view
CREATE POLICY "comment_reply_logs_access" ON comment_reply_logs
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Function to increment rule stats (called from webhook handler)
CREATE OR REPLACE FUNCTION increment_rule_stats(
  p_rule_id UUID,
  p_increment_matches INTEGER DEFAULT 1,
  p_increment_replies INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE comment_auto_rules
  SET
    matches_count = matches_count + p_increment_matches,
    replies_sent = replies_sent + p_increment_replies,
    last_triggered_at = NOW(),
    updated_at = NOW()
  WHERE id = p_rule_id;
END;
$$;

-- Grant execute to service role (for webhook processing)
GRANT EXECUTE ON FUNCTION increment_rule_stats TO service_role;
