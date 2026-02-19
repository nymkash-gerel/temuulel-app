import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per 60 seconds
  const rl = rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(
    new URL('/driver/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    { status: 302 }
  )
}
