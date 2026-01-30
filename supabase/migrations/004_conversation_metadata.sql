-- Add metadata JSONB column to conversations for storing conversation state (memory)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
