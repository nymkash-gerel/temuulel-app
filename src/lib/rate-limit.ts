/**
 * Rate limiter for API routes.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is configured (production),
 * falling back to an in-memory sliding window counter (development).
 *
 * The Upstash-backed limiter shares state across all Vercel serverless
 * instances, making rate limits effective in production.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './redis'

// ---------------------------------------------------------------------------
// In-memory fallback (development / when Redis is not configured)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 60_000 // 1 minute
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) {
      memoryStore.delete(key)
    }
  }
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    memoryStore.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt,
    }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)

  return {
    success: entry.count <= limit,
    limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

// ---------------------------------------------------------------------------
// Upstash Redis rate limiter cache (keyed by "limit:window")
// ---------------------------------------------------------------------------

const upstashLimiters = new Map<string, Ratelimit>()

function getUpstashLimiter(limit: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null

  const cacheKey = `${limit}:${windowSeconds}`
  let limiter = upstashLimiters.get(cacheKey)

  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
      prefix: '@temuulel/ratelimit',
    })
    upstashLimiters.set(cacheKey, limiter)
  }

  return limiter
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
 * Uses Upstash Redis in production (shared across serverless instances)
 * or falls back to in-memory for local development.
 *
 * @param key - Unique identifier (e.g. IP address, user ID)
 * @param options - Rate limit configuration
 * @returns Result with success flag and rate limit headers info
 */
export async function rateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(options.limit, options.windowSeconds)

  if (upstash) {
    try {
      const result = await upstash.limit(key)
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.reset,
      }
    } catch {
      // Redis unavailable — fall back to in-memory
      return memoryRateLimit(key, options.limit, options.windowSeconds)
    }
  }

  return memoryRateLimit(key, options.limit, options.windowSeconds)
}

/**
 * Extract client IP from a Next.js request.
 * Falls back to 'unknown' if no IP is available.
 */
export function getClientIp(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  return forwarded || 'unknown'
}
