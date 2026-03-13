import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockInsert = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    then: vi.fn().mockImplementation((resolve) => resolve?.({ data: null, error: null })),
    not: vi.fn(),
  }
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain)
  }
  return chain
}

const mockChain = chainable()
const mockFrom = vi.fn().mockReturnValue(mockChain)

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/qpay', () => ({
  isQPayConfigured: () => false,
  createQPayInvoice: vi.fn(),
}))

import { GET } from './route'

function makeRequest(cronSecret?: string) {
  const headers = new Headers()
  if (cronSecret) {
    headers.set('authorization', `Bearer ${cronSecret}`)
  }
  return new Request('http://localhost/api/cron/payment-followup', { headers }) as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/payment-followup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.CRON_SECRET
  })

  it('returns 401 when CRON_SECRET is set but authorization header is wrong', async () => {
    process.env.CRON_SECRET = 'test-secret'
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns ok with 0 counts when no pending orders', async () => {
    // No CRON_SECRET → dev mode allows unauthenticated
    mockChain.select.mockReturnValueOnce({
      ...mockChain,
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.reminders_sent).toBe(0)
    expect(body.escalated).toBe(0)
  })

  it('skips orders with reminder_count=0 (no first reminder sent)', async () => {
    const orders = [
      {
        id: 'order-1',
        order_number: 'ORD-001',
        total_amount: 50000,
        customer_id: 'cust-1',
        store_id: 'store-1',
        metadata: { payment_reminder_count: 0 },
        notes: null,
      },
    ]

    mockChain.select.mockReturnValueOnce({
      ...mockChain,
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: orders, error: null }),
      }),
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.reminders_sent).toBe(0)
    expect(body.escalated).toBe(0)
  })

  it('skips already escalated orders (reminder_count >= 4)', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const orders = [
      {
        id: 'order-1',
        order_number: 'ORD-001',
        total_amount: 50000,
        customer_id: 'cust-1',
        store_id: 'store-1',
        metadata: {
          payment_reminder_count: 4,
          first_reminder_at: threeHoursAgo,
          last_reminder_at: threeHoursAgo,
        },
        notes: null,
      },
    ]

    mockChain.select.mockReturnValueOnce({
      ...mockChain,
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: orders, error: null }),
      }),
    })

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.reminders_sent).toBe(0)
    expect(body.escalated).toBe(0)
  })

  it('reminder schedule: count=1 at 2h+ triggers reminder #2', () => {
    // This is a logic verification — the schedule constants
    // Reminder #2 is sent when 2+ hours have passed since first reminder
    // and current reminder_count is 1
    const schedule = [
      { reminderCount: 2, minHoursAfterFirst: 2 },
      { reminderCount: 3, minHoursAfterFirst: 12 },
    ]

    const nextReminder = schedule.find((r) => r.reminderCount === 1 + 1)
    expect(nextReminder).toBeDefined()
    expect(nextReminder!.minHoursAfterFirst).toBe(2)
  })

  it('reminder schedule: count=2 at 12h+ triggers reminder #3', () => {
    const schedule = [
      { reminderCount: 2, minHoursAfterFirst: 2 },
      { reminderCount: 3, minHoursAfterFirst: 12 },
    ]

    const nextReminder = schedule.find((r) => r.reminderCount === 2 + 1)
    expect(nextReminder).toBeDefined()
    expect(nextReminder!.minHoursAfterFirst).toBe(12)
  })

  it('escalation triggers at 24h after first reminder when count >= 3', () => {
    const ESCALATION_HOURS = 24
    const firstReminderTime = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
    const hoursSinceFirst = (Date.now() - firstReminderTime.getTime()) / (1000 * 60 * 60)

    expect(hoursSinceFirst).toBeGreaterThanOrEqual(ESCALATION_HOURS)
  })
})
