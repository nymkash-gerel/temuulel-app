import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/database.types'

// Fallback URL/key allow `next build` to prerender static pages without
// real Supabase credentials.  The client will be non-functional but the
// build won't crash.  At runtime the real env vars are always present.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_KEY) || 'placeholder'

// Singleton — every call returns the same instance so that components using
// `supabase` as a useEffect/useCallback dependency don't trigger infinite
// re-renders (a new object reference would re-run the effect on every render).
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!_client) {
    _client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  }
  return _client
}
