import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/rack-locations/:id
 *
 * Get a single rack location by id.
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

  const { data: rack, error } = await supabase
    .from('rack_locations')
    .select(`
      id, rack_number, order_id, status, created_at, updated_at,
      laundry_orders(id, order_number, status)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !rack) {
    return NextResponse.json({ error: 'Rack location not found' }, { status: 404 })
  }

  return NextResponse.json(rack)
}

/**
 * PATCH /api/rack-locations/:id
 *
 * Assign or release an order from a rack location.
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

  const body = await request.json()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.order_id !== undefined) {
    if (body.order_id === null) {
      // Release: clear order and set status to empty
      updateData.order_id = null
      updateData.status = 'empty'
    } else {
      // Assign: set order and status to occupied
      updateData.order_id = body.order_id
      updateData.status = 'occupied'
    }
  }

  if (body.status !== undefined && body.order_id === undefined) {
    updateData.status = body.status
  }

  const { data: rack, error } = await supabase
    .from('rack_locations')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, rack_number, order_id, status, created_at, updated_at,
      laundry_orders(id, order_number, status)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rack) {
    return NextResponse.json({ error: 'Rack location not found' }, { status: 404 })
  }

  return NextResponse.json(rack)
}
