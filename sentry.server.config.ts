import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  // Performance monitoring — configurable via env, default 10% in production
  tracesSampleRate: process.env.NODE_ENV === 'production'
    ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1')
    : 1.0,

  // PII filtering — scrub sensitive customer data before sending to Sentry
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>
      const sensitiveKeys = ['phone', 'password', 'address', 'credit_card', 'card_number', 'cvv']
      for (const key of sensitiveKeys) {
        if (key in data) data[key] = '[REDACTED]'
      }
    }
    // Scrub sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
    }
    return event
  },
})
