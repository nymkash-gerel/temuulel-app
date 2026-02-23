/**
 * Zone-based delivery fee calculator for Ulaanbaatar districts.
 * Supports inner-city driver delivery and intercity bus/post delivery.
 */

export interface Zone {
  name: string
  nameMn: string
  districts: string[]
  fee: number
}

export type FeeResultType = 'inner_city' | 'intercity' | 'not_covered' | 'default'

export interface FeeResult {
  type: FeeResultType
  fee: number
  zone: string
  district: string | null
  /** For intercity: customer pays on arrival — no fee charged at checkout */
  intercityCity?: string
}

// ---------------------------------------------------------------------------
// Default inner-city district zones (fallback when store has no settings)
// ---------------------------------------------------------------------------

const DEFAULT_ZONES: Zone[] = [
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

// ---------------------------------------------------------------------------
// Known intercity cities (bus/post delivery)
// ---------------------------------------------------------------------------

export const INTERCITY_CITIES: string[] = [
  'Дархан', 'Эрдэнэт', 'Налайх', 'Чойбалсан', 'Мөрөн', 'Улаангом',
  'Ховд', 'Алтай', 'Баянхонгор', 'Арвайхээр', 'Мандалговь',
  'Сайншанд', 'Даланзадгад', 'Зуунмод', 'Хархорин', 'Цэцэрлэг',
  'Өлгий', 'Баруун-Урт', 'Сүхбаатар хот', 'Багануур хот',
]

// ---------------------------------------------------------------------------
// District aliases for fuzzy matching
// ---------------------------------------------------------------------------

const DISTRICT_ALIASES: Record<string, string> = {
  'сбд': 'Сүхбаатар', 'sbd': 'Сүхбаатар', 'сухбаатар': 'Сүхбаатар',
  'чд': 'Чингэлтэй', 'chd': 'Чингэлтэй', 'чингэлтэй': 'Чингэлтэй',
  'бгд': 'Баянгол', 'bgd': 'Баянгол', 'баянгол': 'Баянгол',
  'худ': 'Хан-Уул', 'hud': 'Хан-Уул', 'хан-уул': 'Хан-Уул', 'хануул': 'Хан-Уул',
  'бзд': 'Баянзүрх', 'bzd': 'Баянзүрх', 'баянзурх': 'Баянзүрх', 'баянзүрх': 'Баянзүрх',
  'схд': 'Сонгинохайрхан', 'shd': 'Сонгинохайрхан', 'сонгино': 'Сонгинохайрхан',
  'налайх': 'Налайх', 'багануур': 'Багануур', 'багахангай': 'Багахангай',
}

// City aliases for fuzzy matching
const CITY_ALIASES: Record<string, string> = {
  'дархан': 'Дархан', 'darkhan': 'Дархан',
  'эрдэнэт': 'Эрдэнэт', 'erdenet': 'Эрдэнэт',
  'налайх': 'Налайх', 'nalaikh': 'Налайх',
  'чойбалсан': 'Чойбалсан',
  'мөрөн': 'Мөрөн', 'moron': 'Мөрөн',
  'улаангом': 'Улаангом',
  'ховд': 'Ховд',
  'алтай': 'Алтай',
  'баянхонгор': 'Баянхонгор',
  'арвайхээр': 'Арвайхээр',
  'мандалговь': 'Мандалговь',
  'сайншанд': 'Сайншанд',
  'даланзадгад': 'Даланзадгад',
  'зуунмод': 'Зуунмод',
  'хархорин': 'Хархорин', 'хархорум': 'Хархорин',
  'цэцэрлэг': 'Цэцэрлэг',
  'өлгий': 'Өлгий',
  'баруун-урт': 'Баруун-Урт',
}

// ---------------------------------------------------------------------------
// Store shipping settings shape (for context-aware calculation)
// ---------------------------------------------------------------------------

export interface StoreShippingSettings {
  inner_city?: {
    enabled: boolean
    price: number
    estimated_hours: string
    districts: string[]
  }
  intercity?: {
    enabled: boolean
    cities: string[]
  }
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calculate delivery fee based on address text.
 *
 * If store shipping settings are provided, uses those districts/cities.
 * Otherwise falls back to the built-in DEFAULT_ZONES.
 */
export function calculateDeliveryFee(
  address: string,
  storeSettings?: StoreShippingSettings
): FeeResult {
  const normalized = address.toLowerCase()
  const words = normalized.split(/[\s,;.]+/)

  // ----- 1. Check intercity first (intercity wins over district match) -----

  const coveredCities = storeSettings?.intercity?.enabled
    ? storeSettings.intercity.cities
    : INTERCITY_CITIES

  // Alias match
  for (const word of words) {
    const canonical = CITY_ALIASES[word]
    if (canonical && coveredCities.includes(canonical)) {
      return {
        type: 'intercity',
        fee: 0,
        zone: 'Intercity',
        district: null,
        intercityCity: canonical,
      }
    }
  }
  // Substring match on city names
  for (const city of coveredCities) {
    if (normalized.includes(city.toLowerCase())) {
      return {
        type: 'intercity',
        fee: 0,
        zone: 'Intercity',
        district: null,
        intercityCity: city,
      }
    }
  }

  // ----- 2. Inner city districts -----

  if (storeSettings?.inner_city?.enabled) {
    // Use store's configured districts + price
    const { districts, price } = storeSettings.inner_city

    for (const word of words) {
      const canonical = DISTRICT_ALIASES[word]
      if (canonical && districts.includes(canonical)) {
        return { type: 'inner_city', fee: price, zone: 'InnerCity', district: canonical }
      }
    }
    for (const district of districts) {
      if (normalized.includes(district.toLowerCase())) {
        return { type: 'inner_city', fee: price, zone: 'InnerCity', district }
      }
    }

    // Address doesn't match any covered district
    return { type: 'not_covered', fee: price, zone: 'InnerCity', district: null }
  }

  // ----- 3. Fallback: built-in DEFAULT_ZONES -----

  for (const word of words) {
    const canonical = DISTRICT_ALIASES[word]
    if (canonical) {
      const zone = DEFAULT_ZONES.find((z) => z.districts.includes(canonical))
      if (zone) return { type: 'inner_city', fee: zone.fee, zone: zone.name, district: canonical }
    }
  }
  for (const zone of DEFAULT_ZONES) {
    for (const district of zone.districts) {
      if (normalized.includes(district.toLowerCase())) {
        return { type: 'inner_city', fee: zone.fee, zone: zone.name, district }
      }
    }
  }

  return { type: 'default', fee: DEFAULT_FEE, zone: 'Default', district: null }
}

/**
 * Get all built-in delivery zones with districts and fees.
 */
export function getDeliveryZones(): Zone[] {
  return DEFAULT_ZONES
}

/**
 * Get the full list of known intercity cities.
 */
export function getIntercitiyCities(): string[] {
  return INTERCITY_CITIES
}
