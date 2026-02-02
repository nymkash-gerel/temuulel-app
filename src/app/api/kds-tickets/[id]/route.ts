import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateKdsTicketSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/kds-tickets/:id
 *
 * Get a single KDS ticket by id.
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

  const { data: ticket, error } = await supabase
    .from('kds_tickets')
    .select(`
      id, station_id, order_id, table_session_id, items, priority, status,
      started_at, completed_at, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !ticket) {
    return NextResponse.json({ error: 'KDS ticket not found' }, { status: 404 })
  }

  return NextResponse.json(ticket)
}

/**
 * PATCH /api/kds-tickets/:id
 *
 * Update a KDS ticket. Auto-sets started_at when status changes to 'preparing',
 * and completed_at when status changes to 'ready' or 'served'.
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

  const { data: body, error: validationError } = await validateBody(request, updateKdsTicketSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.priority !== undefined) updateData.priority = body.priority

  // Auto-set started_at when status changes to 'preparing'
  if (body.status === 'preparing') {
    updateData.started_at = new Date().toISOString()
  }

  // Auto-set completed_at when status changes to 'ready' or 'served'
  if (body.status === 'ready' || body.status === 'served') {
    updateData.completed_at = new Date().toISOString()
  }

  const { data: ticket, error } = await supabase
    .from('kds_tickets')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, station_id, order_id, table_session_id, items, priority, status,
      started_at, completed_at, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!ticket) {
    return NextResponse.json({ error: 'KDS ticket not found' }, { status: 404 })
  }

  return NextResponse.json(ticket)
}
