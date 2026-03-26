/**
 * CustomerIntelAgent — Customer profile, purchase history, preferences.
 *
 * Non-critical agent: all operations are try/catch wrapped.
 * Failure here should never block the response pipeline.
 */

import {
  getLatestPurchase,
  getExtendedCustomerInfo,
  formatExtendedProfileForAI,
  inferPreferencesFromMessage,
  savePreference,
} from '@/lib/ai/customer-intelligence'
import { buildCustomerProfile } from '@/lib/ai/customer-profile'
import type { AgentContext } from './types'

export interface CustomerIntelResult {
  latestPurchaseSummary: string | null
  extendedProfile: string | null
  customerProfile: unknown | null
}

export class CustomerIntelAgent {
  readonly name = 'customer-intel'

  async gather(ctx: AgentContext, intent: string): Promise<CustomerIntelResult> {
    const result: CustomerIntelResult = {
      latestPurchaseSummary: null,
      extendedProfile: null,
      customerProfile: null,
    }

    if (!ctx.customerId) return result

    try {
      // Parallel: profile + latest purchase + extended info
      const [profile, purchase, extended] = await Promise.all([
        buildCustomerProfile(ctx.supabase, ctx.customerId, ctx.storeId).catch(() => null),
        (intent === 'order_status' || intent === 'shipping' || intent === 'complaint' || intent === 'return_exchange')
          ? getLatestPurchase(ctx.supabase, ctx.customerId, ctx.storeId).catch(() => null)
          : Promise.resolve(null),
        getExtendedCustomerInfo(ctx.supabase, ctx.customerId, ctx.storeId).catch(() => null),
      ])

      result.customerProfile = profile
      result.latestPurchaseSummary = purchase
      result.extendedProfile = extended ? formatExtendedProfileForAI(extended) : null

      // Infer and save preferences (synchronous inference, async save)
      const prefs = inferPreferencesFromMessage(ctx.message)
      if (prefs && prefs.length > 0) {
        for (const pref of prefs) {
          savePreference(ctx.supabase, ctx.customerId!, ctx.storeId, pref).catch(err => {
            console.error('[customer-intel] savePreference failed:', err?.message || err)
          })
        }
      }
    } catch {
      // Non-critical — return empty result
    }

    return result
  }
}
