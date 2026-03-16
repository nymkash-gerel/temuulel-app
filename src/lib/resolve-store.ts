import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * Resolve the store for the current user.
 * Checks ownership first, then team membership.
 * Use this instead of `.eq('owner_id', user.id)` to support team members.
 */
export async function resolveStoreId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  // Check as owner first
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (store) return store.id

  // Check as team member
  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .single()

  return membership?.store_id ?? null
}

/**
 * Resolve the full store object for the current user.
 */
export async function resolveStore(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  // Check as owner first
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', userId)
    .single()

  if (store) return store

  // Check as team member
  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .single()

  if (!membership) return null

  const { data: memberStore } = await supabase
    .from('stores')
    .select('*')
    .eq('id', membership.store_id)
    .single()

  return memberStore
}
