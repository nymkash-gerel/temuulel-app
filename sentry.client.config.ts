import * as Sentry from '@sentry/nextjs'
import { beforeBreadcrumb, beforeSend } from '@/lib/sentry-pii'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — configurable via env, default 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'production'
    ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1')
    : 1.0,

  // Session replay — capture 1% normally, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs in replays for privacy
      maskAllText: true,
      maskAllInputs: true,
    }),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'AbortError',
    'Network request failed',
    'Load failed',
  ],

  // PII filtering — scrub phone, email, address, card numbers
  beforeBreadcrumb,
  beforeSend,
})
