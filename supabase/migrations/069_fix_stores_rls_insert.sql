-- Fix stores RLS: the existing policy `stores_owner_all` uses
-- `FOR ALL USING (auth.uid() = owner_id)` which blocks INSERT in Postgres
-- (USING applies to SELECT/UPDATE/DELETE; INSERT needs WITH CHECK).
--
-- Symptoms: "new row violates row-level security policy for table stores"
-- during onboarding / signup.
--
-- Fix: split into explicit per-operation policies that include WITH CHECK
-- for INSERT and UPDATE.

DROP POLICY IF EXISTS "stores_owner_all" ON stores;

CREATE POLICY "stores_owner_select" ON stores
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "stores_owner_insert" ON stores
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "stores_owner_update" ON stores
  FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "stores_owner_delete" ON stores
  FOR DELETE USING (auth.uid() = owner_id);
