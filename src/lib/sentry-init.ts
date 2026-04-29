/**
 * Force Sentry SDK initialization on Vercel serverless lambdas.
 *
 * Background: Next.js 16 + Turbopack does not reliably run
 * `instrumentation.ts → register()` on Vercel serverless functions, so the
 * server-side Sentry SDK never initializes and all `captureException()`
 * calls land in the void.
 *
 * Workaround: this module's top-level code initializes Sentry on first
 * import. Any module that imports this (or imports `@/lib/sentry-helpers`,
 * which re-exports it) will get a working Sentry client.
 *
 * Idempotent — calling Sentry.init() twice is harmless; the second call
 * is ignored. We also short-circuit when a client already exists.
 */
import * as Sentry from '@sentry/nextjs'
import { beforeBreadcrumb, beforeSend } from './sentry-pii'

let initialized = false

export function ensureSentry(): void {
  if (initialized || Sentry.getClient()) {
    initialized = true
    return
  }

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    Sentry.init({
      dsn,
      enabled: true,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      tracesSampleRate:
        process.env.NODE_ENV === 'production'
          ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')
          : 1.0,
      beforeBreadcrumb,
      beforeSend,
    })
    initialized = true
  } catch (err) {
    console.error('Sentry init failed:', err)
  }
}

// Eager init on module import — modules that pull in @/lib/sentry-helpers
// will trigger this transitively.
ensureSentry()
