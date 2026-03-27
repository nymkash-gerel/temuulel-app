import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client using the service-role key.
 * Use this in API routes that need to bypass RLS.
 */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}
