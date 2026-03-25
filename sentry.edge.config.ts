import * as Sentry from '@sentry/nextjs'
import { beforeBreadcrumb, beforeSend } from '@/lib/sentry-pii'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // PII filtering — scrub phone, email, address, card numbers
  beforeBreadcrumb,
  beforeSend,
})
