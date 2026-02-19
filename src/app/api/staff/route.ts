import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { Json } from '@/lib/database.types'
import { validateBody, createStaffSchema, parsePagination } from '@/lib/validations'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/staff — List staff members for the user's store.
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
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('staff')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('name', { ascending: true })

  if (status) query = query.eq('status', status as 'active' | 'inactive')

  const { data: staff, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ staff: staff ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/staff — Create a new staff member.
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

  const { data: body, error: validationError } = await validateBody(request, createStaffSchema)
  if (validationError) return validationError

  const { data: staff, error } = await supabase
    .from('staff')
    .insert({
      store_id: store.id,
      name: body.name,
      phone: body.phone ?? null,
      email: body.email ?? null,
      specialties: body.specialties ?? null,
      working_hours: (body.working_hours as Json) ?? {},
      status: body.status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ staff }, { status: 201 })
}
