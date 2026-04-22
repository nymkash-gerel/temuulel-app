-- When a user signs up via Supabase Auth, auth.users gets a row but
-- public.users stays empty. Many FKs (stores.owner_id, etc.) reference
-- public.users — so onboarding fails with "not present in table users".
--
-- Fix: on INSERT INTO auth.users, auto-create a matching public.users row.
-- Also backfill any existing auth.users that are missing from public.users.

-- 1. Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    phone,
    full_name,
    password_hash,
    is_verified,
    email_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'supabase_auth',
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Drop+recreate trigger idempotently
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Backfill: any auth.users missing from public.users gets one row
INSERT INTO public.users (id, email, password_hash, is_verified, email_verified)
SELECT
  au.id,
  au.email,
  'supabase_auth',
  au.email_confirmed_at IS NOT NULL,
  au.email_confirmed_at IS NOT NULL
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
