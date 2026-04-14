-- OpenAI API usage tracking per store
CREATE TABLE IF NOT EXISTS openai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  model text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('chat', 'vision', 'whisper', 'embedding')),
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  duration_ms integer,
  cost_usd numeric(10, 6),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openai_usage_store ON openai_usage_logs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_model ON openai_usage_logs(model, created_at DESC);

ALTER TABLE openai_usage_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Store members can view usage logs"
    ON openai_usage_logs FOR SELECT
    USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
