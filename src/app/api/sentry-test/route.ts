import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
// Force Sentry init via shared module (instrumentation.ts unreliable on
// Next.js 16 + Turbopack + Vercel)
import '@/lib/sentry-init'

/**
 * Test endpoint that captures an error so we can verify the Sentry → Slack
 * alert pipeline. Protected by SENTRY_TEST_TOKEN to prevent abuse.
 *
 * Usage: GET /api/sentry-test?token=<SENTRY_TEST_TOKEN>
 *
 * Each call creates a new issue (unique fingerprint) so the alert rule
 * fires every time.
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

  const stamp = Date.now()
  const err = new Error(`[sentry-test-${stamp}] intentional error`)
  const eventId = Sentry.captureException(err, {
    level: 'error',
    fingerprint: ['sentry-test', String(stamp)],
    tags: { test: 'sentry-slack-pipeline', stamp: String(stamp) },
  })
  await Sentry.flush(8000)

  return NextResponse.json({
    ok: true,
    eventId,
    message: 'Sentry event captured. Check Slack alert + Sentry issues page.',
  })
}
