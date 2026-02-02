import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateTableSessionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/table-sessions/:id
 *
 * Get a single table session by id with table layout join.
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

  const { data: session, error } = await supabase
    .from('table_sessions')
    .select(`
      id, table_id, server_id, guest_count, seated_at, closed_at, status, notes,
      created_at, updated_at,
      table_layouts(id, name, section, capacity)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Table session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * PATCH /api/table-sessions/:id
 *
 * Update a table session. Auto-sets closed_at when status changes to 'closed'.
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

  const { data: body, error: validationError } = await validateBody(request, updateTableSessionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.server_id !== undefined) updateData.server_id = body.server_id
  if (body.guest_count !== undefined) updateData.guest_count = body.guest_count
  if (body.notes !== undefined) updateData.notes = body.notes

  // Auto-set closed_at when status changes to 'closed'
  if (body.status === 'closed') {
    updateData.closed_at = new Date().toISOString()
  }

  const { data: session, error } = await supabase
    .from('table_sessions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, table_id, server_id, guest_count, seated_at, closed_at, status, notes,
      created_at, updated_at,
      table_layouts(id, name, section, capacity)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Table session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}
