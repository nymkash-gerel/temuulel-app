import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCateringOrderSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/catering-orders
 *
 * List catering orders for the store. Supports filtering by status.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['inquiry', 'confirmed', 'preparing', 'dispatched', 'served', 'closed', 'cancelled'] as const

  let query = supabase
    .from('catering_orders')
    .select(`
      id, customer_id, customer_name, customer_phone,
      serving_date, serving_time, location_type, address_text,
      guest_count, status, quoted_amount, final_amount,
      logistics_notes, equipment_needed,
      created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('serving_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/catering-orders
 *
 * Create a new catering order.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, createCateringOrderSchema)
  if (validationError) return validationError

  const { data: order, error } = await supabase
    .from('catering_orders')
    .insert({
      store_id: store.id,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_id: body.customer_id || null,
      serving_date: body.serving_date,
      serving_time: body.serving_time,
      location_type: body.location_type || 'on_site',
      address_text: body.address_text || null,
      guest_count: body.guest_count,
      logistics_notes: body.logistics_notes || null,
      equipment_needed: ([] as unknown) as Json,
    })
    .select(`
      id, customer_id, customer_name, customer_phone,
      serving_date, serving_time, location_type, address_text,
      guest_count, status, quoted_amount, final_amount,
      logistics_notes, equipment_needed,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: order }, { status: 201 })
}
