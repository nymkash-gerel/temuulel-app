import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Track server start time for uptime calculation
const serverStartTime = Date.now()

interface HealthCheck {
  status: 'ok' | 'error'
  latency_ms?: number
}

/**
 * GET /api/health — Health check endpoint for uptime monitoring.
 *
 * Returns:
 * - 200 if the app and database are reachable
 * - 503 if the database is unreachable
 *
 * Designed for use with:
 * - UptimeRobot (free tier: 50 monitors, 5-min intervals)
 * - Vercel's built-in monitoring
 * - Any HTTP-based uptime service
 */
export async function GET() {
  const checks: Record<string, HealthCheck> = {
    app: { status: 'ok' },
    database: { status: 'error' },
  }

  // Service availability (env vars configured)
  const services = {
    facebook: !!process.env.FACEBOOK_APP_SECRET,
    openai: !!process.env.OPENAI_API_KEY,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    sentry: !!process.env.SENTRY_DSN,
  }

  // Check Supabase connectivity with latency measurement
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && key) {
    const dbStart = Date.now()
    try {
      const supabase = createClient(url, key)
      const { error } = await supabase.from('stores').select('id').limit(1)
      const latency = Date.now() - dbStart
      checks.database = {
        status: error ? 'error' : 'ok',
        latency_ms: latency,
      }
    } catch {
      checks.database = { status: 'error', latency_ms: Date.now() - dbStart }
    }
  }

  const healthy = Object.values(checks).every((c) => c.status === 'ok')
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000)

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      services,
      uptime_seconds: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
