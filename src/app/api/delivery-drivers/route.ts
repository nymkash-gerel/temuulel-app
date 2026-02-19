import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createDriverSchema, parsePagination } from '@/lib/validations'
import type { Database } from '@/lib/database.types'

/**
 * GET /api/delivery-drivers
 *
 * List delivery drivers for the authenticated user's store.
 * Supports filtering by status and vehicle_type.
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
  const vehicleType = searchParams.get('vehicle_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('delivery_drivers')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status as Database['public']['Tables']['delivery_drivers']['Row']['status'])
  }
  if (vehicleType) {
    query = query.eq('vehicle_type', vehicleType as 'motorcycle' | 'car' | 'bicycle' | 'on_foot')
  }

  const { data: drivers, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ drivers: drivers ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/delivery-drivers
 *
 * Create a new delivery driver for the store.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, createDriverSchema)
  if (validationError) return validationError

  const { data: driver, error } = await supabase
    .from('delivery_drivers')
    .insert({
      store_id: store.id,
      ...body,
    } as Database['public']['Tables']['delivery_drivers']['Insert'])
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Driver with this phone already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ driver }, { status: 201 })
}
