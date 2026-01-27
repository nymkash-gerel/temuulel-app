import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const storeId = searchParams.get('store_id')

  const supabase = await createClient()

  let dbQuery = supabase
    .from('orders')
    .select('id, order_number, status, total_amount, tracking_number, created_at')
    .order('created_at', { ascending: false })

  if (storeId) {
    dbQuery = dbQuery.eq('store_id', storeId)
  }

  if (query) {
    dbQuery = dbQuery.or(`order_number.ilike.%${query}%`)
  }

  const { data: orders, error } = await dbQuery.limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: orders || [], count: (orders || []).length })
}
