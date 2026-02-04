/**
 * Thin Sentry helpers for server-side route instrumentation.
 * All functions are safe to call when Sentry is not configured — they become no-ops.
 *
 * Uses lazy `await import('@sentry/nextjs')` to avoid hard dependency in tests
 * and local dev where SENTRY_DSN is unset.
 */

type SpanCallback<T> = () => Promise<T>

/**
 * Wrap an async operation in a Sentry performance span.
 * If Sentry is not configured, the callback runs normally.
 */
export async function withSpan<T>(
  name: string,
  op: string,
  cb: SpanCallback<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  if (!process.env.SENTRY_DSN) return cb()

  try {
    const Sentry = await import('@sentry/nextjs')
    return await Sentry.startSpan({ name, op, attributes }, () => cb())
  } catch {
    return cb()
  }
}

/**
 * Add a breadcrumb to the current Sentry scope.
 */
export async function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  if (!process.env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.addBreadcrumb({ category, message, data, level })
  } catch {
    // no-op
  }
}

/**
 * Set Sentry user context from auth result.
 */
export async function setSentryUser(
  userId: string,
  email?: string,
): Promise<void> {
  if (!process.env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.setUser({ id: userId, email })
  } catch {
    // no-op
  }
}
