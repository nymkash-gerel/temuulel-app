import { jsonCompletion } from './openai-client'

export interface DeliveryStop {
  delivery_id: string
  delivery_number: string
  address: string
  customer_name: string | null
}

export interface OptimizedRoute {
  ordered_stops: { delivery_id: string; order: number; reason: string }[]
  method: 'ai' | 'nearest_neighbor'
  estimated_distance_note?: string
}

/**
 * Optimize delivery route using AI.
 * Falls back to nearest-neighbor if AI fails.
 */
export async function optimizeRoute(
  stops: DeliveryStop[],
  driverLocation: { lat: number; lng: number } | null,
): Promise<OptimizedRoute> {
  if (stops.length <= 1) {
    return {
      ordered_stops: stops.map((s, i) => ({
        delivery_id: s.delivery_id,
        order: i + 1,
        reason: 'Ганц хүргэлт',
      })),
      method: 'nearest_neighbor',
    }
  }

  try {
    return await aiOptimize(stops, driverLocation)
  } catch (err) {
    console.error('[route-optimizer] AI failed, using nearest-neighbor:', err)
    return nearestNeighbor(stops, driverLocation)
  }
}

async function aiOptimize(
  stops: DeliveryStop[],
  driverLocation: { lat: number; lng: number } | null,
): Promise<OptimizedRoute> {
  const stopsDesc = stops.map((s, i) => `${i + 1}. [${s.delivery_id}] ${s.address} (${s.customer_name || 'N/A'})`).join('\n')

  const systemPrompt = `You are a delivery route optimizer for Ulaanbaatar, Mongolia.
Given a list of delivery stops, return the optimal order to minimize total driving time.
Consider Ulaanbaatar's road layout, traffic patterns, and geographical proximity.

Return JSON in this exact format:
{
  "ordered_stops": [
    { "delivery_id": "uuid", "order": 1, "reason": "Brief reason in Mongolian" }
  ],
  "estimated_distance_note": "Brief note about the route"
}`

  const driverPos = driverLocation
    ? `Жолоочийн одоогийн байршил: ${driverLocation.lat.toFixed(5)}, ${driverLocation.lng.toFixed(5)}`
    : 'Жолоочийн байршил тодорхойгүй'

  const userContent = `${driverPos}

Хүргэлтүүд:
${stopsDesc}

Эдгээр хүргэлтийг хамгийн оновчтой дарааллаар эрэмбэлнэ үү.`

  const result = await jsonCompletion<OptimizedRoute>({
    systemPrompt,
    userContent,
    temperature: 0.2,
    maxTokens: 500,
  })

  // Validate all delivery IDs are present
  const ids = new Set(stops.map(s => s.delivery_id))
  const returnedIds = new Set(result.data.ordered_stops.map(s => s.delivery_id))

  if (ids.size !== returnedIds.size || ![...ids].every(id => returnedIds.has(id))) {
    throw new Error('AI returned mismatched delivery IDs')
  }

  return { ...result.data, method: 'ai' }
}

/**
 * Simple nearest-neighbor heuristic.
 * Uses address string similarity as a proxy for distance.
 */
function nearestNeighbor(
  stops: DeliveryStop[],
  _driverLocation: { lat: number; lng: number } | null,
): OptimizedRoute {
  // Group by district keywords for basic clustering
  const districtKeywords = [
    'Баянзүрх', 'Сүхбаатар', 'Хан-Уул', 'Баянгол', 'Сонгинохайрхан', 'Чингэлтэй',
    'Налайх', 'Багануур', 'Багахангай',
  ]

  const grouped = stops.map(s => {
    const district = districtKeywords.find(d => s.address.includes(d)) || 'other'
    return { ...s, district }
  })

  // Sort by district then by address for locality
  grouped.sort((a, b) => {
    if (a.district !== b.district) return a.district.localeCompare(b.district)
    return a.address.localeCompare(b.address)
  })

  return {
    ordered_stops: grouped.map((s, i) => ({
      delivery_id: s.delivery_id,
      order: i + 1,
      reason: `${s.district} дүүрэг — ойр байршлаар эрэмбэлсэн`,
    })),
    method: 'nearest_neighbor',
    estimated_distance_note: 'Дүүргийн байршлаар бүлэглэсэн',
  }
}
