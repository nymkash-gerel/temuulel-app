import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@/lib/ai/analytics-insight'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, analyticsInsightsSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: stats, error: validationError } = await validateBody(request, analyticsInsightsSchema)
  if (validationError) return validationError

  const result = await generateInsights(stats)

  if (!result) {
    return NextResponse.json({ insights: null })
  }

  return NextResponse.json({
    insights: result.insights,
    tone: result.tone,
    generated_at: new Date().toISOString(),
  })
}
