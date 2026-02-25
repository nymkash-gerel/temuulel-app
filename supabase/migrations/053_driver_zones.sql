-- Migration 050: Driver delivery zones
-- Adds delivery_zones (text array) so drivers can be assigned to specific areas.
-- Zone strings should match Mongolian district/area names in delivery addresses.
-- Example: ['БЗД', 'ХУД'] means this driver covers Bayanzurkh + Khan-Uul districts.

ALTER TABLE delivery_drivers
  ADD COLUMN IF NOT EXISTS delivery_zones text[] NOT NULL DEFAULT '{}';

-- Index for zone-based filtering
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_zones
  ON delivery_drivers USING GIN (delivery_zones);

COMMENT ON COLUMN delivery_drivers.delivery_zones IS
  'Mongolian district/area codes this driver covers. E.g. {БЗД,ХУД,СБД}';
