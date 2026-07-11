-- SECURITY FIX: pending_invites was world-readable via the anon key.
--
-- Migration 056 created `FOR SELECT USING (true)` on pending_invites, so anyone
-- holding the public NEXT_PUBLIC_SUPABASE_ANON_KEY (shipped in the browser bundle)
-- could dump every tenant's invite token/email/role/store_id via PostgREST:
--   GET /rest/v1/pending_invites?select=*
-- Combined with /api/team/invite/signup (which trusted the token alone and used the
-- service-role client to create/overwrite the invited auth account), this allowed
-- cross-tenant account takeover.
--
-- Fix: drop the public SELECT policy. Token lookups for the signup/verify/accept
-- flows now run server-side with the service-role client, which bypasses RLS.
-- The store owner retains read/manage access through "Owner can manage pending invites".

DROP POLICY IF EXISTS "Anyone can read invite by token" ON pending_invites;
