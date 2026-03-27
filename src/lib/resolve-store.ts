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

/** Columns returned by resolveStore – every field callers actually read. */
const STORE_COLUMNS = [
  'id',
  'name',
  'slug',
  'owner_id',
  'address',
  'phone',
  'email',
  'website',
  'description',
  'logo_url',
  'business_type',
  'ai_auto_reply',
  'busy_mode',
  'busy_message',
  'estimated_wait_minutes',
  'api_key',
  'chatbot_settings',
  'delivery_settings',
  'delivery_time_slots',
  'shipping_settings',
  'payment_settings',
  'product_settings',
  'enabled_modules',
  'webhook_url',
  'webhook_secret',
  'webhook_events',
  'facebook_page_id',
  'facebook_page_name',
  'facebook_connected_at',
  'instagram_business_account_id',
  'instagram_page_name',
  'instagram_connected_at',
].join(', ')

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
    .select(STORE_COLUMNS)
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
    .select(STORE_COLUMNS)
    .eq('id', membership.store_id)
    .single()

  return memberStore
}
