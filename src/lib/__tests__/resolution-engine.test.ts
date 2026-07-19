/**
 * Unit tests for the Resolution Engine — real-time logistics sync.
 *
 * Covers: district parsing, haversine ETA, stale-location rejection,
 * estimated-time formatting, delivery lookup (order + phone fallback),
 * customer-history scoping, empathy detection, and product disambiguation.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolve,
  parseDistrictFromAddress,
  haversineKm,
  estimateETA,
  formatEstimatedTime,
} from '../resolution-engine'

// ---------------------------------------------------------------------------
// Mock Supabase — per-table queue of .single() results, records filter calls
// ---------------------------------------------------------------------------

interface RecordedCall {
  table: string
  method: string
  args: unknown[]
}

function createMockSupabase(tableResults: Record<string, unknown[]>) {
  const calls: RecordedCall[] = []
  const queues: Record<string, unknown[]> = {}
  for (const [table, results] of Object.entries(tableResults)) {
    queues[table] = [...results]
  }

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'order', 'limit', 'in', 'gte']) {
      builder[m] = vi.fn((...args: unknown[]) => {
        calls.push({ table, method: m, args })
        return builder
      })
    }
    builder.single = vi.fn(async () => {
      const queue = queues[table] || []
      const data = queue.length > 0 ? queue.shift() : null
      return { data, error: data ? null : { message: 'not found' } }
    })
    return builder
  })

  return { client: { from } as unknown as SupabaseClient, calls }
}

const baseInput = {
  intent: 'general',
  message: 'сайн уу',
  storeId: 'store-1',
  customerId: 'cust-1',
  products: [] as Array<{ id?: string; name: string }>,
}

const storeRow = {
  address: 'Сүхбаатар дүүрэг, 1-р хороо, Оюутны гудамж 5',
  phone: '77112233',
  shipping_settings: { inner_city: { price: 5000 }, free_shipping_minimum: 100000 },
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('parseDistrictFromAddress', () => {
  it('matches canonical district names', () => {
    expect(parseDistrictFromAddress('Хан-Уул дүүрэг, 11-р хороо')).toBe('хан-уул')
    expect(parseDistrictFromAddress('Баянзүрх дүүрэг 26-р хороо')).toBe('баянзүрх')
  })

  it('matches Cyrillic abbreviations', () => {
    expect(parseDistrictFromAddress('СБД 8-р хороо, 45-р байр')).toBe('сүхбаатар')
    expect(parseDistrictFromAddress('БГД, 3-р хороо')).toBe('баянгол')
  })

  it('matches Latin abbreviations', () => {
    expect(parseDistrictFromAddress('BZD 14 horoo')).toBe('баянзүрх')
  })

  it('matches colloquial names', () => {
    expect(parseDistrictFromAddress('Зайсан, Богд уулын урд')).toBe('хан-уул')
    expect(parseDistrictFromAddress('сонгино руу')).toBe('сонгинохайрхан')
  })

  it('returns null for unknown or empty addresses', () => {
    expect(parseDistrictFromAddress('Дархан хот, 5-р баг')).toBeNull()
    expect(parseDistrictFromAddress(null)).toBeNull()
    expect(parseDistrictFromAddress('')).toBeNull()
  })
})

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(47.9184, 106.9177, 47.9184, 106.9177)).toBe(0)
  })

  it('computes a plausible cross-city distance', () => {
    // Сүхбаатар center → Сонгинохайрхан center ≈ 11 km air
    const km = haversineKm(47.9184, 106.9177, 47.91, 106.77)
    expect(km).toBeGreaterThan(9)
    expect(km).toBeLessThan(13)
  })
})

describe('estimateETA', () => {
  it('returns minutes estimate for a fresh driver location near the district', () => {
    // Driver exactly at Сүхбаатар center, delivering within Сүхбаатар
    return estimateETA(
      { lat: 47.9184, lng: 106.9177, updated_at: new Date().toISOString() },
      'Сүхбаатар дүүрэг, 1-р хороо',
    ).then((eta) => {
      expect(eta).toBe('~1 мин')
    })
  })

  it('rejects stale driver locations (>30 min old)', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const eta = await estimateETA(
      { lat: 47.9184, lng: 106.9177, updated_at: twoHoursAgo },
      'Сүхбаатар дүүрэг',
    )
    expect(eta).toBeNull()
  })

  it('returns null for unreasonably long ETAs (>120 min)', async () => {
    // Driver in Багануур (~100+ km from Сонгинохайрхан)
    const eta = await estimateETA(
      { lat: 47.829, lng: 108.353, updated_at: new Date().toISOString() },
      'СХД 20-р хороо',
    )
    expect(eta).toBeNull()
  })

  it('falls back to UB center when no district is found', async () => {
    const eta = await estimateETA(
      { lat: 47.92, lng: 106.92, updated_at: new Date().toISOString() },
      'хаяг тодорхойгүй',
    )
    expect(eta).toBe('~1 мин')
  })
})

describe('formatEstimatedTime', () => {
  // 06:30 UTC = 14:30 Ulaanbaatar (UTC+8)
  it('formats same-day timestamps as HH:MM', () => {
    const now = new Date('2026-07-12T01:00:00Z')
    expect(formatEstimatedTime('2026-07-12T06:30:00Z', now)).toBe('14:30')
  })

  it('prefixes MM/DD for other-day timestamps', () => {
    const now = new Date('2026-07-12T01:00:00Z')
    expect(formatEstimatedTime('2026-07-13T06:30:00Z', now)).toBe('07/13 14:30')
  })

  it('handles UB day rollover (late UTC = next UB day)', () => {
    // 22:00 UTC on 07-12 = 06:00 UB on 07-13
    const now = new Date('2026-07-12T01:00:00Z')
    expect(formatEstimatedTime('2026-07-12T22:00:00Z', now)).toBe('07/13 06:00')
  })

  it('returns raw string when unparseable', () => {
    expect(formatEstimatedTime('маргааш орой')).toBe('маргааш орой')
  })
})

// ---------------------------------------------------------------------------
// resolve() — integration with mocked Supabase
// ---------------------------------------------------------------------------

describe('resolve — customer history', () => {
  it('scopes order history to the requesting customer (privacy)', async () => {
    const { client, calls } = createMockSupabase({
      orders: [{ shipping_address: 'ХУД 11-р хороо', customer_phone: '99110022', customer_name: 'Болд' }],
      stores: [storeRow],
    })

    const ctx = await resolve(client, { ...baseInput })

    expect(ctx.lastAddress).toBe('ХУД 11-р хороо')
    const orderEqs = calls.filter((c) => c.table === 'orders' && c.method === 'eq')
    expect(orderEqs).toContainEqual({ table: 'orders', method: 'eq', args: ['customer_id', 'cust-1'] })
    expect(orderEqs).toContainEqual({ table: 'orders', method: 'eq', args: ['store_id', 'store-1'] })
  })

  it('skips history lookup when customerId is null', async () => {
    const { client, calls } = createMockSupabase({ stores: [storeRow] })

    const ctx = await resolve(client, { ...baseInput, customerId: null })

    expect(ctx.hasHistory).toBe(false)
    expect(calls.some((c) => c.table === 'orders')).toBe(false)
  })
})

describe('resolve — live delivery status', () => {
  const freshLocation = {
    lat: 47.9184, lng: 106.9177, updated_at: new Date().toISOString(),
  }

  const deliveryRow = (overrides: Record<string, unknown> = {}) => ({
    status: 'in_transit',
    delivery_number: 'DEL-042',
    estimated_delivery_time: null,
    delivery_address: 'Сүхбаатар дүүрэг, 1-р хороо',
    driver_id: 'drv-1',
    delivery_drivers: { name: 'Бат', phone: '99887766', current_location: freshLocation },
    order_id: 'ord-1',
    orders: { customer_id: 'cust-1' },
    ...overrides,
  })

  it('returns driver, live ETA and delivery number for an in-transit delivery', async () => {
    const { client } = createMockSupabase({
      customers: [{ phone: '99110022' }],
      deliveries: [deliveryRow()],
      stores: [storeRow],
    })

    const ctx = await resolve(client, { ...baseInput, intent: 'order_status', message: 'хүргэлт хаана явна?' })

    expect(ctx.activeDelivery).toBeDefined()
    expect(ctx.activeDelivery?.status).toBe('in_transit')
    expect(ctx.activeDelivery?.driverName).toBe('Бат')
    expect(ctx.activeDelivery?.deliveryNumber).toBe('DEL-042')
    expect(ctx.activeDelivery?.liveETA).toBe('~1 мин')
    expect(ctx.activeDelivery?.driverLocation).toBeDefined()
  })

  it('queries active statuses including pending and delayed', async () => {
    const { client, calls } = createMockSupabase({
      customers: [{ phone: '99110022' }],
      deliveries: [deliveryRow({ status: 'delayed' })],
      stores: [storeRow],
    })

    await resolve(client, { ...baseInput, intent: 'shipping', message: 'хэзээ ирэх вэ' })

    const inCall = calls.find((c) => c.table === 'deliveries' && c.method === 'in')
    expect(inCall).toBeDefined()
    const statuses = inCall!.args[1] as string[]
    expect(statuses).toContain('pending')
    expect(statuses).toContain('delayed')
    expect(statuses).toContain('in_transit')
  })

  it('formats estimated_delivery_time into UB local time', async () => {
    const { client } = createMockSupabase({
      customers: [{ phone: '99110022' }],
      deliveries: [deliveryRow({
        status: 'delayed',
        estimated_delivery_time: '2026-07-13T06:30:00Z',
        delivery_drivers: null,
      })],
      stores: [storeRow],
    })

    const ctx = await resolve(client, { ...baseInput, intent: 'order_status', message: 'захиалга хаана' })

    // 06:30 UTC = 14:30 UB; date prefix depends on the day the test runs
    expect(ctx.activeDelivery?.estimatedTime).toContain('14:30')
    expect(ctx.activeDelivery?.estimatedTime).not.toContain('2026-07-13T')
  })

  it('drops stale driver locations — no liveETA, no GPS flag', async () => {
    const staleLocation = {
      lat: 47.9184, lng: 106.9177,
      updated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }
    const { client } = createMockSupabase({
      customers: [{ phone: '99110022' }],
      deliveries: [deliveryRow({
        delivery_drivers: { name: 'Бат', phone: '99887766', current_location: staleLocation },
      })],
      stores: [storeRow],
    })

    const ctx = await resolve(client, { ...baseInput, intent: 'order_status', message: 'хүргэлт' })

    expect(ctx.activeDelivery?.driverName).toBe('Бат')
    expect(ctx.activeDelivery?.liveETA).toBeUndefined()
    expect(ctx.activeDelivery?.driverLocation).toBeUndefined()
  })

  it('skips delivery lookup for non-delivery intents', async () => {
    const { client, calls } = createMockSupabase({
      orders: [{ shipping_address: 'ХУД', customer_phone: '1', customer_name: 'A' }],
      stores: [storeRow],
    })

    const ctx = await resolve(client, { ...baseInput, intent: 'product_search', message: 'цамц байна уу' })

    expect(ctx.activeDelivery).toBeUndefined()
    expect(calls.some((c) => c.table === 'deliveries')).toBe(false)
  })
})

describe('resolve — misc context', () => {
  it('sets productsEmpty when no products found', async () => {
    const { client } = createMockSupabase({ stores: [storeRow] })
    const ctx = await resolve(client, { ...baseInput, customerId: null, products: [] })
    expect(ctx.productsEmpty).toBe(true)
  })

  it('uses empathetic tone for complaints', async () => {
    const { client } = createMockSupabase({ stores: [storeRow] })
    const ctx = await resolve(client, {
      ...baseInput, customerId: null, intent: 'complaint', message: 'захиалга ирсэнгүй',
    })
    expect(ctx.tone).toBe('empathetic')
  })

  it('disambiguates the best-matching product', async () => {
    const { client } = createMockSupabase({ stores: [storeRow] })
    const ctx = await resolve(client, {
      ...baseInput,
      customerId: null,
      message: 'хар өнгийн малгай авмаар байна',
      products: [
        { id: 'p1', name: 'Цагаан цамц' },
        { id: 'p2', name: 'Хар малгай' },
      ],
    })
    expect(ctx.bestProductId).toBe('p2')
    expect(ctx.bestProductName).toBe('Хар малгай')
  })

  it('exposes shipping fee and free-shipping threshold from store settings', async () => {
    const { client } = createMockSupabase({ stores: [storeRow] })
    const ctx = await resolve(client, { ...baseInput, customerId: null })
    expect(ctx.shippingFee).toBe(5000)
    expect(ctx.freeShippingThreshold).toBe(100000)
    expect(ctx.isDeliveryOnly).toBe(false)
  })

  it('never throws — returns safe defaults when supabase blows up', async () => {
    const broken = {
      from: () => { throw new Error('connection refused') },
    } as unknown as SupabaseClient

    const ctx = await resolve(broken, { ...baseInput })

    expect(ctx.hasHistory).toBe(false)
    expect(ctx.tone).toBeDefined()
  })
})
