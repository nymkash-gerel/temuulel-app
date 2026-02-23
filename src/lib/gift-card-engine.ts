/**
 * gift-card-engine.ts — Gift card lifecycle management
 *
 * Handles: purchase, lookup, redeem, transfer, balance check.
 * All functions accept a Supabase client (service-role or browser depending
 * on caller) so they work in both API routes and server actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GiftCard {
  id: string
  code: string
  store_id: string
  customer_id: string | null
  initial_balance: number
  current_balance: number
  status: string | null
  expires_at: string | null
  recipient_contact: string | null
  transferred_at: string | null
  purchased_via: string | null
}

export interface PurchaseGiftCardInput {
  storeId: string
  customerId?: string | null
  amount: number
  purchasedVia?: 'chat' | 'dashboard'
}

export interface PurchaseGiftCardResult {
  success: true
  giftCard: GiftCard
  code: string
}

export interface RedeemGiftCardInput {
  code: string
  storeId: string
  amount: number
  orderId?: string | null
  customerId?: string | null
}

export interface RedeemGiftCardResult {
  success: boolean
  remaining: number
  error?: string
}

export interface TransferGiftCardInput {
  code: string
  storeId: string
  fromCustomerId?: string | null
  recipientContact: string
}

export interface TransferGiftCardResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/I/1 ambiguity

/**
 * Generate a gift card code in format GIFT-XXXX-XXXX.
 * Uses crypto.getRandomValues if available, otherwise Math.random.
 */
export function generateGiftCardCode(): string {
  const seg = (len: number) =>
    Array.from({ length: len }, () => {
      const idx =
        typeof crypto !== 'undefined'
          ? crypto.getRandomValues(new Uint8Array(1))[0] % CODE_CHARS.length
          : Math.floor(Math.random() * CODE_CHARS.length)
      return CODE_CHARS[idx]
    }).join('')
  return `GIFT-${seg(4)}-${seg(4)}`
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

/**
 * Create a new gift card and record the purchase transaction.
 * Returns the created gift card row.
 */
export async function purchaseGiftCard(
  supabase: SupabaseClient<Database>,
  input: PurchaseGiftCardInput
): Promise<PurchaseGiftCardResult> {
  const { storeId, customerId, amount, purchasedVia = 'chat' } = input

  // Generate unique code (retry on collision, max 5 tries)
  let code = generateGiftCardCode()
  for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any).from('gift_cards')
      .select('id')
      .eq('code', code)
      .eq('store_id', storeId)
      .maybeSingle()
    if (!existing) break
    code = generateGiftCardCode()
  }

  // Set expiry: 1 year from now
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: giftCard, error } = await (supabase as any).from('gift_cards')
    .insert({
      code,
      store_id: storeId,
      customer_id: customerId ?? null,
      initial_balance: amount,
      current_balance: amount,
      status: 'active',
      expires_at: expiresAt,
      purchased_via: purchasedVia,
    })
    .select()
    .single()

  if (error || !giftCard) {
    throw new Error(`Failed to create gift card: ${error?.message ?? 'unknown'}`)
  }

  // Record purchase transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('gift_card_transactions').insert({
    gift_card_id: giftCard.id,
    store_id: storeId,
    transaction_type: 'purchase',
    amount,
    from_customer_id: customerId ?? null,
    note: `Gift card purchased via ${purchasedVia}`,
  })

  return { success: true, giftCard: giftCard as GiftCard, code }
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Find a gift card by code + store. Returns null if not found.
 */
