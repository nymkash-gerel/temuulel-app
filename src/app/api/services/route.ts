import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createServiceSchema, parsePagination } from '@/lib/validations'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/services — List services for the user's store.
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
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('services')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'active' | 'draft' | 'archived')
  if (category) query = query.eq('category', category)

  const { data: services, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ services: services ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/services — Create a new service.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
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

  const { data: body, error: validationError } = await validateBody(request, createServiceSchema)
  if (validationError) return validationError

  const { data: service, error } = await supabase
    .from('services')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      duration_minutes: body.duration_minutes,
      base_price: body.base_price,
      status: body.status,
      ai_context: body.ai_context ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ service }, { status: 201 })
}
