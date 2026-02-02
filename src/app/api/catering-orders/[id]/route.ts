import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCateringOrderSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/catering-orders/:id
 *
 * Get a single catering order by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { data: order, error } = await supabase
    .from('catering_orders')
    .select(`
      id, customer_id, customer_name, customer_phone,
      serving_date, serving_time, location_type, address_text,
      guest_count, status, quoted_amount, final_amount,
      logistics_notes, equipment_needed,
      created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Catering order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}

/**
 * PATCH /api/catering-orders/:id
 *
 * Update a catering order.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { data: body, error: validationError } = await validateBody(request, updateCateringOrderSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.quoted_amount !== undefined) updateData.quoted_amount = body.quoted_amount
  if (body.final_amount !== undefined) updateData.final_amount = body.final_amount
  if (body.logistics_notes !== undefined) updateData.logistics_notes = body.logistics_notes
  if (body.address_text !== undefined) updateData.address_text = body.address_text

  const { data: order, error } = await supabase
    .from('catering_orders')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!order) {
    return NextResponse.json({ error: 'Catering order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
