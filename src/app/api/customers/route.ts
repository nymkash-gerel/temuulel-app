import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createCustomerSchema, parsePagination } from '@/lib/validations'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/customers — List customers for the user's store.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const channel = searchParams.get('channel')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (channel) query = query.eq('channel', channel)
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: customers, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ customers: customers ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/customers — Create a new customer.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, createCustomerSchema)
  if (validationError) return validationError

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      store_id: store.id,
      name: body.name ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      channel: body.channel ?? 'manual',
      address: body.address ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ customer }, { status: 201 })
}
