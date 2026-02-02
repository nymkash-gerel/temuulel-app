import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/health — Health check endpoint for uptime monitoring.
 *
 * Returns:
 * - 200 if the app and database are reachable
 * - 503 if the database is unreachable
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {
    app: 'ok',
    database: 'error',
  }

  // Check Supabase connectivity
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && key) {
    try {
      const supabase = createClient(url, key)
      const { error } = await supabase.from('stores').select('id').limit(1)
      checks.database = error ? 'error' : 'ok'
    } catch {
      checks.database = 'error'
    }
  }

  const healthy = Object.values(checks).every((v) => v === 'ok')

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    },
    { status: healthy ? 200 : 503 }
  )
}
