/**
 * Upstash Redis client for serverless environments.
 *
 * Used for:
 * - Production-grade rate limiting (shared across Vercel instances)
 * - Session caching
 * - API response caching
 *
 * When UPSTASH_REDIS_REST_URL is not set, features using Redis
 * gracefully fall back to in-memory alternatives.
 */

import { Redis } from '@upstash/redis'

let redis: Redis | null = null

export function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) return null

  redis = new Redis({ url, token })
  return redis
}
