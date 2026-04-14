/**
 * A/B test variant assignment + tracking.
 * Customer is consistently assigned A or B based on their ID hash.
 */
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function assignVariant(testId: string, customerId: string): 'a' | 'b' {
  const hash = crypto.createHash('md5').update(testId + customerId).digest()
  return hash[0] % 2 === 0 ? 'a' : 'b'
}

export async function trackEvent(
  supabase: SupabaseClient,
  testId: string,
  customerId: string,
  eventType: 'impression' | 'conversion',
): Promise<void> {
  void (async () => {
    try {
      const variant = assignVariant(testId, customerId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('ab_test_events').insert({
        test_id: testId,
        variant,
        customer_id: customerId,
        event_type: eventType,
      })
    } catch (e) {
      console.error('[ab-test]', e)
    }
  })()
}

export async function getTestStats(
  supabase: SupabaseClient,
  testId: string,
): Promise<{ a: { impressions: number; conversions: number; rate: number }, b: { impressions: number; conversions: number; rate: number }, winner: 'a' | 'b' | 'tie' | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = await (supabase as any)
    .from('ab_test_events')
    .select('variant, event_type')
    .eq('test_id', testId)

  const stats = { a: { impressions: 0, conversions: 0, rate: 0 }, b: { impressions: 0, conversions: 0, rate: 0 } }
  for (const e of (events || []) as { variant: 'a' | 'b'; event_type: 'impression' | 'conversion' }[]) {
    if (e.event_type === 'impression') stats[e.variant].impressions++
    else stats[e.variant].conversions++
  }
  stats.a.rate = stats.a.impressions > 0 ? stats.a.conversions / stats.a.impressions : 0
  stats.b.rate = stats.b.impressions > 0 ? stats.b.conversions / stats.b.impressions : 0

  const minSample = 30 // minimum impressions per variant
  let winner: 'a' | 'b' | 'tie' | null = null
  if (stats.a.impressions >= minSample && stats.b.impressions >= minSample) {
    if (Math.abs(stats.a.rate - stats.b.rate) < 0.05) winner = 'tie'
    else winner = stats.a.rate > stats.b.rate ? 'a' : 'b'
  }
  return { ...stats, winner }
}
