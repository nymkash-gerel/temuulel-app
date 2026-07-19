import { describe, it, expect, vi, beforeEach } from 'vitest'

// Spy the network + binding helpers; keep real normalizePhone / looksLikePhone.
const { tg, utils } = vi.hoisted(() => ({
  tg: { tgSend: vi.fn(), tgAnswerCallback: vi.fn(), tgEdit: vi.fn(), tgRemoveButtons: vi.fn(), sendToDriver: vi.fn() },
  utils: { recordTgHistory: vi.fn().mockResolvedValue(true) },
}))
vi.mock('@/lib/driver-telegram', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/driver-telegram')>()
  return { ...actual, ...tg }
})
vi.mock('./driver-utils', async (importActual) => {
  const actual = await importActual<typeof import('./driver-utils')>()
  return { ...actual, recordTgHistory: utils.recordTgHistory }
})
vi.mock('@/lib/driver-chat-engine', () => ({ processDriverMessage: vi.fn() }))
vi.mock('@/lib/partial-payment-agent', () => ({ initiatePartialPaymentResolution: vi.fn() }))

import { handleMessage } from './driver-handlers'

// Supabase mock: `.maybeSingle()` returns cfg.maybeSingle; awaiting the builder
// returns cfg.list (used by the `.ilike(...)` candidate query).
function makeSupabase(cfg: Record<string, { maybeSingle?: unknown; list?: unknown }>) {
  const from = vi.fn((table: string) => {
    const c = cfg[table] ?? {}
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.ilike = vi.fn(chain)
    b.update = vi.fn(chain)
    b.maybeSingle = vi.fn(() => Promise.resolve(c.maybeSingle ?? { data: null, error: null }))
    b.then = (r: (v: unknown) => unknown) => r(c.list ?? { data: [], error: null })
    return b
  })
  return { from }
}

const phoneMsg = { chat: { id: 555 }, from: { id: 555 }, text: '99112233' }

describe('driver handlePhoneLink via handleMessage — cross-store binding (HIGH #2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses to bind when the same phone matches drivers in multiple stores', async () => {
    const supabase = makeSupabase({
      delivery_drivers: {
        maybeSingle: { data: null }, // chat not yet linked (early lookup)
        list: {
          data: [
            { id: 'd1', name: 'A', phone: '99112233', store_id: 'store-A' },
            { id: 'd2', name: 'B', phone: '99112233', store_id: 'store-B' },
          ],
          error: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleMessage(supabase as any, phoneMsg as any)

    expect(utils.recordTgHistory).not.toHaveBeenCalled() // no silent bind
  })

  it('binds to the single exact normalized-phone match', async () => {
    const supabase = makeSupabase({
      delivery_drivers: {
        maybeSingle: { data: null },
        list: { data: [{ id: 'd1', name: 'A', phone: '99112233', store_id: 'store-A' }], error: null },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleMessage(supabase as any, phoneMsg as any)

    expect(utils.recordTgHistory).toHaveBeenCalledTimes(1)
    expect(utils.recordTgHistory).toHaveBeenCalledWith(supabase, 'd1', 555, expect.anything())
  })

  it('ignores a loosely-matched candidate whose normalized phone differs', async () => {
    const supabase = makeSupabase({
      delivery_drivers: {
        maybeSingle: { data: null },
        list: {
          // The `ilike` prefilter can return extra rows; only the exact match binds.
          data: [
            { id: 'd1', name: 'A', phone: '99112233', store_id: 'store-A' },
            { id: 'dX', name: 'X', phone: '88112233', store_id: 'store-B' },
          ],
          error: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleMessage(supabase as any, phoneMsg as any)

    expect(utils.recordTgHistory).toHaveBeenCalledTimes(1)
    expect(utils.recordTgHistory).toHaveBeenCalledWith(supabase, 'd1', 555, expect.anything())
  })
})
