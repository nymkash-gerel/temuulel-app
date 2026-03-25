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
import { getGoogleMapsETA, isGoogleMapsConfigured } from './google-maps'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolutionContext {
  // Customer history
  lastAddress?: string
  lastPhone?: string
  lastName?: string
  hasHistory: boolean

  // Active delivery (for complaints/shipping/order_status)
  activeDelivery?: {
    status: string
    driverName?: string
    driverPhone?: string
    estimatedTime?: string
    deliveryNumber?: string
    driverLocation?: { lat: number; lng: number; updatedAt: string }
    liveETA?: string // e.g. "~20 мин"
  }

  // Failed delivery (for redelivery requests)
  failedDelivery?: {
    deliveryNumber: string
    failureReason?: string
    address?: string
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
// 2. Delivery Status Check (for complaints/order_status)
// ---------------------------------------------------------------------------

/** Average city speed for simple ETA (km/h). UB traffic ~15 km/h. */
const AVG_SPEED_KMH = 15
/** Road winding factor: road distance ≈ 1.4× air distance in UB. */
const ROAD_FACTOR = 1.4
/** Max age for driver location before we consider it stale (ms). */
const LOCATION_MAX_AGE_MS = 30 * 60 * 1000 // 30 min

// ---------------------------------------------------------------------------
// UB District Center Coordinates (GPS)
// ---------------------------------------------------------------------------

const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  'сүхбаатар': { lat: 47.9184, lng: 106.9177 },
  'чингэлтэй': { lat: 47.9280, lng: 106.8950 },
  'баянгол': { lat: 47.9080, lng: 106.8690 },
  'хан-уул': { lat: 47.8820, lng: 106.9060 },
  'баянзүрх': { lat: 47.9350, lng: 107.0020 },
  'сонгинохайрхан': { lat: 47.9100, lng: 106.7700 },
  'налайх': { lat: 47.7460, lng: 107.2650 },
  'багануур': { lat: 47.8290, lng: 108.3530 },
  'багахангай': { lat: 47.4210, lng: 107.6270 },
}

/** Aliases map — short/Latin/colloquial names → canonical district name. */
const DISTRICT_ALIASES: Record<string, string> = {
  // Abbreviations
  'сбд': 'сүхбаатар', 'чд': 'чингэлтэй', 'бгд': 'баянгол',
  'худ': 'хан-уул', 'бзд': 'баянзүрх', 'схд': 'сонгинохайрхан',
  'нд': 'налайх', 'бн': 'багануур', 'бх': 'багахангай',
  // Latin
  'sbd': 'сүхбаатар', 'chd': 'чингэлтэй', 'bgd': 'баянгол',
  'hud': 'хан-уул', 'bzd': 'баянзүрх', 'shd': 'сонгинохайрхан',
  // Colloquial
  'сухбаатар': 'сүхбаатар', 'хануул': 'хан-уул', 'хан уул': 'хан-уул',
  'баянзурх': 'баянзүрх', 'сонгино': 'сонгинохайрхан',
  'зайсан': 'хан-уул', // Зайсан is in Хан-Уул district
}

/**
 * Parse district name from a delivery address string.
 * Returns canonical district key or null.
 */
function parseDistrictFromAddress(address: string | null): string | null {
  if (!address) return null
  const lower = address.toLowerCase().trim()

  // Direct match against canonical names
  for (const district of Object.keys(DISTRICT_CENTERS)) {
    if (lower.includes(district)) return district
  }

  // Alias match
  for (const [alias, canonical] of Object.entries(DISTRICT_ALIASES)) {
    if (lower.includes(alias)) return canonical
  }

  return null
}

/**
 * Haversine distance between two lat/lng points in km.
 */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Estimate ETA from driver location to delivery address.
 *
 * Strategy (in order):
 * 1. Google Maps Distance Matrix API (if GOOGLE_MAPS_API_KEY set) — real road ETA
 * 2. Parse district from address → use district center coords + haversine
 * 3. Fallback: UB center (47.92, 106.92) + haversine
 */
async function estimateETA(
  driverLoc: { lat: number; lng: number; updated_at?: string },
  deliveryAddress: string | null,
): Promise<string | null> {
  // Check if driver location is stale
  if (driverLoc.updated_at) {
    const age = Date.now() - new Date(driverLoc.updated_at).getTime()
    if (age > LOCATION_MAX_AGE_MS) return null
  }

  // Strategy 1: Google Maps API (real road ETA)
  if (isGoogleMapsConfigured() && deliveryAddress) {
    const googleETA = await getGoogleMapsETA(driverLoc, deliveryAddress)
    if (googleETA) return googleETA
  }

  // Strategy 2: District center coords (haversine + road factor)
  const district = parseDistrictFromAddress(deliveryAddress)
  const dest = district
    ? DISTRICT_CENTERS[district]
    : { lat: 47.92, lng: 106.92 } // UB center fallback

  const airDistKm = haversineKm(driverLoc.lat, driverLoc.lng, dest.lat, dest.lng)
  const roadDistKm = airDistKm * ROAD_FACTOR
  const etaMin = Math.round((roadDistKm / AVG_SPEED_KMH) * 60)

  if (etaMin < 1) return '~1 мин'
  if (etaMin > 120) return null // unreasonable
  return `~${etaMin} мин`
}

async function checkDeliveryStatus(
  supabase: SupabaseClient,
  customerId: string | null,
  storeId: string,
): Promise<ResolutionContext['activeDelivery'] | null> {
  if (!customerId) return null

  try {
    // First: find customer's phone from customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('phone')
      .eq('id', customerId)
      .single()

    // Strategy 1: Match via order_id → orders.customer_id
    // Strategy 2: Match via customer_phone
    // We try both for maximum coverage

    let deliveryData: Record<string, unknown> | null = null

    // Try via orders join first (most reliable)
    const { data: viaOrder } = await supabase
      .from('deliveries')
      .select(`
        status, delivery_number, estimated_delivery_time, delivery_address,
        driver_id, delivery_drivers(name, phone, current_location),
        order_id, orders!inner(customer_id)
      `)
      .eq('store_id', storeId)
      .eq('orders.customer_id', customerId)
      .in('status', ['assigned', 'picked_up', 'in_transit', 'at_store'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (viaOrder) {
      deliveryData = viaOrder as unknown as Record<string, unknown>
    }

    // Fallback: try via customer_phone if no order match
    if (!deliveryData && customer?.phone) {
      const { data: viaPhone } = await supabase
        .from('deliveries')
        .select(`
          status, delivery_number, estimated_delivery_time, delivery_address,
          driver_id, delivery_drivers(name, phone, current_location)
        `)
        .eq('store_id', storeId)
        .eq('customer_phone', customer.phone)
        .in('status', ['assigned', 'picked_up', 'in_transit', 'at_store'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (viaPhone) {
        deliveryData = viaPhone as unknown as Record<string, unknown>
      }
    }

    if (!deliveryData) return null

    const driverRaw = deliveryData.delivery_drivers
    const driver = (Array.isArray(driverRaw) ? driverRaw[0] : driverRaw) as {
      name?: string; phone?: string; current_location?: { lat: number; lng: number; updated_at?: string }
    } | null

    // Live driver location + ETA
    const loc = driver?.current_location
    let driverLocation: { lat: number; lng: number; updatedAt: string } | undefined
    let liveETA: string | undefined

    if (loc && loc.lat && loc.lng) {
      const locAge = loc.updated_at
        ? Date.now() - new Date(loc.updated_at).getTime()
        : Infinity

      if (locAge <= LOCATION_MAX_AGE_MS) {
        driverLocation = { lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at || '' }
        const eta = await estimateETA(loc, deliveryData.delivery_address as string | null)
        if (eta) liveETA = eta
      }
    }

    return {
      status: deliveryData.status as string,
      deliveryNumber: (deliveryData.delivery_number as string) || undefined,
      driverName: driver?.name || undefined,
      driverPhone: driver?.phone || undefined,
      estimatedTime: (deliveryData.estimated_delivery_time as string) || undefined,
      driverLocation,
      liveETA,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 2b. Failed Delivery Check (for redelivery requests)
// ---------------------------------------------------------------------------

async function checkFailedDelivery(
  supabase: SupabaseClient,
  customerId: string | null,
  storeId: string,
): Promise<ResolutionContext['failedDelivery'] | null> {
  if (!customerId) return null

  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('phone')
      .eq('id', customerId)
      .single()

    // Check for recently failed delivery (last 48 hours)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    const { data: viaOrder } = await supabase
      .from('deliveries')
      .select(`
        delivery_number, failure_reason, delivery_address,
        orders!inner(customer_id)
      `)
      .eq('store_id', storeId)
      .eq('orders.customer_id', customerId)
      .eq('status', 'failed')
      .gte('updated_at', twoDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single() as { data: { delivery_number: string; failure_reason?: string; delivery_address?: string } | null }

    if (viaOrder) {
      return {
        deliveryNumber: viaOrder.delivery_number,
        failureReason: viaOrder.failure_reason || undefined,
        address: viaOrder.delivery_address || undefined,
      }
    }

    // Fallback: phone match
    if (customer?.phone) {
      const { data: viaPhone } = await supabase
        .from('deliveries')
        .select('delivery_number, failure_reason, delivery_address')
        .eq('store_id', storeId)
        .eq('customer_phone', customer.phone)
        .eq('status', 'failed')
        .gte('updated_at', twoDaysAgo)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (viaPhone) {
        return {
          deliveryNumber: viaPhone.delivery_number,
          failureReason: viaPhone.failure_reason || undefined,
          address: viaPhone.delivery_address || undefined,
        }
      }
    }

    return null
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
    const DELIVERY_INTENTS = [...EMPATHY_INTENTS, 'order_status']
    const needsDelivery = DELIVERY_INTENTS.includes(ctx.intent)

    const isRedeliveryRequest = /дахин хүрг|дахин авах|дахин захиал|redelivery/i.test(ctx.message)

    const [history, delivery, storeSettings, failedDelivery] = await Promise.all([
      checkCustomerHistory(supabase, ctx.customerId, ctx.storeId),
      needsDelivery ? checkDeliveryStatus(supabase, ctx.customerId, ctx.storeId) : null,
      checkStoreSettings(supabase, ctx.storeId),
      isRedeliveryRequest ? checkFailedDelivery(supabase, ctx.customerId, ctx.storeId) : null,
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
      failedDelivery: failedDelivery || undefined,

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
