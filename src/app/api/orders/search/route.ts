import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { parsePagination } from '@/lib/validations'

export async function GET(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()

  // Authenticate the user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = (searchParams.get('q') || '').slice(0, 200)
  const { limit, offset } = parsePagination(searchParams)

  let dbQuery = supabase
    .from('orders')
    .select('id, order_number, status, total_amount, tracking_number, created_at', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (query) {
    // Sanitize: remove special PostgREST characters
    const sanitized = query.replace(/[%_.*()]/g, '')
    if (sanitized) {
      dbQuery = dbQuery.or(`order_number.ilike.%${sanitized}%`)
    }
  }

  const { data: orders, error, count } = await dbQuery.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: orders || [],
    count: count ?? 0,
    limit,
    offset,
  })
}
