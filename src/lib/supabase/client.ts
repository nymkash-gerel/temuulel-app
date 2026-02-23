import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/database.types'

// Fallback URL/key allow `next build` to prerender static pages without
// real Supabase credentials.  The client will be non-functional but the
// build won't crash.  At runtime the real env vars are always present.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
