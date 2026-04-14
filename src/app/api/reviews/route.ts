import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
)

/**
 * GET /api/reviews?store_id=X&product_id=Y
 * Returns reviews (public endpoint for widget)
 */
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('store_id')
  const productId = req.nextUrl.searchParams.get('product_id')
  if (!storeId) return NextResponse.json({ error: 'store_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb.from('reviews').select('id, rating, comment, created_at, product_id').eq('store_id', storeId)
  if (productId) query = query.eq('product_id', productId)
  query = query.order('created_at', { ascending: false }).limit(50)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate
  const ratings = (data || []).map((r: { rating: number }) => r.rating)
  const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0
  return NextResponse.json({ reviews: data, count: ratings.length, avg: Math.round(avg * 10) / 10 })
}

/**
 * POST /api/reviews — public submission
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { store_id, customer_id, order_id, product_id, rating, comment } = body as {
    store_id: string; customer_id?: string; order_id?: string; product_id?: string
    rating: number; comment?: string
  }
  if (!store_id || !rating) return NextResponse.json({ error: 'store_id + rating required' }, { status: 400 })
  if (rating < 1 || rating > 5) return NextResponse.json({ error: 'rating 1-5' }, { status: 400 })

  const { data, error } = await sb.from('reviews').insert({
    store_id, customer_id, order_id, product_id, rating, comment: comment?.substring(0, 1000) || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data }, { status: 201 })
}