export async function lookupGiftCard(
  supabase: SupabaseClient<Database>,
  { code, storeId }: { code: string; storeId: string }
): Promise<GiftCard | null> {
  const normalizedCode = code.toUpperCase().trim()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('gift_cards')
    .select('*')
    .eq('code', normalizedCode)
    .eq('store_id', storeId)
    .maybeSingle()
  return (data as GiftCard) ?? null
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

export async function getGiftCardBalance(
  supabase: SupabaseClient<Database>,
  { code, storeId }: { code: string; storeId: string }
): Promise<number | null> {
  const card = await lookupGiftCard(supabase, { code, storeId })
  if (!card || card.status === 'cancelled') return null
  return card.current_balance
}

// ---------------------------------------------------------------------------
// Redeem
// ---------------------------------------------------------------------------

/**
 * Deduct `amount` from a gift card's balance.
 * Marks card as 'redeemed' when balance hits 0.
 */
export async function redeemGiftCard(
  supabase: SupabaseClient<Database>,
  input: RedeemGiftCardInput
): Promise<RedeemGiftCardResult> {
  const { code, storeId, amount, orderId, customerId } = input

  const card = await lookupGiftCard(supabase, { code, storeId })
  if (!card) return { success: false, remaining: 0, error: 'Gift card not found' }
  if (card.status === 'redeemed') return { success: false, remaining: 0, error: 'Gift card already fully used' }
  if (card.status === 'cancelled') return { success: false, remaining: 0, error: 'Gift card is cancelled' }
  if (card.expires_at && new Date(card.expires_at) < new Date()) {
    return { success: false, remaining: 0, error: 'Gift card has expired' }
  }
  if (card.current_balance < amount) {
    return {
      success: false,
      remaining: card.current_balance,
      error: `Insufficient balance. Available: ${card.current_balance}₮`,
    }
  }

  const newBalance = card.current_balance - amount
  const newStatus = newBalance === 0 ? 'redeemed' : 'active'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any).from('gift_cards')
    .update({ current_balance: newBalance, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', card.id)

  if (updateError) {
    return { success: false, remaining: card.current_balance, error: updateError.message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('gift_card_transactions').insert({
    gift_card_id: card.id,
    store_id: storeId,
    transaction_type: 'redeem',
    amount,
    order_id: orderId ?? null,
    to_customer_id: customerId ?? null,
    note: orderId ? `Applied to order ${orderId}` : 'Manual redemption',
  })

  return { success: true, remaining: newBalance }
}

// ---------------------------------------------------------------------------
// Transfer (Regift)
// ---------------------------------------------------------------------------

/**
 * Mark a gift card as transferred to a recipient (phone/messenger contact).
 * Does not change ownership in DB — just records the recipient contact.
 */
export async function transferGiftCard(
  supabase: SupabaseClient<Database>,
  input: TransferGiftCardInput
): Promise<TransferGiftCardResult> {
  const { code, storeId, fromCustomerId, recipientContact } = input

  const card = await lookupGiftCard(supabase, { code, storeId })
  if (!card) return { success: false, error: 'Gift card not found' }
  if (card.status !== 'active') return { success: false, error: 'Gift card is not active' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any).from('gift_cards')
    .update({
      recipient_contact: recipientContact,
      transferred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', card.id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('gift_card_transactions').insert({
    gift_card_id: card.id,
    store_id: storeId,
    transaction_type: 'transfer',
    amount: card.current_balance,
    from_customer_id: fromCustomerId ?? null,
    note: `Transferred to ${recipientContact}`,
  })

  return { success: true }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format balance for display in Mongolian chat */
export function formatGiftCardBalance(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

/** Detect a GIFT-XXXX-XXXX pattern in a message */
export function extractGiftCardCode(message: string): string | null {
  const match = message.toUpperCase().match(/GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}/)
  return match ? match[0] : null
}

/** Standard gift card denominations available via chat */
export const GIFT_CARD_DENOMINATIONS = [10_000, 25_000, 50_000, 100_000] as const

/** Parse an amount selection from customer message (e.g. "50,000" or "50к" or "50000") */
export function parseGiftCardAmount(message: string): number | null {
  const cleaned = message.replace(/,/g, '').replace(/\s/g, '').toLowerCase()

  // Direct match: "50000", "50,000"
  const directMatch = cleaned.match(/^(\d+)₮?$/)
  if (directMatch) {
    const n = parseInt(directMatch[1], 10)
    if (GIFT_CARD_DENOMINATIONS.includes(n as typeof GIFT_CARD_DENOMINATIONS[number])) return n
  }

  // "к" suffix: "50к" or "50k"
  const kMatch = cleaned.match(/^(\d+)[кk]$/)
  if (kMatch) {
    const n = parseInt(kMatch[1], 10) * 1000
    if (GIFT_CARD_DENOMINATIONS.includes(n as typeof GIFT_CARD_DENOMINATIONS[number])) return n
  }

  // Number in message that matches a denomination
  const nums = cleaned.match(/\d+/g) ?? []
  for (const numStr of nums) {
    const n = parseInt(numStr, 10)
    if (GIFT_CARD_DENOMINATIONS.includes(n as typeof GIFT_CARD_DENOMINATIONS[number])) return n
    const nk = n * 1000
    if (n < 1000 && GIFT_CARD_DENOMINATIONS.includes(nk as typeof GIFT_CARD_DENOMINATIONS[number])) return nk
  }

  return null
}
