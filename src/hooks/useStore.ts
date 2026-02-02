import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/database.types'

interface Store {
  id: string
  name: string
  business_type: string | null
  shipping_settings: Json | null
  payment_settings: Json | null
  chatbot_settings: Json | null
}

async function fetchStore(): Promise<Store | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, business_type, shipping_settings, payment_settings, chatbot_settings')
    .eq('owner_id', user.id)
    .single()

  return store ?? null
}

/**
 * SWR hook for the current user's store.
 * Deduplicates requests and caches across components.
 */
export function useStore() {
  const { data, error, isLoading, mutate } = useSWR('current-store', fetchStore, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })

  return {
    store: data ?? null,
    isLoading,
    error,
    mutate,
  }
}
