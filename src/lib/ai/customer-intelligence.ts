/**
 * customer-intelligence.ts
 * ─────────────────────────────────────────────────────────────
 * Extended customer intelligence layer.
 *
 * - Fetches latest purchase for return/complaint auto-lookup
 * - Collects & stores preferences from conversation
 * - Logs interactions (complaints, returns, feedback)
 * - Builds rich profile for AI personalization
 * ─────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface LatestPurchase {
  order_id: string
  order_number: string
  status: string
  total_amount: number
  created_at: string
  items: { product_name: string; quantity: number; price: number }[]
}

export interface CustomerPreference {
  preference_type: string
  preference_key: string
  preference_value: string | null
  confidence: number
  source: 'explicit' | 'inferred' | 'observed'
}

export interface ExtendedCustomerInfo {
  birthday: string | null
  gender: string | null
  age_range: string | null
  preferred_size: string | null
  preferred_language: string
  address: string | null
  phone: string | null
  preferences: CustomerPreference[]
  complaint_count: number
  return_count: number
  last_complaint_date: string | null
}

// ─────────────────────────────────────────────────────────────
// Latest purchase lookup (for return/complaint flows)
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the customer's most recent order with items.
 * Used by return/complaint handlers to auto-suggest the order in question.
 */
export async function getLatestPurchase(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
): Promise<LatestPurchase | null> {
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, total_amount, created_at,
      order_items(quantity, unit_price, products(name))
    `)
    .eq('customer_id', customerId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) return null

  const items = (order.order_items || []).map((item: Record<string, unknown>) => ({
    product_name: (item.products as { name?: string } | null)?.name ?? 'Бараа',
    quantity: item.quantity as number,
    price: item.unit_price as number,
  }))

  return {
    order_id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_amount: order.total_amount,
    created_at: order.created_at,
    items,
  }
}

/**
 * Format latest purchase as a confirmation message for the customer.
 */
export function formatPurchaseConfirmation(purchase: LatestPurchase): string {
  const date = new Date(purchase.created_at).toLocaleDateString('mn-MN')
  const itemList = purchase.items
    .map(i => `• ${i.quantity}x ${i.product_name}`)
    .join('\n')
  const total = new Intl.NumberFormat('mn-MN').format(purchase.total_amount) + '₮'

  return `📋 **Таны сүүлийн захиалга:**\n\n🔖 ${purchase.order_number} (${date})\n${itemList}\n💰 Нийт: ${total}\n\n❓ Энэ захиалгатай холбоотой юу?`
}

// ─────────────────────────────────────────────────────────────
// Extended profile loader
// ─────────────────────────────────────────────────────────────

/**
 * Fetch extended customer info: demographics, preferences, interaction history.
 */
export async function getExtendedCustomerInfo(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
): Promise<ExtendedCustomerInfo> {
  const [customerResult, prefsResult, complaintsResult, returnsResult] = await Promise.all([
    // Basic info with extended fields
    supabase
      .from('customers')
      .select('birthday, gender, age_range, preferred_size, preferred_language, address, phone')
      .eq('id', customerId)
      .single(),

    // Preferences
    supabase
      .from('customer_preferences')
      .select('preference_type, preference_key, preference_value, confidence, source')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .order('confidence', { ascending: false })
      .limit(20),

    // Complaint count + last date
    supabase
      .from('customer_interactions')
      .select('created_at')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .eq('interaction_type', 'complaint')
      .order('created_at', { ascending: false })
      .limit(10),

    // Return count
    supabase
      .from('customer_interactions')
      .select('id')
      .eq('customer_id', customerId)
      .eq('store_id', storeId)
      .eq('interaction_type', 'return_request')
      .limit(10),
  ])

  const customer = customerResult.data
  const prefs = prefsResult.data ?? []
  const complaints = complaintsResult.data ?? []
  const returns = returnsResult.data ?? []

  return {
    birthday: customer?.birthday ?? null,
    gender: customer?.gender ?? null,
    age_range: customer?.age_range ?? null,
    preferred_size: customer?.preferred_size ?? null,
    preferred_language: customer?.preferred_language ?? 'mn',
    address: customer?.address ?? null,
    phone: customer?.phone ?? null,
    preferences: prefs as CustomerPreference[],
    complaint_count: complaints.length,
    return_count: returns.length,
    last_complaint_date: complaints[0]?.created_at ?? null,
  }
}

// ─────────────────────────────────────────────────────────────
// Preference collection (from conversation)
// ─────────────────────────────────────────────────────────────

/**
 * Save or update a customer preference.
 * Uses upsert on the unique constraint (customer_id, store_id, type, key).
 */
export async function savePreference(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
  pref: {
    type: string
    key: string
    value?: string
    confidence?: number
    source?: 'explicit' | 'inferred' | 'observed'
  }
): Promise<void> {
  await supabase
    .from('customer_preferences')
    .upsert({
      customer_id: customerId,
      store_id: storeId,
      preference_type: pref.type,
      preference_key: pref.key,
      preference_value: pref.value ?? null,
      confidence: pref.confidence ?? 0.5,
      source: pref.source ?? 'inferred',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'customer_id,store_id,preference_type,preference_key',
    })
}

/**
 * Log a customer interaction (complaint, return, feedback, etc.)
 */
export async function logInteraction(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
  interaction: {
    type: string
    orderId?: string
    summary?: string
  }
): Promise<void> {
  await supabase
    .from('customer_interactions')
    .insert({
      customer_id: customerId,
      store_id: storeId,
      interaction_type: interaction.type,
      related_order_id: interaction.orderId ?? null,
      summary: interaction.summary ?? null,
    })
}

/**
 * Update customer demographic fields.
 */
export async function updateCustomerDemographics(
  supabase: SupabaseClient,
  customerId: string,
  fields: {
    birthday?: string
    gender?: string
    age_range?: string
    preferred_size?: string
    address?: string
    phone?: string
  }
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.birthday) update.birthday = fields.birthday
  if (fields.gender) update.gender = fields.gender
  if (fields.age_range) update.age_range = fields.age_range
  if (fields.preferred_size) update.preferred_size = fields.preferred_size
  if (fields.address) update.address = fields.address
  if (fields.phone) update.phone = fields.phone

  await supabase
    .from('customers')
    .update(update)
    .eq('id', customerId)
}

// ─────────────────────────────────────────────────────────────
// Infer preferences from message (lightweight extraction)
// ─────────────────────────────────────────────────────────────

interface InferredPreference {
  type: string
  key: string
  value?: string
}

/**
 * Extract preferences from a customer message.
 * Lightweight rule-based extraction (no LLM needed).
 */
export function inferPreferencesFromMessage(message: string): InferredPreference[] {
  const lower = message.toLowerCase()
  const prefs: InferredPreference[] = []

  // Size mentions
  const sizeMatch = lower.match(/\b(xs|s|m|l|xl|xxl|xxxl)\b/i)
    ?? lower.match(/(36|38|40|42|44|46|48)\s*(размер|size)?/)
  if (sizeMatch) {
    prefs.push({ type: 'style', key: 'preferred_size', value: sizeMatch[1] || sizeMatch[0] })
  }

  // Budget signals
  if (/хямд|хэмнэлттэй|cheap|budget|доош/.test(lower)) {
    prefs.push({ type: 'budget_range', key: 'budget', value: 'low' })
  } else if (/premium|чанартай|luxury|дээд/.test(lower)) {
    prefs.push({ type: 'budget_range', key: 'budget', value: 'high' })
  }

  // Dietary
  if (/веган|vegan/.test(lower)) prefs.push({ type: 'dietary', key: 'vegan', value: 'true' })
  if (/халал|halal/.test(lower)) prefs.push({ type: 'dietary', key: 'halal', value: 'true' })
  if (/глютен|gluten/.test(lower)) prefs.push({ type: 'allergy', key: 'gluten', value: 'true' })

  // Interest categories
  const categoryMap: Record<string, string> = {
    'хувцас|clothes|fashion': 'clothing',
    'гутал|shoes|sneaker': 'shoes',
    'гоо сайхан|cosmetic|beauty': 'beauty',
    'цахилгаан|electronic|tech': 'electronics',
    'хоол|food|restaurant': 'food',
    'эрүүл мэнд|health|fitness': 'health',
  }
  for (const [pattern, category] of Object.entries(categoryMap)) {
    if (new RegExp(pattern, 'i').test(lower)) {
      prefs.push({ type: 'interest', key: category })
    }
  }

  return prefs
}

// ─────────────────────────────────────────────────────────────
// Format extended profile for AI system prompt
// ─────────────────────────────────────────────────────────────

/**
 * Build a concise profile string for the LLM system prompt.
 */
export function formatExtendedProfileForAI(info: ExtendedCustomerInfo): string {
  const parts: string[] = []

  if (info.gender) parts.push(`Хүйс: ${info.gender === 'male' ? 'Эрэгтэй' : info.gender === 'female' ? 'Эмэгтэй' : info.gender}`)
  if (info.age_range) parts.push(`Нас: ${info.age_range}`)
  if (info.preferred_size) parts.push(`Размер: ${info.preferred_size}`)
  if (info.birthday) {
    const bday = new Date(info.birthday)
    const today = new Date()
    const isBirthdayMonth = bday.getMonth() === today.getMonth()
    const isBirthdayToday = isBirthdayMonth && bday.getDate() === today.getDate()
    if (isBirthdayToday) parts.push('🎂 ӨНӨӨДӨР ТӨРСӨН ӨДӨР!')
    else if (isBirthdayMonth) parts.push(`🎂 Энэ сарын ${bday.getDate()}-нд төрсөн өдөр`)
  }

  // Top preferences
  const topPrefs = info.preferences
    .filter(p => p.confidence >= 0.5)
    .slice(0, 5)
  if (topPrefs.length > 0) {
    const prefStr = topPrefs.map(p => {
      if (p.preference_type === 'interest') return p.preference_key
      if (p.preference_type === 'dietary') return `${p.preference_key} хоол`
      if (p.preference_type === 'budget_range') return `${p.preference_value} бюджет`
      return `${p.preference_key}: ${p.preference_value}`
    }).join(', ')
    parts.push(`Сонирхол: ${prefStr}`)
  }

  // Complaint history warning
  if (info.complaint_count > 0) {
    parts.push(`⚠️ ${info.complaint_count} гомдол бүртгэлтэй${info.last_complaint_date ? ` (сүүлийнх: ${new Date(info.last_complaint_date).toLocaleDateString('mn-MN')})` : ''}`)
  }
  if (info.return_count > 0) {
    parts.push(`🔄 ${info.return_count} буцаалт хийсэн`)
  }

  if (info.address) parts.push(`Хаяг: ${info.address}`)

  return parts.length > 0 ? parts.join(' | ') : ''
}
