/**
 * Google Maps API wrapper for delivery ETA and geocoding.
 *
 * Uses Distance Matrix API for travel time and Geocoding API for address → coords.
 * Falls back gracefully when GOOGLE_MAPS_API_KEY is not set.
 *
 * @see https://developers.google.com/maps/documentation/distance-matrix
 * @see https://developers.google.com/maps/documentation/geocoding
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistanceMatrixResult {
  distanceMeters: number
  durationSeconds: number
  durationText: string // e.g. "12 мин"
}

export interface GeocodingResult {
  lat: number
  lng: number
  formattedAddress: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

/** Simple in-memory LRU cache for geocoding results. */
const geocodeCache = new Map<string, GeocodingResult | null>()
const CACHE_MAX_SIZE = 200

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if Google Maps API is configured.
 */
export function isGoogleMapsConfigured(): boolean {
  return API_KEY.length > 10
}

/**
 * Get driving distance and duration between two points.
 * Returns null if API key is not set or request fails.
 */
export async function getDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DistanceMatrixResult | null> {
  if (!isGoogleMapsConfigured()) return null

  try {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      mode: 'driving',
      language: 'mn',
      key: API_KEY,
    })

    const res = await fetch(`${DISTANCE_MATRIX_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const data = await res.json()
    const element = data?.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return null

    return {
      distanceMeters: element.distance.value,
      durationSeconds: element.duration.value,
      durationText: element.duration.text,
    }
  } catch {
    return null
  }
}

/**
 * Geocode an address string to lat/lng coordinates.
 * Results are cached in memory.
 * Returns null if API key is not set or address cannot be geocoded.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!isGoogleMapsConfigured()) return null

  const cacheKey = address.toLowerCase().trim()
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) || null

  try {
    const params = new URLSearchParams({
      address: `${address}, Ulaanbaatar, Mongolia`,
      language: 'mn',
      key: API_KEY,
    })

    const res = await fetch(`${GEOCODING_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      cacheResult(cacheKey, null)
      return null
    }

    const data = await res.json()
    const result = data?.results?.[0]
    if (!result) {
      cacheResult(cacheKey, null)
      return null
    }

    const geocoded: GeocodingResult = {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    }

    cacheResult(cacheKey, geocoded)
    return geocoded
  } catch {
    cacheResult(cacheKey, null)
    return null
  }
}

/**
 * Get ETA from driver location to delivery address using Google Maps.
 * Returns "~N мин" string or null if not available.
 */
export async function getGoogleMapsETA(
  driverLoc: { lat: number; lng: number },
  deliveryAddress: string,
): Promise<string | null> {
  if (!isGoogleMapsConfigured()) return null

  // Try geocoding the delivery address first
  const dest = await geocodeAddress(deliveryAddress)
  if (!dest) return null

  // Get driving distance/duration
  const result = await getDistanceMatrix(driverLoc, { lat: dest.lat, lng: dest.lng })
  if (!result) return null

  const etaMin = Math.round(result.durationSeconds / 60)
  if (etaMin < 1) return '~1 мин'
  if (etaMin > 120) return null
  return `~${etaMin} мин`
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function cacheResult(key: string, value: GeocodingResult | null): void {
  // Evict oldest entries if cache is full
  if (geocodeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = geocodeCache.keys().next().value
    if (firstKey !== undefined) geocodeCache.delete(firstKey)
  }
  geocodeCache.set(key, value)
}
