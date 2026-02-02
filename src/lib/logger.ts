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
    reportToSentry(error, message, context)
  },
}

/**
 * Report an error to Sentry.
 *
 * Sentry is loaded lazily to avoid importing it when not configured.
 * Set SENTRY_DSN environment variable to enable reporting.
 */
function reportToSentry(error: unknown, message: string, context?: LogContext) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  // Lazy import — Sentry is optional and won't crash if not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs')
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
 * Create a child logger with pre-set context fields.
 * Useful for request-scoped logging.
 */
export function createRequestLogger(requestId: string, route: string) {
  const baseContext: LogContext = { requestId, route }

  return {
    debug(msg: string, ctx?: LogContext) { logger.debug(msg, { ...baseContext, ...ctx }) },
    info(msg: string, ctx?: LogContext) { logger.info(msg, { ...baseContext, ...ctx }) },
    warn(msg: string, ctx?: LogContext) { logger.warn(msg, { ...baseContext, ...ctx }) },
    error(msg: string, err?: unknown, ctx?: LogContext) { logger.error(msg, err, { ...baseContext, ...ctx }) },
  }
}
