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

/**
 * The escalation is claimed with a single conditional update:
 *   .update(...).eq('id', …).neq('status','escalated').select('id').maybeSingle()
 * `claimed` is the row that update returns — null when another request (or an
 * earlier message) already escalated the conversation.
 */
function mockSupabase(claimed: { id: string } | null = { id: 'conv-row' }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: claimed, error: null })
  const select = vi.fn().mockReturnValue({ maybeSingle })
  const neq = vi.fn().mockReturnValue({ select })
  const updateEq = vi.fn().mockReturnValue({ neq })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const from = vi.fn().mockReturnValue({ update })
  return { client: { from } as unknown as SupabaseClient, from, update, updateEq, neq }
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

  it('does not re-notify when the conversation was already escalated', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    // Conditional update claims no row → another request/message got there first.
    const sb = mockSupabase(null)
    const reply = await handleOrderCancelRequest(sb.client, ARGS)
    expect(reply).toContain('хүлээн авлаа')
    expect(mocks.dispatchNotification).not.toHaveBeenCalled()
  })

  it('claims the escalation atomically so concurrent requests notify once', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    // Both requests issue the update; only the one whose `neq('status','escalated')`
    // still matched gets a row back, and only that one notifies.
    const winner = mockSupabase({ id: 'conv-row' })
    const loser = mockSupabase(null)
    await Promise.all([
      handleOrderCancelRequest(winner.client, ARGS),
      handleOrderCancelRequest(loser.client, ARGS),
    ])
    expect(winner.neq).toHaveBeenCalledWith('status', 'escalated')
    expect(loser.neq).toHaveBeenCalledWith('status', 'escalated')
    expect(mocks.dispatchNotification).toHaveBeenCalledTimes(1)
  })

  it('awaits the notification so a serverless freeze cannot drop it', async () => {
    mocks.getLatestPurchase.mockResolvedValue(null)
    let delivered = false
    mocks.dispatchNotification.mockImplementationOnce(async () => {
      await new Promise(r => setTimeout(r, 10))
      delivered = true
    })
    await handleOrderCancelRequest(mockSupabase().client, ARGS)
    expect(delivered).toBe(true)
  })
})
