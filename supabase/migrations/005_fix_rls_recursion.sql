-- Fix infinite recursion between stores and store_members RLS policies.
-- stores.stores_member_select queries store_members, and
-- store_members.store_members_owner queries stores, causing a loop.
-- Solution: use a SECURITY DEFINER function to bypass RLS for the ownership check.

CREATE OR REPLACE FUNCTION public.is_store_owner(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS store_members_owner ON store_members;
CREATE POLICY store_members_owner ON store_members FOR ALL
  USING (public.is_store_owner(store_id));
