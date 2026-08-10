import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

function serviceCredentials(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return { url, key }
}

/**
 * Create a Supabase client using the service-role key.
 * Use this in API routes that need to bypass RLS.
 *
 * Untyped: the compiler checks nothing about the tables or columns you touch.
 * Prefer getTypedSupabase() in new code.
 */
export function getSupabase() {
  const { url, key } = serviceCredentials()
  return createClient(url, key)
}

/**
 * Same service-role client, but typed against the generated schema, so the
 * compiler rejects a table or column that does not exist.
 *
 * This is not a stylistic preference. The Stripe webhook shipped writing
 * `stripe_customer_id`/`stripe_subscription_id`/`plan` to a table that has none
 * of them; every call would have failed at runtime with a 42703, and nothing
 * caught it because the untyped client accepts any object for any table. Use
 * this one for anything new.
 *
 * getSupabase() is kept untyped only because its other call sites do not
 * typecheck against the schema yet — turning it on surfaces pre-existing
 * mismatches in chat, messenger and payment-followup. Migrate those files to
 * this function one at a time, then collapse the two back into one.
 */
export function getTypedSupabase() {
  const { url, key } = serviceCredentials()
  return createClient<Database>(url, key)
}
