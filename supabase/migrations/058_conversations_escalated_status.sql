-- Migration 058: Add 'escalated' to conversations.status allowed values
--
-- Root cause: conversations.status had CHECK (status IN ('active','closed','pending'))
-- Escalation engine was silently failing to set status='escalated' due to constraint violation.
-- Score was accumulating correctly but status never changed → escalation appeared to not fire.

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('active', 'closed', 'pending', 'escalated'));
