-- Two tables were given RLS plus a SELECT-only policy, so every write through
-- an RLS-bound client is rejected. Both were backfilled from the live cloud DB
-- in 078, which faithfully copied an already-incomplete policy set rather than
-- introducing the gap locally.
--
-- The trap: `FOR ALL USING (x)` DOES cover INSERT — Postgres reuses USING as
-- WITH CHECK when the latter is omitted — while `FOR SELECT USING (x)` has no
-- such fallback. The two shapes look symmetric in a migration and are not.
--
-- Verified against the local DB by running the real INSERT as role
-- `authenticated` with request.jwt.claims set to a store member, inside a
-- rolled-back transaction:
--   INSERT INTO referrals ... -> ERROR: new row violates row-level security
--                                       policy for table "referrals"
--
-- 1. referrals — POST /api/referrals uses createClient() from
--    lib/supabase/server (publishable key + user cookies, never service-role)
--    and DOES check the error, so it returns a hard 500. The dashboard's
--    "Холбоос үүсгэх" button has no else-branch, so the owner just sees a dead
--    button: the refer-a-friend loop has never produced a single row.
--
-- 2. user_sessions — POST /api/sessions inserts and never reads the result, so
--    it fails silently; DELETE (revoke) is blocked by the same gap. The result
--    is a Security page whose "Идэвхтэй sessions" list is permanently empty and
--    a revoke button that cannot revoke. That is a security control that
--    reports success while doing nothing, which is why it is fixed here rather
--    than deferred.
--
-- Scoping matches each table's existing SELECT policy exactly, so this grants
-- no visibility that was not already granted. UPDATE stays closed on both.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS "Referrers can create their referrals" ON referrals;
--   DROP POLICY IF EXISTS "Users insert own sessions" ON user_sessions;
--   DROP POLICY IF EXISTS "Users delete own sessions" ON user_sessions;

-- ---------------------------------------------------------------------------
-- referrals: a store member may create a referral for their own store
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Referrers can create their referrals" ON referrals
    FOR INSERT WITH CHECK (
      referrer_store_id IN (
        SELECT store_id FROM store_members WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- user_sessions: a user may record and revoke only their own sessions
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "Users insert own sessions" ON user_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own sessions" ON user_sessions
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
