import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPayoutSchema } from '@/lib/validations'

/**
 * GET /api/driver-payouts
 * List payouts for the store owner's store.
 *
 * POST /api/driver-payouts
 * Create a new payout record.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: payouts } = await supabase
    .from('driver_payouts')
    .select('*, delivery_drivers(id, name, phone)')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ payouts: payouts || [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, createPayoutSchema)
  if (validationError) return validationError

  // Verify driver belongs to store
  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('id, name')
    .eq('id', body.driver_id)
    .eq('store_id', store.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { data: payout, error } = await supabase
    .from('driver_payouts')
    .insert({
      driver_id: body.driver_id,
      store_id: store.id,
      period_start: body.period_start,
      period_end: body.period_end,
      total_amount: body.total_amount,
      delivery_count: body.delivery_count,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payout }, { status: 201 })
}
