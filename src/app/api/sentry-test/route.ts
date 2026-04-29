import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint that throws an uncaught error so we can verify the
 * Sentry → Slack alert pipeline. Protected by a token to prevent abuse.
 *
 * Usage: GET /api/sentry-test?token=<SENTRY_TEST_TOKEN>
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const expected = process.env.SENTRY_TEST_TOKEN

  if (!expected) {
    return NextResponse.json(
      { error: 'SENTRY_TEST_TOKEN not configured' },
      { status: 503 },
    )
  }
  if (token !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Throw so Sentry captures + Slack alert fires
  const stamp = new Date().toISOString()
  throw new Error(`[sentry-test] Triggered intentional error at ${stamp}`)
}
