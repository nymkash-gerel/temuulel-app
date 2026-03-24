/**
 * Resolution Engine — Business logic layer between intent classification and response generation.
 *
 * Checks customer history, delivery status, store settings, and product disambiguation
 * BEFORE the AI generates a response. This ensures the bot responds with real data
 * (like actual delivery status or customer's saved address) instead of generic templates.
 *
 * Architecture:
 *   classify → RESOLVE → respond
 *   (instead of: classify → respond)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionContext {
  // Customer history
  lastAddress?: string
  lastPhone?: string
  lastName?: string
  hasHistory: boolean

  // Active delivery (for complaints/shipping)
  activeDelivery?: {
    status: string
    driverName?: string
    driverPhone?: string
    estimatedTime?: string
    deliveryNumber?: string
  }

  // Product disambiguation
  bestProductName?: string
  bestProductId?: string

  // Store settings
  storeAddress?: string
  storePhone?: string
  storeHours?: string
  isDeliveryOnly: boolean

  // Shipping fee
  shippingFee?: number
  freeShippingThreshold?: number

  // Product search meta
  productsEmpty: boolean

  // Response tone
  tone: 'empathetic' | 'neutral'
}

interface ResolveInput {
  intent: string
  message: string
  storeId: string
  customerId: string | null
  products: Array<{ id?: string; name: string; base_price?: number }>
}

// ---------------------------------------------------------------------------
// 1. Customer History Check
// ---------------------------------------------------------------------------

async function checkCustomerHistory(
  supabase: SupabaseClient,
  customerId: string | null,
  storeId: string,
): Promise<{ lastAddress?: string; lastPhone?: string; lastName?: string } | null> {
  if (!customerId) return null

  try {
    const { data } = await supabase
      .from('orders')
      .select('shipping_address, customer_phone, customer_name')
      .eq('store_id', storeId)
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null
    return {
      lastAddress: data.shipping_address || undefined,
      lastPhone: data.customer_phone || undefined,
      lastName: data.customer_name || undefined,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 2. Delivery Status Check (for complaints)
// ---------------------------------------------------------------------------

async function checkDeliveryStatus(
  supabase: SupabaseClient,
  customerId: string | null,
  storeId: string,
): Promise<ResolutionContext['activeDelivery'] | null> {
  if (!customerId) return null

  try {
    const { data } = await supabase
      .from('deliveries')
      .select('status, delivery_number, estimated_delivery_time, driver_id, delivery_drivers(name, phone)')
      .eq('store_id', storeId)
      .in('status', ['assigned', 'picked_up', 'in_transit', 'at_store'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null

    const driver = Array.isArray(data.delivery_drivers)
      ? data.delivery_drivers[0]
      : data.delivery_drivers

    return {
      status: data.status,
      deliveryNumber: data.delivery_number || undefined,
      driverName: driver?.name || undefined,
      driverPhone: driver?.phone || undefined,
      estimatedTime: data.estimated_delivery_time || undefined,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 3. Product Disambiguation
// ---------------------------------------------------------------------------

function disambiguateProduct(
  message: string,
  products: Array<{ id?: string; name: string }>,
): { name: string; id?: string } | null {
  if (!products || products.length <= 1) return null

  const normalized = message.toLowerCase()
  const scored = products.map((p) => {
    const nameWords = p.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3)
    if (nameWords.length === 0) return { product: p, score: 0 }
    const matchCount = nameWords.filter((w) => normalized.includes(w)).length
    return { product: p, score: matchCount / nameWords.length }
  })

  const best = scored.sort((a, b) => b.score - a.score)[0]
  return best && best.score > 0.3 ? { name: best.product.name, id: best.product.id } : null
}

// ---------------------------------------------------------------------------
// 4. Store Settings Check
// ---------------------------------------------------------------------------

async function checkStoreSettings(
  supabase: SupabaseClient,
  storeId: string,
): Promise<{
  storeAddress?: string
  storePhone?: string
  storeHours?: string
  isDeliveryOnly: boolean
  shippingFee?: number
  freeShippingThreshold?: number
}> {
  try {
    const { data } = await supabase
      .from('stores')
      .select('address, phone, shipping_settings')
      .eq('id', storeId)
      .single()

    const hasAddress = !!data?.address && data.address.length > 5
    const shippingSettings = (data?.shipping_settings || {}) as Record<string, unknown>
    const innerCity = shippingSettings.inner_city as Record<string, unknown> | undefined
    return {
      storeAddress: data?.address || undefined,
      storePhone: data?.phone || undefined,
      storeHours: undefined,
      isDeliveryOnly: !hasAddress,
      shippingFee: innerCity?.price as number | undefined,
      freeShippingThreshold: (shippingSettings.free_shipping_minimum as number) || undefined,
    }
  } catch {
    return { isDeliveryOnly: true }
  }
}

// ---------------------------------------------------------------------------
// 5. Empathy Detection
// ---------------------------------------------------------------------------

const WORRY_WORDS = [
  // Cyrillic
  'ирсэнгүй', 'ирэхгүй', 'удаан', 'хаана', 'яасын', 'яагаад',
  'гарлаа', 'байхгүй болно', 'хэзээ', 'залгахгүй', 'хариулахгүй',
  'буруу', 'гэмтсэн', 'муу', 'асуудал', 'гомдол', 'солих', 'буцаа',
  // Latin (common customer spellings)
  'ireegui', 'ireegyi', 'irehgui', 'udaan', 'yaagaad', 'haana',
  'yaasiin', 'irsen', 'zahialsan', 'zahialga', 'hurge', 'hurgelt',
  'buruu', 'gemtsen', 'muu', 'solih', 'butsaa',
]

const EMPATHY_INTENTS = ['complaint', 'order_status', 'shipping', 'return_exchange']

function detectEmpathyNeed(message: string, intent: string): 'empathetic' | 'neutral' {
  const lower = message.toLowerCase()
  // Normalize Latin→Cyrillic for matching
  const normalized = lower
    .replace(/ts/g, 'ц').replace(/sh/g, 'ш').replace(/ch/g, 'ч')
    .replace(/kh/g, 'х').replace(/zh/g, 'ж')
  const isComplaintLike = EMPATHY_INTENTS.includes(intent)
  const hasWorry = WORRY_WORDS.some((w) => lower.includes(w) || normalized.includes(w))
  // Also trigger empathy if intent is complaint/return_exchange regardless of words
  return (isComplaintLike && hasWorry) || intent === 'complaint' || intent === 'return_exchange'
    ? 'empathetic' : 'neutral'
}

// ---------------------------------------------------------------------------
// Main: resolve()
// ---------------------------------------------------------------------------

/**
 * Enrich the classified intent with real business data before response generation.
 *
 * Runs DB checks in parallel for speed. Never throws — returns safe defaults on error.
 */
