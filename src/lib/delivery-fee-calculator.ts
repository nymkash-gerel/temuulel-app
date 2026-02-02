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
 * Calculate delivery fee based on address district keywords.
 */
export function calculateDeliveryFee(address: string): FeeResult {
  const normalized = address.toLowerCase()

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
