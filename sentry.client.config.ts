import * as Sentry from '@sentry/nextjs'

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
    Sentry.replayIntegration(),
  ],

  // Filter out noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'AbortError',
    'Network request failed',
    'Load failed',
  ],

  // PII filtering — scrub sensitive customer data before sending to Sentry
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      const sensitiveKeys = ['phone', 'password', 'address', 'credit_card', 'card_number', 'cvv']
      for (const key of sensitiveKeys) {
        if (key in data) data[key] = '[REDACTED]'
      }
    }
    return event
  },
})
