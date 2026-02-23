/**
 * Zone-based delivery fee calculator for Ulaanbaatar districts.
 */

interface Zone {
  name: string
  nameMn: string
  districts: string[]
  fee: number
}

interface FeeResult {
  fee: number
  zone: string
  district: string | null
}

const ZONES: Zone[] = [
  {
    name: 'Central',
    nameMn: 'Төв бүс',
    districts: ['Сүхбаатар', 'Чингэлтэй', 'Баянгол'],
    fee: 3000,
  },
  {
    name: 'Mid',
    nameMn: 'Дунд бүс',
    districts: ['Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'],
    fee: 5000,
  },
  {
    name: 'Outer',
    nameMn: 'Алслагдсан бүс',
    districts: ['Налайх', 'Багануур', 'Багахангай'],
    fee: 8000,
  },
]

const DEFAULT_FEE = 5000

/**
 * Common abbreviations for UB districts.
 * Maps lowercase abbreviation → canonical district name.
 */
const DISTRICT_ALIASES: Record<string, string> = {
  'сбд': 'Сүхбаатар', 'sbd': 'Сүхбаатар', 'сухбаатар': 'Сүхбаатар',
  'чд': 'Чингэлтэй', 'chd': 'Чингэлтэй', 'чингэлтэй': 'Чингэлтэй',
  'бгд': 'Баянгол', 'bgd': 'Баянгол', 'баянгол': 'Баянгол',
  'худ': 'Хан-Уул', 'hud': 'Хан-Уул', 'хан-уул': 'Хан-Уул', 'хануул': 'Хан-Уул',
  'бзд': 'Баянзүрх', 'bzd': 'Баянзүрх', 'баянзурх': 'Баянзүрх', 'баянзүрх': 'Баянзүрх',
  'схд': 'Сонгинохайрхан', 'shd': 'Сонгинохайрхан', 'сонгино': 'Сонгинохайрхан',
  'налайх': 'Налайх', 'багануур': 'Багануур', 'багахангай': 'Багахангай',
}

/**
 * Calculate delivery fee based on address district keywords.
 */
export function calculateDeliveryFee(address: string): FeeResult {
  const normalized = address.toLowerCase()

  // Check abbreviation aliases first
  const words = normalized.split(/[\s,;]+/)
  for (const word of words) {
    const canonical = DISTRICT_ALIASES[word]
    if (canonical) {
      const zone = ZONES.find((z) => z.districts.includes(canonical))
      if (zone) return { fee: zone.fee, zone: zone.name, district: canonical }
    }
  }

  // Fallback: substring match on full district names
  for (const zone of ZONES) {
    for (const district of zone.districts) {
      if (normalized.includes(district.toLowerCase())) {
        return { fee: zone.fee, zone: zone.name, district }
      }
    }
  }

  return { fee: DEFAULT_FEE, zone: 'Default', district: null }
}

/**
 * Get all delivery zones with districts and fees.
 */
export function getDeliveryZones(): Zone[] {
  return ZONES
}
