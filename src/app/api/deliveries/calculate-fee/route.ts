import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/validations'
import { calculateDeliveryFee, getDeliveryZones } from '@/lib/delivery-fee-calculator'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'

const calculateFeeSchema = z.object({
  address: z.string().min(3),
})

/**
 * POST /api/deliveries/calculate-fee
 *
 * Calculate delivery fee based on address. Returns fee, zone, and district.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: body, error: validationError } = await validateBody(request, calculateFeeSchema)
  if (validationError) return validationError

  const result = calculateDeliveryFee(body.address)
  return NextResponse.json(result)
}

/**
 * GET /api/deliveries/calculate-fee
 *
 * Returns all delivery zones with districts and fees.
 */
export async function GET() {
  return NextResponse.json({ zones: getDeliveryZones() })
}
