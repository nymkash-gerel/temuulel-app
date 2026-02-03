/**
 * Tests for stock management: decrementStockAndNotify
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Mock notifications
vi.mock('./notifications', () => ({
  dispatchNotification: vi.fn(),
}))

import { dispatchNotification } from './notifications'
import { decrementStockAndNotify, restoreStockOnCancellation } from './stock'

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const orderItems = overrides.orderItems ?? [
    { variant_id: 'var_1', quantity: 2 },
    { variant_id: 'var_2', quantity: 1 },
  ]
  const store = overrides.store ?? {
    product_settings: { low_stock_threshold: 5 },
  }
  const variants: Record<string, unknown> = (overrides.variants ?? {
    var_1: { id: 'var_1', stock_quantity: 10, product_id: 'prod_1' },
    var_2: { id: 'var_2', stock_quantity: 4, product_id: 'prod_2' },
  }) as Record<string, unknown>
  const products: Record<string, unknown> = (overrides.products ?? {
    prod_1: { name: 'Цамц' },
    prod_2: { name: 'Өмд' },
  }) as Record<string, unknown>

  const updateCalls: { variantId: string; newQuantity: number }[] = []

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'order_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn().mockResolvedValue({ data: orderItems }),
            })),
          })),
        }
      }
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: store }),
            })),
          })),
        }
      }
      if (table === 'product_variants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              single: vi.fn().mockResolvedValue({
                data: (variants as Record<string, unknown>)[value] || null,
              }),
            })),
          })),
          update: vi.fn((data: { stock_quantity: number }) => ({
            eq: vi.fn((field: string, value: string) => {
              updateCalls.push({ variantId: value, newQuantity: data.stock_quantity })
              return Promise.resolve({ error: null })
            }),
          })),
        }
      }
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              single: vi.fn().mockResolvedValue({
                data: (products as Record<string, unknown>)[value] || null,
              }),
            })),
          })),
        }
      }
      return {}
    }),
  }

  return {
    client: client as unknown as SupabaseClient<Database>,
    updateCalls,
  }
}

describe('decrementStockAndNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decrements stock for each order item with a variant', async () => {
    const mock = createMockSupabase()

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(mock.updateCalls).toHaveLength(2)
    // var_1: 10 - 2 = 8
    expect(mock.updateCalls[0]).toEqual({ variantId: 'var_1', newQuantity: 8 })
    // var_2: 4 - 1 = 3
    expect(mock.updateCalls[1]).toEqual({ variantId: 'var_2', newQuantity: 3 })
  })

  it('dispatches low_stock notification when crossing threshold', async () => {
    const mock = createMockSupabase({
      variants: {
        var_1: { id: 'var_1', stock_quantity: 10, product_id: 'prod_1' },
        var_2: { id: 'var_2', stock_quantity: 6, product_id: 'prod_2' },
      },
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    // var_1: 10 -> 8, stays above threshold (5) — no notification
    // var_2: 6 -> 5, crosses threshold — should notify
    expect(dispatchNotification).toHaveBeenCalledTimes(1)
    expect(dispatchNotification).toHaveBeenCalledWith('store_1', 'low_stock', {
      product_name: 'Өмд',
      remaining: 5,
      variant_id: 'var_2',
      product_id: 'prod_2',
    })
  })

  it('does not notify when stock was already below threshold', async () => {
    const mock = createMockSupabase({
      variants: {
        var_1: { id: 'var_1', stock_quantity: 3, product_id: 'prod_1' },
        var_2: { id: 'var_2', stock_quantity: 2, product_id: 'prod_2' },
      },
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    // Both already below threshold — no notifications
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('clamps stock to 0 when quantity exceeds stock', async () => {
    const mock = createMockSupabase({
      orderItems: [{ variant_id: 'var_1', quantity: 20 }],
      variants: {
        var_1: { id: 'var_1', stock_quantity: 10, product_id: 'prod_1' },
      },
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(mock.updateCalls[0]).toEqual({ variantId: 'var_1', newQuantity: 0 })
  })

  it('does nothing when order has no items', async () => {
    const mock = createMockSupabase({ orderItems: [] })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(mock.updateCalls).toHaveLength(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('does nothing when order_items returns null', async () => {
    const mock = createMockSupabase({ orderItems: null })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('uses default threshold of 5 when store has no product_settings', async () => {
    const mock = createMockSupabase({
      store: { product_settings: null },
      orderItems: [{ variant_id: 'var_1', quantity: 1 }],
      variants: {
        var_1: { id: 'var_1', stock_quantity: 6, product_id: 'prod_1' },
      },
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    // 6 -> 5, crosses default threshold 5 — should notify
    expect(dispatchNotification).toHaveBeenCalledTimes(1)
  })

  it('skips variant when not found in DB', async () => {
    const mock = createMockSupabase({
      orderItems: [{ variant_id: 'nonexistent', quantity: 1 }],
      variants: {},
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(mock.updateCalls).toHaveLength(0)
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('uses product name fallback when product not found', async () => {
    const mock = createMockSupabase({
      orderItems: [{ variant_id: 'var_1', quantity: 1 }],
      variants: {
        var_1: { id: 'var_1', stock_quantity: 6, product_id: 'prod_unknown' },
      },
      products: {},
    })

    await decrementStockAndNotify(mock.client, 'order_1', 'store_1')

    expect(dispatchNotification).toHaveBeenCalledWith('store_1', 'low_stock', {
      product_name: 'Бүтээгдэхүүн',
      remaining: 5,
      variant_id: 'var_1',
      product_id: 'prod_unknown',
    })
  })
})

// ---------------------------------------------------------------------------
// restoreStockOnCancellation
// ---------------------------------------------------------------------------

function createRestoreMockSupabase(overrides: Record<string, unknown> = {}) {
  const orderItems = 'orderItems' in overrides ? overrides.orderItems : [
    { variant_id: 'var_1', quantity: 2 },
    { variant_id: 'var_2', quantity: 3 },
  ]
  const variants: Record<string, unknown> = ('variants' in overrides ? overrides.variants : {
    var_1: { id: 'var_1', stock_quantity: 8 },
    var_2: { id: 'var_2', stock_quantity: 1 },
  }) as Record<string, unknown>

  const updateCalls: { variantId: string; newQuantity: number }[] = []

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'order_items') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn().mockResolvedValue({ data: orderItems }),
            })),
          })),
        }
      }
      if (table === 'product_variants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_field: string, value: string) => ({
              single: vi.fn().mockResolvedValue({
                data: (variants as Record<string, unknown>)[value] || null,
              }),
            })),
          })),
          update: vi.fn((data: { stock_quantity: number }) => ({
            eq: vi.fn((_field: string, value: string) => {
              updateCalls.push({ variantId: value, newQuantity: data.stock_quantity })
              return Promise.resolve({ error: null })
            }),
          })),
        }
      }
      return {}
    }),
  }

  return {
    client: client as unknown as SupabaseClient<Database>,
    updateCalls,
  }
}

describe('restoreStockOnCancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('restores stock for each order item with a variant', async () => {
    const mock = createRestoreMockSupabase()

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls).toHaveLength(2)
    // var_1: 8 + 2 = 10
    expect(mock.updateCalls[0]).toEqual({ variantId: 'var_1', newQuantity: 10 })
    // var_2: 1 + 3 = 4
    expect(mock.updateCalls[1]).toEqual({ variantId: 'var_2', newQuantity: 4 })
  })

  it('does nothing when order has no items', async () => {
    const mock = createRestoreMockSupabase({ orderItems: [] })

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls).toHaveLength(0)
  })

  it('does nothing when order_items returns null', async () => {
    const mock = createRestoreMockSupabase({ orderItems: null })

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls).toHaveLength(0)
  })

  it('skips variant when not found in DB', async () => {
    const mock = createRestoreMockSupabase({
      orderItems: [{ variant_id: 'nonexistent', quantity: 5 }],
      variants: {},
    })

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls).toHaveLength(0)
  })

  it('correctly restores stock from zero', async () => {
    const mock = createRestoreMockSupabase({
      orderItems: [{ variant_id: 'var_1', quantity: 10 }],
      variants: {
        var_1: { id: 'var_1', stock_quantity: 0 },
      },
    })

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls[0]).toEqual({ variantId: 'var_1', newQuantity: 10 })
  })

  it('handles single item order', async () => {
    const mock = createRestoreMockSupabase({
      orderItems: [{ variant_id: 'var_1', quantity: 1 }],
      variants: {
        var_1: { id: 'var_1', stock_quantity: 5 },
      },
    })

    await restoreStockOnCancellation(mock.client, 'order_1')

    expect(mock.updateCalls).toHaveLength(1)
    expect(mock.updateCalls[0]).toEqual({ variantId: 'var_1', newQuantity: 6 })
  })
})
