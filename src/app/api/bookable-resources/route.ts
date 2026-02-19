import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createBookableResourceSchema, parsePagination } from '@/lib/validations'
import type { Database } from '@/lib/database.types'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/bookable-resources — List bookable resources for the user's store.
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
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('bookable_resources')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true })

  if (type) query = query.eq('type', type as Database['public']['Tables']['bookable_resources']['Row']['type'])
  if (status) query = query.eq('status', status as Database['public']['Tables']['bookable_resources']['Row']['status'])

  const { data: resources, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ resources: resources ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/bookable-resources — Create a new bookable resource.
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

  const { data: body, error: validationError } = await validateBody(request, createBookableResourceSchema)
  if (validationError) return validationError

  const { data: resource, error } = await supabase
    .from('bookable_resources')
    .insert({
      store_id: store.id,
      ...body,
    } as Database['public']['Tables']['bookable_resources']['Insert'])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ resource }, { status: 201 })
}
