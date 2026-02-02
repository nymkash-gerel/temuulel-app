import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/track/[deliveryNumber]/rate
 *
 * Public endpoint for customers to rate their delivery driver.
 * No auth required. Rate limited.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryNumber: string }> }
) {
  const { deliveryNumber } = await params

  // Rate limiting
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  const key = `rate:${ip}`
  if (!ratingRateLimit(key)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: { rating: number; comment?: string; customer_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate rating
  const rating = body.rating
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Үнэлгээ 1-5 хооронд байх ёстой' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch delivery
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, driver_id, store_id, status')
    .eq('delivery_number', deliveryNumber)
    .single()

  if (!delivery) {
    return NextResponse.json({ error: 'Хүргэлт олдсонгүй' }, { status: 404 })
  }

  if (delivery.status !== 'delivered') {
    return NextResponse.json({ error: 'Зөвхөн хүргэгдсэн захиалгад үнэлгээ өгөх боломжтой' }, { status: 400 })
  }

  if (!delivery.driver_id) {
    return NextResponse.json({ error: 'Жолооч оноогдоогүй байна' }, { status: 400 })
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from('driver_ratings')
    .select('id')
    .eq('delivery_id', delivery.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Үнэлгээ өмнө нь өгсөн байна' }, { status: 409 })
  }

  // Insert rating
  const { error } = await supabase
    .from('driver_ratings')
    .insert({
      delivery_id: delivery.id,
      driver_id: delivery.driver_id,
      store_id: delivery.store_id,
      rating,
      comment: body.comment || null,
      customer_name: body.customer_name || null,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Баярлалаа! Үнэлгээ амжилттай бүртгэгдлээ.' })
}

/**
 * GET /api/track/[deliveryNumber]/rate
 *
 * Check if a delivery has already been rated.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryNumber: string }> }
) {
  const { deliveryNumber } = await params
  const supabase = createAdminClient()

  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id')
    .eq('delivery_number', deliveryNumber)
    .single()

  if (!delivery) {
    return NextResponse.json({ rated: false })
  }

  const { data: rating } = await supabase
    .from('driver_ratings')
    .select('rating, comment, customer_name, created_at')
    .eq('delivery_id', delivery.id)
    .single()

  return NextResponse.json({
    rated: !!rating,
    rating: rating || null,
  })
}

// Simple in-memory rate limiter for rating endpoint
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function ratingRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 10) return false
  entry.count++
  return true
}
