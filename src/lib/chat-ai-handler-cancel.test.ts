/**
 * handleOrderCancelRequest — cancel of an ALREADY-PLACED order.
 *
 * The bot must never cancel the order itself: it acknowledges, marks the
 * conversation escalated, and notifies the store so a human confirms.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLatestPurchase: vi.fn(),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./ai/customer-intelligence', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getLatestPurchase: mocks.getLatestPurchase,
}))

vi.mock('@/lib/notifications', () => ({
  dispatchNotification: mocks.dispatchNotification,
}))

import { handleOrderCancelRequest } from './chat-ai-handler'
import type { SupabaseClient } from '@supabase/supabase-js'

function mockSupabase(conversationStatus: string = 'active') {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: { status: conversationStatus }, error: null })
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) })
  const from = vi.fn().mockReturnValue({ update, select })
  return { client: { from } as unknown as SupabaseClient, from, update, updateEq }
}

const ARGS = {
  conversationId: 'c1b2c3d4-e5f6-4789-ab01-234567890abc',
  customerMessage: 'Захиалгаа цуцлаач',
  storeId: 'a1b2c3d4-e5f6-4789-ab01-234567890abc',
  customerId: 'b1b2c3d4-e5f6-4789-ab01-234567890abc',
}

beforeEach(() => {
  mocks.getLatestPurchase.mockReset()
  mocks.dispatchNotification.mockClear()
})

describe('handleOrderCancelRequest', () => {
  it('includes the order number when a cancellable order exists', async () => {
    mocks.getLatestPurchase.mockResolvedValue({
      order_id: 'o1', order_number: 'ORD-1042', status: 'pending',
      total_amount: 50000, created_at: '2026-08-01',
    })
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).toContain('ORD-1042')
    expect(reply).toContain('цуцлах хүсэлт')
  })

  it('marks the conversation escalated and raises the score past the threshold', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    const sb = mockSupabase()
    await handleOrderCancelRequest(sb.client, ARGS)
    expect(sb.from).toHaveBeenCalledWith('conversations')
    expect(sb.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'escalated',
      escalation_level: 'high',
      // Score matters as much as status: processEscalation re-fires on
      // `wasBelow && isAbove`, so a score left at 0 would let the next
      // frustrated message re-notify the owner.
      escalation_score: 100,
    }))
    expect(sb.updateEq).toHaveBeenCalledWith('id', ARGS.conversationId)
  })

  it('omits the order number when the customer named a different order', async () => {
    mocks.getLatestPurchase.mockResolvedValue({
      order_id: 'o3', order_number: 'ORD-1042', status: 'pending',
      total_amount: 50000, created_at: '2026-08-01',
    })
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, {
      ...ARGS, customerMessage: 'ORD-1039 захиалгаа цуцлаач',
    })
    expect(reply).not.toContain('ORD-1042')
    expect(reply).toContain('хүлээн авлаа')
  })

  it('keeps the order number when the customer named that same order', async () => {
    mocks.getLatestPurchase.mockResolvedValue({
      order_id: 'o4', order_number: 'ORD-1042', status: 'pending',
      total_amount: 50000, created_at: '2026-08-01',
    })
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, {
      ...ARGS, customerMessage: 'ORD-1042 цуцлаач',
    })
    expect(reply).toContain('ORD-1042')
  })

  it('never claims the order is already cancelled', async () => {
    mocks.getLatestPurchase.mockResolvedValue({
      order_id: 'o5', order_number: 'ORD-1050', status: 'confirmed',
      total_amount: 20000, created_at: '2026-08-02',
    })
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).not.toMatch(/цуцаллаа|цуцлагдлаа|цуцлав/)
    expect(reply).toContain('холбогдоно')
  })

  it('notifies the store with an escalation event', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    const sb = mockSupabase()
    await handleOrderCancelRequest(sb.client, ARGS)
    expect(mocks.dispatchNotification).toHaveBeenCalledWith(
      ARGS.storeId,
      'escalation',
      expect.objectContaining({ conversation_id: ARGS.conversationId }),
    )
  })

  it('omits the order number for delivered/cancelled orders', async () => {
    mocks.getLatestPurchase.mockResolvedValue({
      order_id: 'o2', order_number: 'ORD-9', status: 'delivered',
      total_amount: 10000, created_at: '2026-07-01',
    })
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).not.toContain('ORD-9')
    expect(reply).toContain('хүлээн авлаа')
  })

  it('handles anonymous customers (no customerId) without an order lookup', async () => {
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, { ...ARGS, customerId: null })
    expect(mocks.getLatestPurchase).not.toHaveBeenCalled()
    expect(reply).toContain('хүлээн авлаа')
  })

  it('still escalates when the order lookup throws', async () => {
    mocks.getLatestPurchase.mockRejectedValue(new Error('db down'))
    const sb = mockSupabase()
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).toContain('хүлээн авлаа')
    expect(sb.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'escalated' }))
  })

  it('does not re-escalate or re-notify an already-escalated conversation', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    const sb = mockSupabase('escalated')
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).toContain('хүлээн авлаа')
    expect(sb.update).not.toHaveBeenCalled()
    expect(mocks.dispatchNotification).not.toHaveBeenCalled()
  })
})
