import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_TIME_SLOTS = [
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
]

/**
 * GET /api/deliveries/time-slots
 *
 * Returns the store's configured delivery time slots.
 * Falls back to default slots if not configured.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('delivery_time_slots')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const slots = Array.isArray(store.delivery_time_slots) && store.delivery_time_slots.length > 0
    ? store.delivery_time_slots
    : DEFAULT_TIME_SLOTS

  return NextResponse.json({ time_slots: slots })
}