export async function resolve(
  supabase: SupabaseClient,
  ctx: ResolveInput,
): Promise<ResolutionContext> {
  try {
    // Run DB checks in parallel
    const needsDelivery = EMPATHY_INTENTS.includes(ctx.intent)

    const [history, delivery, storeSettings] = await Promise.all([
      checkCustomerHistory(supabase, ctx.customerId, ctx.storeId),
      needsDelivery ? checkDeliveryStatus(supabase, ctx.customerId, ctx.storeId) : null,
      checkStoreSettings(supabase, ctx.storeId),
    ])

    // Synchronous checks
    const bestProduct = disambiguateProduct(ctx.message, ctx.products)
    const tone = detectEmpathyNeed(ctx.message, ctx.intent)

    return {
      // Customer history
      lastAddress: history?.lastAddress,
      lastPhone: history?.lastPhone,
      lastName: history?.lastName,
      hasHistory: !!history,

      // Delivery
      activeDelivery: delivery || undefined,

      // Product
      bestProductName: bestProduct?.name,
      bestProductId: bestProduct?.id,

      // Product search meta
      productsEmpty: !ctx.products || ctx.products.length === 0,

      // Store
      storeAddress: storeSettings.storeAddress,
      storePhone: storeSettings.storePhone,
      storeHours: storeSettings.storeHours,
      isDeliveryOnly: storeSettings.isDeliveryOnly,

      // Shipping fee
      shippingFee: storeSettings.shippingFee,
      freeShippingThreshold: storeSettings.freeShippingThreshold,

      // Tone
      tone,
    }
  } catch {
    // Never crash the pipeline — return safe defaults
    return {
      hasHistory: false,
      isDeliveryOnly: true,
      productsEmpty: false,
      tone: 'neutral',
    }
  }
}
