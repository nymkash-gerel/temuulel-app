/**
 * Edge-compatible rate limiter for Next.js middleware.
 *
 * Uses an in-memory sliding window counter (Map-based).
 * Separate from src/lib/rate-limit.ts because middleware runs
 * in the Edge Runtime with its own memory space.
 *
 * Limitation: In-memory state does not persist across Vercel Edge
 * instances, so this provides approximate protection. Redis upgrade
 * is planned as a future step.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const MAX_STORE_SIZE = 10_000
const CLEANUP_INTERVAL = 60_000
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
  if (store.size > MAX_STORE_SIZE) {
    const entries = [...store.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toDelete = entries.slice(0, Math.floor(MAX_STORE_SIZE * 0.3))
    for (const [key] of toDelete) {
      store.delete(key)
    }
  }
}

interface RateLimitOptions {
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

export function edgeRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  cleanup()

  const now = Date.now()
  const windowMs = options.windowSeconds * 1000
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
    }
  }

  entry.count++
  const remaining = Math.max(0, options.limit - entry.count)

  return {
    success: entry.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: entry.resetAt,
  }
}

export function getEdgeClientIp(request: Request): string {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  return forwarded || 'unknown'
}

// --- Path-based tier resolution ---

interface RateLimitTier {
  pattern: RegExp
  limit: number
  windowSeconds: number
}

const RATE_LIMIT_TIERS: RateLimitTier[] = [
  // Auth endpoints — prevent credential stuffing
  { pattern: /^\/api\/auth\//, limit: 20, windowSeconds: 60 },
  { pattern: /^\/api\/driver\/auth\//, limit: 20, windowSeconds: 60 },

  // AI / expensive compute
  { pattern: /^\/api\/chat\/ai/, limit: 15, windowSeconds: 60 },
  { pattern: /^\/api\/driver\/deliveries\/optimize/, limit: 10, windowSeconds: 60 },
  { pattern: /^\/api\/products\/enrich/, limit: 10, windowSeconds: 60 },
  { pattern: /^\/api\/analytics\/insights/, limit: 10, windowSeconds: 60 },

  // Batch / generation
  { pattern: /^\/api\/commissions\/generate/, limit: 5, windowSeconds: 60 },
  { pattern: /^\/api\/driver-payouts\/generate/, limit: 5, windowSeconds: 60 },

  // Financial
  { pattern: /^\/api\/pos\/checkout/, limit: 30, windowSeconds: 60 },
  { pattern: /^\/api\/payments\//, limit: 20, windowSeconds: 60 },
  { pattern: /^\/api\/orders$/, limit: 20, windowSeconds: 60 },

  // Analytics (DB-heavy)
  { pattern: /^\/api\/analytics\//, limit: 30, windowSeconds: 60 },

  // Default — all other /api/* routes
  { pattern: /^\/api\//, limit: 60, windowSeconds: 60 },
]

const EXEMPT_PATTERNS = [
  /^\/api\/webhook\//,
  /^\/api\/cron\//,
  /^\/api\/health$/,
]

export function shouldSkipRateLimit(pathname: string): boolean {
  return EXEMPT_PATTERNS.some(p => p.test(pathname))
}

export function resolveTier(pathname: string): RateLimitOptions {
  for (const tier of RATE_LIMIT_TIERS) {
    if (tier.pattern.test(pathname)) {
      return { limit: tier.limit, windowSeconds: tier.windowSeconds }
    }
  }
  return { limit: 60, windowSeconds: 60 }
}
