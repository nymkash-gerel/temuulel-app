/**
 * OpenAI cost tracking — fire-and-forget usage logger per store.
 */
import { createClient } from '@supabase/supabase-js'

// Pricing as of 2024 (USD per 1M tokens unless noted)
const PRICING = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },      // per 1M tokens
  'gpt-4o': { prompt: 2.50, completion: 10.00 },          // per 1M tokens
  'whisper-1': { perMinute: 0.006 },                      // per minute of audio
} as const

export interface UsageRecord {
  storeId?: string
  model: string
  operation: 'chat' | 'vision' | 'whisper' | 'embedding'
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  audioSeconds?: number
  durationMs?: number
}

export function calculateCost(record: UsageRecord): number {
  if (record.operation === 'whisper' && record.audioSeconds) {
    return (record.audioSeconds / 60) * PRICING['whisper-1'].perMinute
  }
  const pricing = PRICING[record.model as keyof typeof PRICING]
  if (!pricing || !('prompt' in pricing)) return 0
  const promptCost = ((record.promptTokens ?? 0) / 1_000_000) * pricing.prompt
  const completionCost = ((record.completionTokens ?? 0) / 1_000_000) * pricing.completion
  return promptCost + completionCost
}

/**
 * Log detailed OpenAI API usage for cost analytics.
 * Fire-and-forget. Never blocks, never throws.
 *
 * Note: `messages_used` billing counter is incremented separately
 * in the webhook AFTER processAIChat succeeds — NOT here.
 * This is because we want to count messages handled by keyword/BERT
 * classification too (not just OpenAI calls).
 */
export function trackOpenAIUsage(record: UsageRecord): void {
  void (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
      if (!url || !key) return
      const supabase = createClient(url, key)
      await supabase.from('openai_usage_logs').insert({
        store_id: record.storeId || null,
        model: record.model,
        operation: record.operation,
        prompt_tokens: record.promptTokens ?? 0,
        completion_tokens: record.completionTokens ?? 0,
        total_tokens: record.totalTokens ?? 0,
        duration_ms: record.durationMs ?? null,
        cost_usd: calculateCost(record),
      })
    } catch (e) {
      console.error('[cost-tracker]', e)
    }
  })()
}
