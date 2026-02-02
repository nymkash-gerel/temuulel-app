import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

  const pathname = request.nextUrl.pathname

  // Protected dashboard routes
  if (!user && pathname.startsWith('/dashboard')) {
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
