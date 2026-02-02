import { isOpenAIConfigured, jsonCompletion } from './openai-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriverCandidate {
  id: string
  name: string
  location: { lat: number; lng: number } | null
  active_delivery_count: number
  vehicle_type: string | null
  completion_rate: number // 0-100
}

export interface DeliveryContext {
  address: string
  customer_zone?: string
  items_count?: number
  estimated_weight?: number
}

export interface AssignmentRules {
  assignment_mode: 'auto' | 'suggest' | 'manual'
  priority_rules: string[]
  max_concurrent_deliveries: number
  assignment_radius_km: number
  working_hours?: { start: string; end: string }
}

export interface RankedDriver {
  driver_id: string
  driver_name: string
  score: number
  reasons: string[]
}

export interface AssignmentResult {
  recommended_driver_id: string | null
  ranked_drivers: RankedDriver[]
  confidence: number // 0-100
  method: 'ai' | 'deterministic'
}

// ---------------------------------------------------------------------------
// Default store settings
// ---------------------------------------------------------------------------

export const DEFAULT_DELIVERY_SETTINGS: AssignmentRules = {
  assignment_mode: 'manual',
  priority_rules: ['least_loaded', 'closest_driver'],
  max_concurrent_deliveries: 3,
  assignment_radius_km: 10,
}

// ---------------------------------------------------------------------------
// Deterministic scoring (fallback / primary for non-AI mode)
// ---------------------------------------------------------------------------

function deterministicAssign(
  delivery: DeliveryContext,
  drivers: DriverCandidate[],
  rules: AssignmentRules,
): AssignmentResult {
  if (drivers.length === 0) {
    return { recommended_driver_id: null, ranked_drivers: [], confidence: 0, method: 'deterministic' }
  }

  // Filter out overloaded drivers
  const eligible = drivers.filter(d => d.active_delivery_count < rules.max_concurrent_deliveries)

  if (eligible.length === 0) {
    return { recommended_driver_id: null, ranked_drivers: [], confidence: 0, method: 'deterministic' }
  }

  // Build weighted scores based on priority_rules order
  const priorityWeights: Record<string, number> = {}
  const totalRules = rules.priority_rules.length
  rules.priority_rules.forEach((rule, i) => {
    priorityWeights[rule] = (totalRules - i) / totalRules // Decreasing weight
  })

  const scored = eligible.map(driver => {
    let score = 0
    const reasons: string[] = []

    // Least loaded — fewer active deliveries = higher score
    if (priorityWeights['least_loaded']) {
      const maxLoad = rules.max_concurrent_deliveries
      const loadScore = (maxLoad - driver.active_delivery_count) / maxLoad
      score += loadScore * (priorityWeights['least_loaded'] || 0)
      if (driver.active_delivery_count === 0) reasons.push('Чөлөөтэй')
      else reasons.push(`${driver.active_delivery_count} идэвхтэй хүргэлт`)
    }

    // Closest driver — requires location data
    if (priorityWeights['closest_driver'] && driver.location) {
      // Simple proximity bonus (without actual distance calculation)
      score += 0.5 * (priorityWeights['closest_driver'] || 0)
      reasons.push('Байршил ойр')
    }

    // Vehicle match — prefer larger vehicles for larger orders
    if (priorityWeights['vehicle_match']) {
      const vehicleScores: Record<string, number> = {
        car: 1.0, motorcycle: 0.8, bicycle: 0.5, on_foot: 0.3,
      }
      const vs = vehicleScores[driver.vehicle_type || 'motorcycle'] || 0.5
      score += vs * (priorityWeights['vehicle_match'] || 0)
      reasons.push(`Тээвэр: ${driver.vehicle_type || 'тодорхойгүй'}`)
    }

    // Rating first — higher completion rate = higher score
    if (priorityWeights['rating_first']) {
      const ratingScore = driver.completion_rate / 100
      score += ratingScore * (priorityWeights['rating_first'] || 0)
      if (driver.completion_rate >= 90) reasons.push('Өндөр амжилт')
    }

    // Round robin — equal scores (randomized)
    if (priorityWeights['round_robin']) {
      score += Math.random() * 0.3 * (priorityWeights['round_robin'] || 0)
      reasons.push('Ээлжлэн')
    }

    return { driver_id: driver.id, driver_name: driver.name, score: Math.round(score * 100), reasons }
  })

  scored.sort((a, b) => b.score - a.score)

  const confidence = scored.length >= 2 && scored[0].score > scored[1].score + 10 ? 85 : 60

  return {
    recommended_driver_id: scored[0]?.driver_id || null,
    ranked_drivers: scored.slice(0, 5),
    confidence,
    method: 'deterministic',
  }
}

// ---------------------------------------------------------------------------
// AI-powered assignment
// ---------------------------------------------------------------------------

async function aiAssign(
  delivery: DeliveryContext,
  drivers: DriverCandidate[],
  rules: AssignmentRules,
): Promise<AssignmentResult> {
  const systemPrompt = `You are a delivery assignment optimizer for a Mongolian ecommerce platform.
Given a delivery and available drivers, rank the best driver to assign.

Rules (in priority order): ${rules.priority_rules.join(', ')}
Max concurrent deliveries per driver: ${rules.max_concurrent_deliveries}

Return JSON: {
  "recommended_driver_id": "uuid",
  "ranked_drivers": [{"driver_id": "uuid", "score": 0-100, "reasons": ["reason1"]}],
  "confidence": 0-100
}

Reasons should be in Mongolian. Keep them short (2-4 words each).`

  const userContent = JSON.stringify({
    delivery: {
      address: delivery.address,
      zone: delivery.customer_zone || 'тодорхойгүй',
      items: delivery.items_count || 1,
    },
    drivers: drivers.map(d => ({
      id: d.id,
      name: d.name,
      active: d.active_delivery_count,
      vehicle: d.vehicle_type,
      completion_rate: d.completion_rate,
      has_location: !!d.location,
    })),
  })

  try {
    const result = await jsonCompletion<{
      recommended_driver_id: string
      ranked_drivers: RankedDriver[]
      confidence: number
    }>({
      systemPrompt,
      userContent,
      maxTokens: 300,
      temperature: 0.2,
    })

    return { ...result.data, method: 'ai' }
  } catch (err) {
    console.error('[delivery-assigner] AI assignment failed, falling back to deterministic:', err)
    return deterministicAssign(delivery, drivers, rules)
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Assign the best driver for a delivery based on store rules.
 *
 * - If OpenAI is configured and assignment_mode is 'auto' or 'suggest', uses AI.
 * - Otherwise falls back to deterministic scoring.
 * - Returns null recommended_driver_id if no eligible drivers.
 */
export async function assignDriver(
  delivery: DeliveryContext,
  drivers: DriverCandidate[],
  rules: AssignmentRules,
): Promise<AssignmentResult> {
  if (rules.assignment_mode === 'manual') {
    return { recommended_driver_id: null, ranked_drivers: [], confidence: 0, method: 'deterministic' }
  }

  // Check working hours
  if (rules.working_hours) {
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (currentTime < rules.working_hours.start || currentTime > rules.working_hours.end) {
      return { recommended_driver_id: null, ranked_drivers: [], confidence: 0, method: 'deterministic' }
    }
  }

  if (isOpenAIConfigured() && drivers.length > 0) {
    return aiAssign(delivery, drivers, rules)
  }

  return deterministicAssign(delivery, drivers, rules)
}
