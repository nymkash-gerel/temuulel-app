import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createGuestSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/guests
 *
 * List guests for the store. Supports search on first_name/last_name.
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
  const search = searchParams.get('search')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('guests')
    .select(`
      id, first_name, last_name, document_type, document_number, nationality, phone, email, vip_level, notes, customer_id, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/guests
 *
 * Create a new guest.
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

  const { data: body, error: validationError } = await validateBody(request, createGuestSchema)
  if (validationError) return validationError

  const { data: guest, error } = await supabase
    .from('guests')
    .insert({
      store_id: store.id,
      first_name: body.first_name,
      last_name: body.last_name,
      customer_id: body.customer_id || null,
      document_type: body.document_type || null,
      document_number: body.document_number || null,
      nationality: body.nationality || null,
      phone: body.phone || null,
      email: body.email || null,
      vip_level: body.vip_level || undefined,
      notes: body.notes || null,
    })
    .select(`
      id, first_name, last_name, document_type, document_number, nationality, phone, email, vip_level, notes, customer_id, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(guest, { status: 201 })
}
