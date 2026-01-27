/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per key (typically IP address).
 * Suitable for single-instance deployments. For multi-instance production,
 * replace with Redis-backed rate limiting (e.g. Upstash).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean expired entries to avoid memory leaks
const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  limit: number
  /** Window size in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Check if a request should be rate-limited.
 *
 * @param key - Unique identifier (e.g. IP address, user ID)
 * @param options - Rate limit configuration
 * @returns Result with success flag and rate limit headers info
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  cleanup()

  const now = Date.now()
  const windowMs = options.windowSeconds * 1000
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
    }
  }

  // Existing window
  entry.count++
  const remaining = Math.max(0, options.limit - entry.count)

  return {
    success: entry.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

/**
 * Extract client IP from a Next.js request.
 * Falls back to 'unknown' if no IP is available.
 */
export function getClientIp(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  return forwarded || 'unknown'
}
