/**
 * AI response cache for common intents.
 * Saves ~30-40% OpenAI cost by serving cached responses for greeting/thanks.
 */
import { getRedis } from '../redis'

const CACHEABLE_INTENTS = new Set(['greeting', 'thanks'])
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

function cacheKey(storeId: string, intent: string, message: string): string {
  // Normalize message for cache key (lowercase, trim, limit length)
  const normalized = message.toLowerCase().trim().substring(0, 80)
  return `ai-reply:${storeId}:${intent}:${normalized}`
}

export async function getCachedReply(
  storeId: string,
  intent: string,
  message: string,
): Promise<string | null> {
  if (!CACHEABLE_INTENTS.has(intent)) return null
  const redis = getRedis()
  if (!redis) return null
  try {
    const cached = await redis.get<string>(cacheKey(storeId, intent, message))
    return cached || null
  } catch {
    return null
  }
}

export async function setCachedReply(
  storeId: string,
  intent: string,
  message: string,
  reply: string,
): Promise<void> {
  if (!CACHEABLE_INTENTS.has(intent)) return
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(cacheKey(storeId, intent, message), reply, { ex: CACHE_TTL_SECONDS })
  } catch {
    // non-critical
  }
}
