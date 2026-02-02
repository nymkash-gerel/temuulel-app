import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, closePosSessionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/pos/sessions/:id
 *
 * Get a single POS session by id.
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
    .from('pos_sessions')
    .select(`
      id, opened_by, closed_by, register_name, opening_cash, closing_cash, total_sales, total_transactions, status, opened_at, closed_at, created_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'POS session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * PATCH /api/pos/sessions/:id
 *
 * Close a POS session.
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

  // Verify the user has a staff record
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('store_id', store.id)
    .eq('user_id', user.id)
    .single()

  if (!staff) {
    return NextResponse.json({ error: 'Staff record not found for this user' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, closePosSessionSchema)
  if (validationError) return validationError

  const { data: session, error } = await supabase
    .from('pos_sessions')
    .update({
      closed_by: staff.id,
      closing_cash: body.closing_cash,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, opened_by, closed_by, register_name, opening_cash, closing_cash, total_sales, total_transactions, status, opened_at, closed_at, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'POS session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}
