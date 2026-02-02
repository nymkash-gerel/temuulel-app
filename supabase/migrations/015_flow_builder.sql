-- Migration 015: Visual Flow Builder
-- Adds flows and flow_execution_logs tables for ManyChat-style chat automation.

-- ============================================================
-- flows table
-- ============================================================
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Metadata
  name VARCHAR(200) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_template BOOLEAN NOT NULL DEFAULT false,
  business_type TEXT,

  -- Trigger
  trigger_type TEXT NOT NULL DEFAULT 'keyword'
    CHECK (trigger_type IN ('keyword', 'new_conversation', 'button_click', 'intent_match')),
  trigger_config JSONB NOT NULL DEFAULT '{}',

  -- Graph data (React Flow format)
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}',

  -- Priority (lower = checked first)
  priority INTEGER NOT NULL DEFAULT 0,

  -- Analytics
  times_triggered INTEGER NOT NULL DEFAULT 0,
  times_completed INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_flows_store_status ON flows(store_id, status);
CREATE INDEX idx_flows_store_trigger ON flows(store_id, status, trigger_type, priority);
CREATE INDEX idx_flows_business_type ON flows(business_type) WHERE is_template = true;

-- Auto-update timestamp trigger
CREATE TRIGGER set_flows_updated_at
  BEFORE UPDATE ON flows FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flows_store_owner" ON flows
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = flows.store_id
        AND stores.owner_id = auth.uid()
    )
  );

CREATE POLICY "flows_store_member" ON flows
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = flows.store_id
        AND store_members.user_id = auth.uid()
    )
  );

-- ============================================================
-- flow_execution_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS flow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'abandoned', 'error')),
  nodes_visited INTEGER NOT NULL DEFAULT 0,
  variables_collected JSONB DEFAULT '{}',
  exit_node_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_logs_flow ON flow_execution_logs(flow_id, created_at DESC);
CREATE INDEX idx_flow_logs_conversation ON flow_execution_logs(conversation_id);

ALTER TABLE flow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_logs_owner" ON flow_execution_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = flow_execution_logs.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Increment stats helper
CREATE OR REPLACE FUNCTION increment_flow_stats(
  p_flow_id UUID,
  p_increment_triggered INTEGER DEFAULT 0,
  p_increment_completed INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  UPDATE flows
  SET
    times_triggered = times_triggered + p_increment_triggered,
    times_completed = times_completed + p_increment_completed,
    last_triggered_at = CASE WHEN p_increment_triggered > 0 THEN now() ELSE last_triggered_at END
  WHERE id = p_flow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
