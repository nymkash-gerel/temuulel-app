/**
 * customer-profile.ts
 * ─────────────────────────────────────────────────────────────
 * Temuulel Agent — Customer Profile Context Injection
 * Ported from customerProfileInjection.js to TypeScript/Supabase.
 *
 * Fetches customer name, order history, active order, open issues
 * from Supabase in parallel and builds a structured profile that
 * gets injected into the LLM system prompt per session.
 * ─────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CustomerProfile {
  // Raw values — for business logic
  name: string | null
  orderCount: number
  lifetimeSpend: number
  loyaltyTier: 'New' | 'Bronze' | 'Silver' | 'Gold' | 'VIP'
  isNewCustomer: boolean
  isReturning: boolean
  hasActiveOrder: boolean
  hasOpenIssue: boolean

  // Formatted strings — inject directly into system prompt
  formatted: {
    name: string
    loyaltyTier: string
    orderHistorySummary: string
    activeOrderSummary: string
    openIssuesSummary: string
    newCustomerNote: string
    vipNote: string
    issueWarning: string
  }
}

// ─────────────────────────────────────────────────────────────
// Tier derivation
// ─────────────────────────────────────────────────────────────

function deriveTier(orderCount: number, lifetimeSpend: number): CustomerProfile['loyaltyTier'] {
  if (orderCount === 0) return 'New'
  if (lifetimeSpend >= 500000 || orderCount >= 20) return 'VIP'
  if (lifetimeSpend >= 200000 || orderCount >= 10) return 'Gold'
  if (lifetimeSpend >= 80000  || orderCount >= 4)  return 'Silver'
  return 'Bronze'
}

// ─────────────────────────────────────────────────────────────
// Main builder — fetches everything in parallel
// ─────────────────────────────────────────────────────────────

export async function buildCustomerProfile(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
): Promise<CustomerProfile> {

  // Fetch customer record, order history, active order, and open escalations in parallel
  const [
    customerResult,
    ordersResult,
    tierStatsResult,
    activeOrderResult,
    escalationResult,
  ] = await Promise.all([

    // 1. Customer basic info
    supabase
      .from('customers')
      .select('name, created_at, phone')
      .eq('id', customerId)
      .single(),

    // 2. Last 5 orders — for display only (recent history summary)
    supabase
      .from('orders')
      .select('order_number, status, total_amount, created_at')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5),

    // 3. Lifetime stats — full count + total spend for accurate tier calculation
    // NOTE: We can't use .count() without fetching rows in Supabase JS v2,
    // so we select only total_amount across all orders (no limit).
    supabase
      .from('orders')
      .select('total_amount')
      .eq('customer_id', customerId)
      .eq('store_id', storeId),

    // 4. Active order (in transit or confirmed)
    supabase
      .from('orders')
      .select('order_number, status, total_amount, created_at')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .in('status', ['confirmed', 'in_transit', 'pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 5. Open escalations (unresolved complaints)
    supabase
      .from('conversations')
      .select('id, escalation_level, escalated_at')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .eq('status', 'escalated')
      .limit(1),
  ])

  const customer = customerResult.data
  const orders = ordersResult.data ?? []
  const allOrders = tierStatsResult.data ?? []
  const activeOrder = activeOrderResult.data ?? null
  const openEscalations = escalationResult.data ?? []

  // ── Derived values ──
  const name = customer?.name ?? null
  // Use full order history for tier calculation — last-5 limit caused VIP customers
  // to be misclassified (e.g. 20 orders → showed as 5 → never reached VIP tier)
  const orderCount = allOrders.length
  const lifetimeSpend = allOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0)
  const loyaltyTier = deriveTier(orderCount, lifetimeSpend)
  const isNewCustomer = orderCount === 0
  const isReturning = orderCount > 0
  const hasActiveOrder = activeOrder !== null
  const hasOpenIssue = openEscalations.length > 0

  // ── Formatted strings for system prompt ──
  const lastOrder = orders[0] ?? null

  const orderHistorySummary = isNewCustomer
    ? 'New customer — no previous orders. Be extra welcoming and guide them gently.'
    : `${orderCount} past order${orderCount > 1 ? 's' : ''}. Most recent: Order #${lastOrder?.order_number} (${lastOrder?.status}) on ${lastOrder?.created_at?.slice(0, 10)}.`

  const activeOrderSummary = hasActiveOrder
    ? `Order #${activeOrder!.order_number} — Status: ${activeOrder!.status} — ₮${(activeOrder!.total_amount ?? 0).toLocaleString()}`
    : 'None'

  const openIssuesSummary = hasOpenIssue
    ? `Unresolved escalation (level: ${openEscalations[0]?.escalation_level ?? 'unknown'}) — address this before anything else`
    : 'None'

  // ── Conditional alert sections ──
  const issueWarning = hasOpenIssue
    ? `\n⚠️ OPEN ISSUE: Customer has an unresolved complaint. Address it immediately. Do NOT upsell until fully resolved.\n`
    : ''

  const newCustomerNote = isNewCustomer
    ? `\nNEW CUSTOMER: First impression matters. Be especially warm and guide them naturally.\n`
    : ''

  const vipNote = (loyaltyTier === 'VIP' || loyaltyTier === 'Gold')
    ? `\nVIP CUSTOMER (${loyaltyTier}): Prioritize speed and attentiveness. Offer premium options when relevant.\n`
    : ''

  return {
    name,
    orderCount,
    lifetimeSpend,
    loyaltyTier,
    isNewCustomer,
    isReturning,
    hasActiveOrder,
    hasOpenIssue,
    formatted: {
      name: name ?? 'Customer',
      loyaltyTier: `${loyaltyTier} (₮${lifetimeSpend.toLocaleString()} total spend, ${orderCount} orders)`,
      orderHistorySummary,
      activeOrderSummary,
      openIssuesSummary,
      newCustomerNote,
      vipNote,
      issueWarning,
    },
  }
}
