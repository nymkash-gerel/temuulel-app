-- AI Quality Logs: scored per AI response
CREATE TABLE IF NOT EXISTS ai_quality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  customer_message text NOT NULL,
  ai_response text NOT NULL,
  intent text,
  confidence real DEFAULT 0.5,
  quality_score smallint NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  detected_issues text[] DEFAULT '{}',
  requires_human_review boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_quality_logs_store ON ai_quality_logs(store_id, created_at DESC);
CREATE INDEX idx_quality_logs_low ON ai_quality_logs(store_id, quality_score) WHERE quality_score < 50;

-- Unanswered Questions: logged when AI cannot answer
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_message text NOT NULL,
  intent text,
  ai_response text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'ignored')),
  answered_at timestamptz,
  knowledge_entry_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_unanswered_store ON unanswered_questions(store_id, status, created_at DESC);

-- Store Knowledge Base: store-specific Q&A entries injected into AI prompt
CREATE TABLE IF NOT EXISTS store_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  category text DEFAULT 'general',
  keywords text[] DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_store ON store_knowledge_base(store_id, is_active) WHERE is_active = true;
CREATE INDEX idx_knowledge_keywords ON store_knowledge_base USING gin(keywords);

-- Add FK from unanswered_questions to knowledge base
ALTER TABLE unanswered_questions
  ADD CONSTRAINT fk_unanswered_knowledge
  FOREIGN KEY (knowledge_entry_id) REFERENCES store_knowledge_base(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE ai_quality_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store members can view quality logs"
  ON ai_quality_logs FOR SELECT
  USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));

CREATE POLICY "Store members can manage unanswered"
  ON unanswered_questions FOR ALL
  USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));

CREATE POLICY "Store members can manage knowledge base"
  ON store_knowledge_base FOR ALL
  USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));
