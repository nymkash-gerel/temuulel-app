import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, openPosSessionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/pos/sessions
 *
 * List POS sessions for the store.
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
  const { limit, offset } = parsePagination(searchParams)

  const { data, count, error } = await supabase
    .from('pos_sessions')
    .select(`
      id, opened_by, closed_by, register_name, opening_cash, closing_cash, total_sales, total_transactions, status, opened_at, closed_at, created_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/pos/sessions
 *
 * Open a new POS session.
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

  const { data: body, error: validationError } = await validateBody(request, openPosSessionSchema)
  if (validationError) return validationError

  const { data: session, error } = await supabase
    .from('pos_sessions')
    .insert({
      store_id: store.id,
      opened_by: staff.id,
      register_name: body.register_name || undefined,
      opening_cash: body.opening_cash || 0,
      status: 'open',
      opened_at: new Date().toISOString(),
    })
    .select(`
      id, opened_by, closed_by, register_name, opening_cash, closing_cash, total_sales, total_transactions, status, opened_at, closed_at, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(session, { status: 201 })
}
