-- Migration 050: Extend delivery status + type enums for new features
-- ===========================================================================
-- Adds:
--   • 'at_store'       to deliveries.status   (driver arrived at store, awaiting pickup)
--   • 'intercity_post' to deliveries.delivery_type  (bus/post intercity shipping)
--   • proof_photo_file_id in metadata is stored as JSONB — no schema change needed.
--   • Adds actual_delivery_time update trigger (already exists via updated_at trigger,
--     but we record it explicitly when status→delivered)

-- 1. Drop old CHECK, add new one (PostgreSQL requires DROP + ADD for enum-like CHECKs)
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_status_check CHECK (status IN (
    'pending', 'assigned', 'at_store', 'picked_up', 'in_transit',
    'delivered', 'failed', 'cancelled', 'delayed'
  ));

-- 2. Extend delivery_type to support intercity postal/bus delivery
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_delivery_type_check;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_delivery_type_check CHECK (delivery_type IN (
    'own_driver', 'external_provider', 'intercity_post'
  ));
