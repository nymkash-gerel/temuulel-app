/**
 * Structured logger for API routes and server-side code.
 *
 * In production, errors are reported to Sentry (if configured).
 * All logs use structured JSON format for easy parsing by log aggregators.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry)
  }

  // Dev: readable format
  const prefix = `[${level.toUpperCase()}]`
  const ctx = context ? ` ${JSON.stringify(context)}` : ''
  return `${prefix} ${message}${ctx}`
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) console.debug(formatLog('debug', message, context))
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) console.info(formatLog('info', message, context))
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, context))
  },

  error(message: string, error?: unknown, context?: LogContext) {
    if (!shouldLog('error')) return

    const errorContext: LogContext = { ...context }
    if (error instanceof Error) {
      errorContext.error_name = error.name
      errorContext.error_message = error.message
      errorContext.stack = error.stack
    } else if (error !== undefined) {
      errorContext.error_raw = String(error)
    }

    console.error(formatLog('error', message, errorContext))

    // Report to Sentry if configured
    void reportToSentry(error, message, context)
  },
}

/**
 * Report an error to Sentry.
 *
 * Sentry is loaded lazily to avoid importing it when not configured.
 * Set SENTRY_DSN environment variable to enable reporting.
 */
async function reportToSentry(error: unknown, message: string, context?: LogContext) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  // Lazy import — Sentry is optional and won't crash if not installed
  try {
    const Sentry = await import('@sentry/nextjs')
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...context } })
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: { error, ...context } })
    }
  } catch {
    // Sentry not installed — that's fine, we already logged to console
  }
}

/**
 * Optional enrichment context for request-scoped logging and Sentry scope.
 */
interface RequestLoggerOptions {
  userId?: string
  storeId?: string
  [key: string]: unknown
}

/**
 * Create a child logger with pre-set context fields.
 * Useful for request-scoped logging.
 *
 * When `options` is provided, Sentry scope is also enriched with
 * requestId, route, userId, and storeId tags.
 */
export function createRequestLogger(
  requestId: string,
  route: string,
  options?: RequestLoggerOptions,
) {
  const baseContext: LogContext = { requestId, route, ...options }

  // Set Sentry scope (lazy, fire-and-forget)
  void setSentryScope(requestId, route, options)

  return {
    debug(msg: string, ctx?: LogContext) { logger.debug(msg, { ...baseContext, ...ctx }) },
    info(msg: string, ctx?: LogContext) { logger.info(msg, { ...baseContext, ...ctx }) },
    warn(msg: string, ctx?: LogContext) { logger.warn(msg, { ...baseContext, ...ctx }) },
    error(msg: string, err?: unknown, ctx?: LogContext) { logger.error(msg, err, { ...baseContext, ...ctx }) },
  }
}

/**
 * Set Sentry scope tags for the current request.
 * Lazy import — only runs when SENTRY_DSN is configured.
 */
async function setSentryScope(
  requestId: string,
  route: string,
  options?: RequestLoggerOptions,
) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.setTag('requestId', requestId)
    Sentry.setTag('route', route)
    if (options?.userId) {
      Sentry.setUser({ id: options.userId })
      Sentry.setTag('userId', options.userId)
    }
    if (options?.storeId) {
      Sentry.setTag('storeId', options.storeId)
    }
  } catch {
    // Sentry not available — fine
  }
}
