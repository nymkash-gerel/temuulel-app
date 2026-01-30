-- Migration 010: Add AI reply option to comment auto-rules
-- Allows rules to use AI-generated responses instead of templates

-- Add use_ai column
ALTER TABLE comment_auto_rules
ADD COLUMN use_ai BOOLEAN NOT NULL DEFAULT false;

-- Add AI-specific settings
ALTER TABLE comment_auto_rules
ADD COLUMN ai_context TEXT;  -- Optional context/instructions for AI

-- Comment for documentation
COMMENT ON COLUMN comment_auto_rules.use_ai IS 'When true, use AI to generate response instead of template';
COMMENT ON COLUMN comment_auto_rules.ai_context IS 'Additional context/instructions for AI when generating response';
