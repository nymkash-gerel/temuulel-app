import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function safeRedirect(origin: string, next: string | null): string {
  const fallback = `${origin}/dashboard`
  if (!next) return fallback
  // Must start with / and not start with // (protocol-relative URL)
  if (!next.startsWith('/') || next.startsWith('//')) return fallback
  // Block backslash tricks (e.g. /\evil.com)
  if (next.includes('\\')) return fallback
  // Only allow path characters
  if (!/^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(next)) return fallback
  return `${origin}${next}`
}

export async function GET(request: NextRequest) {
  // Rate limit: 5 requests per 60 seconds
  const rl = await rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(safeRedirect(origin, next))
    }
  }

  // If code exchange failed, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
