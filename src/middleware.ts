import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  edgeRateLimit,
  getEdgeClientIp,
  shouldSkipRateLimit,
  resolveTier,
  type RateLimitResult,
} from '@/lib/middleware-rate-limit'

function withRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  return response
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Global API rate limiting (before auth, before Supabase calls) ──
  if (pathname.startsWith('/api/')) {
    if (shouldSkipRateLimit(pathname)) {
      return NextResponse.next({ request })
    }

    const clientIp = getEdgeClientIp(request)
    const tier = resolveTier(pathname)
    const result = edgeRateLimit(`mw:${clientIp}:${pathname}`, tier)

    if (!result.success) {
      Sentry.addBreadcrumb({
        category: 'rate_limit',
        message: `Rate limited: ${pathname}`,
        data: { ip: clientIp, limit: result.limit },
        level: 'warning',
      })
      const response = NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 },
      )
      withRateLimitHeaders(response, result)
      response.headers.set(
        'Retry-After',
        String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      )
      return response
    }

    // API routes handle their own auth — skip the Supabase auth block below
    return withRateLimitHeaders(NextResponse.next({ request }), result)
  }

  // ── Page route auth (unchanged) ────────────────────────────────────
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Set Sentry user context for authenticated page routes
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email ?? undefined })
  }

  // Protected dashboard routes
  if (!user && pathname.startsWith('/dashboard')) {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'Unauthenticated dashboard access redirect',
      data: { pathname },
      level: 'info',
    })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Protected driver routes (except login/register)
  const isDriverRoute = pathname.startsWith('/driver')
  const isDriverAuthRoute = pathname.startsWith('/driver/login') || pathname.startsWith('/driver/register')

  if (!user && isDriverRoute && !isDriverAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/driver/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated drivers from driver auth pages to driver dashboard
  if (user && isDriverAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/driver'
    return NextResponse.redirect(url)
  }

  // Allow password reset and email verify pages regardless of auth state
  const publicAuthPaths = ['/forgot-password', '/reset-password', '/verify']
  if (publicAuthPaths.some(p => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // Redirect logged in users from auth pages to dashboard
  if (
    user &&
    (pathname === '/login' || pathname === '/signup')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - embed (embeddable widget — no auth needed)
     * - track (public delivery tracking — no auth needed)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|embed|track|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
