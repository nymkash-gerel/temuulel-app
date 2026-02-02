import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createSupplierSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/suppliers
 *
 * List suppliers for the store. Supports search on name.
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
    .from('suppliers')
    .select(`
      id, name, contact_name, email, phone, address, payment_terms, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/suppliers
 *
 * Create a new supplier.
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

  const { data: body, error: validationError } = await validateBody(request, createSupplierSchema)
  if (validationError) return validationError

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .insert({
      store_id: store.id,
      name: body.name,
      contact_name: body.contact_name || null,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      payment_terms: body.payment_terms || undefined,
    })
    .select(`
      id, name, contact_name, email, phone, address, payment_terms, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(supplier, { status: 201 })
}
