-- Migration 020: Driver Portal + AI Assignment
-- Adds driver self-access RLS, delivery_settings on stores, ai_assignment on deliveries

-- ============================================================
-- 1. SCHEMA CHANGES
-- ============================================================

-- Store-level delivery/assignment configuration (JSONB)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS delivery_settings JSONB DEFAULT '{}';

-- AI assignment recommendation stored per delivery for audit
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS ai_assignment JSONB DEFAULT NULL;

-- ============================================================
-- 2. DRIVER SELF-ACCESS RLS POLICIES
-- ============================================================

-- Drivers can read their own driver record
CREATE POLICY "driver_self_select" ON delivery_drivers
  FOR SELECT USING (user_id = auth.uid());

-- Drivers can update their own driver record (name, phone, vehicle, location)
CREATE POLICY "driver_self_update" ON delivery_drivers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Drivers can read deliveries assigned to them
CREATE POLICY "driver_read_own_deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM delivery_drivers
      WHERE delivery_drivers.id = deliveries.driver_id
        AND delivery_drivers.user_id = auth.uid()
    )
  );

-- Drivers can update deliveries assigned to them (status, notes, proof)
CREATE POLICY "driver_update_own_deliveries" ON deliveries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM delivery_drivers
      WHERE delivery_drivers.id = deliveries.driver_id
        AND delivery_drivers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM delivery_drivers
      WHERE delivery_drivers.id = deliveries.driver_id
        AND delivery_drivers.user_id = auth.uid()
    )
  );

-- Drivers can read status logs for their own deliveries
CREATE POLICY "driver_read_own_delivery_logs" ON delivery_status_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deliveries
      JOIN delivery_drivers ON delivery_drivers.id = deliveries.driver_id
      WHERE deliveries.id = delivery_status_log.delivery_id
        AND delivery_drivers.user_id = auth.uid()
    )
  );

-- Drivers can insert status log entries for their own deliveries
CREATE POLICY "driver_insert_own_delivery_logs" ON delivery_status_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries
      JOIN delivery_drivers ON delivery_drivers.id = deliveries.driver_id
      WHERE deliveries.id = delivery_status_log.delivery_id
        AND delivery_drivers.user_id = auth.uid()
    )
  );

-- Migration registration handled by Supabase CLI
