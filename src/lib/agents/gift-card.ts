/**
 * GiftCardAgent — Handles gift card purchase, redemption, and transfer.
 *
 * Highest priority interceptor — runs before intent classification.
 * If a gift card flow is active, this agent handles the message entirely.
 */

import {
  purchaseGiftCard,
  lookupGiftCard,
  redeemGiftCard,
  transferGiftCard,
  extractGiftCardCode,
  parseGiftCardAmount,
  formatGiftCardBalance,
  GIFT_CARD_DENOMINATIONS,
} from '@/lib/gift-card-engine'
import type { AgentContext, AgentResult } from './types'
import { emptyResult } from './types'

export class GiftCardAgent {
  readonly name = 'gift-card'

  /**
   * Try to handle message as part of a gift card flow.
   * Returns AgentResult if handled, null if not a gift card context.
   */
  async tryHandle(ctx: AgentContext): Promise<AgentResult | null> {
    const draft = ctx.state.gift_card_draft
    if (!draft) return null

    try {
      // Delegate to existing gift card engine based on draft step
      const step = draft.step
      let response: string

      if (step === 'select_amount') {
        const amount = parseGiftCardAmount(ctx.message)
        if (!amount) {
          response = `Дүнгээ сонгоно уу: ${GIFT_CARD_DENOMINATIONS.map(d => `₮${d.toLocaleString()}`).join(', ')}`
          return { ...emptyResult('gift_card_purchase', response), stateUpdates: { gift_card_draft: draft } }
        }
        // Move to confirm step
        const updatedDraft = { ...draft, step: 'confirm' as const, amount }
        response = `₮${amount.toLocaleString()} дүнтэй бэлгийн карт үүсгэх үү?`
        return { ...emptyResult('gift_card_purchase', response), stateUpdates: { gift_card_draft: updatedDraft } }
      }

      if (step === 'confirm') {
        const result = await purchaseGiftCard(ctx.supabase, ctx.storeId, ctx.customerId!, draft.amount!)
        response = `Бэлгийн карт амжилттай! Код: ${result.code}, Үлдэгдэл: ${formatGiftCardBalance(result.balance)}`
        return { ...emptyResult('gift_card_purchase', response), stateUpdates: { gift_card_draft: null } }
      }

      // Default: return info about the flow
      response = 'Бэлгийн картын үйлдэл хийгдэж байна...'
      return emptyResult('gift_card_purchase', response)
    } catch (error) {
      return emptyResult('gift_card_purchase', 'Бэлгийн картын алдаа гарлаа. Дахин оролдоно уу.')
    }
  }
}
