import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

/**
 * Test endpoint that captures an error explicitly so we can verify the
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

  // Explicit capture (Next.js 16 + Turbopack route handlers don't
  // always auto-capture thrown errors). Use a unique timestamped message
  // so each call creates a new issue rather than deduplicating.
  const stamp = Date.now()
  const err = new Error(`[sentry-test-${stamp}] intentional error`)
  Sentry.captureException(err, {
    level: 'error',
    tags: { test: 'sentry-slack-pipeline', stamp: String(stamp) },
  })
  // Flush so Vercel doesn't kill the lambda before Sentry sends the event
  await Sentry.flush(5000)

  // Also throw so the response is 500 (extra coverage)
  throw err
}
