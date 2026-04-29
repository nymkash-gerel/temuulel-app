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

  // Explicit capture with unique fingerprint per call. Sentry groups
  // events by fingerprint (stack trace by default) — using a unique
  // fingerprint forces each call to land as a new issue, which is what
  // triggers the "new issue created" alert rule.
  const stamp = Date.now()
  const err = new Error(`[sentry-test-${stamp}] intentional error`)
  Sentry.withScope((scope) => {
    scope.setLevel('error')
    scope.setFingerprint(['sentry-test', String(stamp)])
    scope.setTag('test', 'sentry-slack-pipeline')
    scope.setTag('stamp', String(stamp))
    Sentry.captureException(err)
  })
  await Sentry.flush(5000)

  throw err
}
