import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const generatePayoutSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driver_id: z.string().uuid().optional(),
})

/**
 * POST /api/driver-payouts/generate
 *
 * Auto-generate payouts from completed deliveries for a date range.
 * Groups by driver, sums delivery_fee, counts deliveries.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, generatePayoutSchema)
  if (validationError) return validationError

  const { period_start, period_end, driver_id } = body

  // Get completed deliveries in date range
  let query = supabase
    .from('deliveries')
    .select('id, driver_id, delivery_fee')
    .eq('store_id', store.id)
    .eq('status', 'delivered')
    .gte('created_at', `${period_start}T00:00:00`)
    .lte('created_at', `${period_end}T23:59:59`)
    .not('driver_id', 'is', null)

  if (driver_id) {
    query = query.eq('driver_id', driver_id)
  }

  const { data: deliveries, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ error: 'Энэ хугацаанд хүргэгдсэн захиалга олдсонгүй', payouts: [] }, { status: 200 })
  }

  // Get existing payouts to check for overlapping periods
  const { data: existingPayouts } = await supabase
    .from('driver_payouts')
    .select('driver_id, period_start, period_end')
    .eq('store_id', store.id)
    .in('status', ['pending', 'approved', 'paid'])

  const existingSet = new Set(
    (existingPayouts || []).map(p => `${p.driver_id}:${p.period_start}:${p.period_end}`)
  )

  // Group by driver
  const driverGroups = new Map<string, { totalAmount: number; count: number }>()
  for (const d of deliveries) {
    if (!d.driver_id) continue
    const existing = driverGroups.get(d.driver_id)
    if (existing) {
      existing.totalAmount += Number(d.delivery_fee) || 0
      existing.count++
    } else {
      driverGroups.set(d.driver_id, {
        totalAmount: Number(d.delivery_fee) || 0,
        count: 1,
      })
    }
  }

  // Create payouts
  const payoutsToInsert = []
  const skipped = []

  for (const [driverId, stats] of driverGroups) {
    const key = `${driverId}:${period_start}:${period_end}`
    if (existingSet.has(key)) {
      skipped.push(driverId)
      continue
    }
    payoutsToInsert.push({
      driver_id: driverId,
      store_id: store.id,
      period_start,
      period_end,
      total_amount: stats.totalAmount,
      delivery_count: stats.count,
      status: 'pending' as const,
      notes: `Автомат тооцоолсон: ${period_start} — ${period_end}`,
    })
  }

  if (payoutsToInsert.length === 0) {
    return NextResponse.json({
      payouts: [],
      message: skipped.length > 0
        ? 'Бүх жолоочийн төлбөр энэ хугацаанд аль хэдийн үүсгэсэн байна'
        : 'Үүсгэх төлбөр олдсонгүй',
    })
  }

  const { data: created, error: insertError } = await supabase
    .from('driver_payouts')
    .insert(payoutsToInsert)
    .select('*, delivery_drivers(id, name, phone)')

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({
    payouts: created || [],
    created_count: payoutsToInsert.length,
    skipped_count: skipped.length,
  })
}
