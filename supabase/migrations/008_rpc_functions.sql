-- RPC functions to bypass PostgREST schema cache issues with new columns
-- These functions allow updating the stores table directly via SQL
-- Using JSONB parameter to avoid schema cache issues with named params

-- Update Facebook Messenger connection (takes JSON payload)
CREATE OR REPLACE FUNCTION save_facebook_connection(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID;
  v_page_id TEXT;
  v_access_token TEXT;
  v_page_name TEXT;
BEGIN
  v_store_id := (payload->>'store_id')::UUID;
  v_page_id := payload->>'page_id';
  v_access_token := payload->>'access_token';
  v_page_name := payload->>'page_name';

  UPDATE stores
  SET
    facebook_page_id = v_page_id,
    facebook_page_access_token = v_access_token,
    facebook_page_name = v_page_name,
    facebook_connected_at = NOW()
  WHERE id = v_store_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update Instagram DM connection (takes JSON payload)
CREATE OR REPLACE FUNCTION save_instagram_connection(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id UUID;
  v_instagram_account_id TEXT;
  v_page_name TEXT;
  v_page_id TEXT;
  v_access_token TEXT;
BEGIN
  v_store_id := (payload->>'store_id')::UUID;
  v_instagram_account_id := payload->>'instagram_account_id';
  v_page_name := payload->>'page_name';
  v_page_id := payload->>'page_id';
  v_access_token := payload->>'access_token';

  UPDATE stores
  SET
    instagram_business_account_id = v_instagram_account_id,
    instagram_page_name = v_page_name,
    instagram_connected_at = NOW(),
    facebook_page_id = COALESCE(v_page_id, facebook_page_id),
    facebook_page_access_token = COALESCE(v_access_token, facebook_page_access_token)
  WHERE id = v_store_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Disconnect Facebook Messenger
CREATE OR REPLACE FUNCTION disconnect_facebook_connection(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stores
  SET
    facebook_page_id = NULL,
    facebook_page_access_token = NULL,
    facebook_page_name = NULL,
    facebook_connected_at = NULL
  WHERE id = (payload->>'store_id')::UUID;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Disconnect Instagram DM
CREATE OR REPLACE FUNCTION disconnect_instagram_connection(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stores
  SET
    instagram_business_account_id = NULL,
    instagram_page_name = NULL,
    instagram_connected_at = NULL
  WHERE id = (payload->>'store_id')::UUID;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION save_facebook_connection IS 'Updates Facebook Messenger connection fields for a store';
COMMENT ON FUNCTION save_instagram_connection IS 'Updates Instagram DM connection fields for a store';
COMMENT ON FUNCTION disconnect_facebook_connection IS 'Clears Facebook Messenger connection fields for a store';
COMMENT ON FUNCTION disconnect_instagram_connection IS 'Clears Instagram DM connection fields for a store';
