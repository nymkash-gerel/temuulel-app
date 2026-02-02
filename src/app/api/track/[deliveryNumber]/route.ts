import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/track/[deliveryNumber]
 *
 * Public API for customer delivery tracking (no auth required).
 * Returns limited delivery info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deliveryNumber: string }> }
) {
  const { deliveryNumber } = await params

  // Basic rate limiting via header check
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  // Simple in-memory rate limit (production would use Redis)
  const key = `track:${ip}`
  if (!trackingRateLimit(key)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = createAdminClient()

  const { data: delivery } = await supabase
    .from('deliveries')
    .select(`
      delivery_number, status, delivery_address, customer_name,
      estimated_delivery_time, actual_delivery_time, created_at, updated_at,
      delivery_drivers(name, vehicle_type),
      delivery_status_log(status, notes, created_at)
    `)
    .eq('delivery_number', deliveryNumber)
    .single()

  if (!delivery) {
    return NextResponse.json({ error: 'Хүргэлт олдсонгүй' }, { status: 404 })
  }

  // Sort status log
  const statusLog = (delivery.delivery_status_log || []).sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({
    delivery_number: delivery.delivery_number,
    status: delivery.status,
    delivery_address: delivery.delivery_address,
    customer_name: delivery.customer_name,
    estimated_delivery_time: delivery.estimated_delivery_time,
    actual_delivery_time: delivery.actual_delivery_time,
    created_at: delivery.created_at,
    updated_at: delivery.updated_at,
    driver: delivery.delivery_drivers ? {
      name: (delivery.delivery_drivers as { name: string }).name,
      vehicle_type: (delivery.delivery_drivers as { vehicle_type: string }).vehicle_type,
    } : null,
    status_log: statusLog.map((log: { status: string; notes: string | null; created_at: string }) => ({
      status: log.status,
      notes: log.notes,
      created_at: log.created_at,
    })),
  })
}

// Simple in-memory rate limiter for tracking endpoint
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function trackingRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 30) return false
  entry.count++
  return true
}
