-- Migration 054: Add denial tracking to deliveries
-- Allows tracking when a driver denies an assignment, including reason and timestamp

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS denial_info JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN deliveries.denial_info IS 'Tracks driver denial: { driver_id, driver_name, reason, reason_label, denied_at }';
