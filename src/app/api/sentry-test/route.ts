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

  // Diagnostic: confirm SDK is actually initialized in this lambda
  const client = Sentry.getClient()
  const dsn = client?.getDsn?.()
  const hub = !!client
  console.log(`[sentry-debug] hub=${hub} dsn_host=${dsn?.host ?? 'none'} dsn_proj=${dsn?.projectId ?? 'none'}`)

  const err = new Error(`[sentry-test-${stamp}] intentional error`)
  const eventId = Sentry.captureException(err, {
    level: 'error',
    fingerprint: ['sentry-test', String(stamp)],
    tags: { test: 'sentry-slack-pipeline', stamp: String(stamp) },
  })
  console.log(`[sentry-debug] captureException returned eventId=${eventId}`)

  const flushed = await Sentry.flush(8000)
  console.log(`[sentry-debug] flush returned ${flushed}`)

  return NextResponse.json({
    eventId,
    flushed,
    hub,
    dsnHost: dsn?.host ?? null,
    dsnProj: dsn?.projectId ?? null,
    stamp,
  })
}
