import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub only the network-touching helpers; keep the real (pure) keyboard builders.
const { tg } = vi.hoisted(() => ({
  tg: {
    tgSend: vi.fn(),
    tgAnswerCallback: vi.fn(),
    tgEdit: vi.fn(),
    tgRemoveButtons: vi.fn(),
    sendToDriver: vi.fn(),
  },
}))
vi.mock('@/lib/driver-telegram', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/driver-telegram')>()
  return { ...actual, ...tg }
})

import { handleCallbackQuery } from './driver-callbacks'

type TableCfg = { maybeSingle?: unknown; single?: unknown }

function makeSupabase(cfg: Record<string, TableCfg>) {
  const updateSpy = vi.fn()
  const from = vi.fn((table: string) => {
    const c = cfg[table] ?? {}
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.ilike = vi.fn(chain)
    b.in = vi.fn(chain)
    b.not = vi.fn(chain)
    b.order = vi.fn(chain)
    b.limit = vi.fn(chain)
    b.update = vi.fn((...args: unknown[]) => { updateSpy(table, ...args); return b })
    b.insert = vi.fn(() => ({ then: (r: (v: unknown) => unknown) => r({ error: null }) }))
    b.maybeSingle = vi.fn(() => Promise.resolve(c.maybeSingle ?? { data: null, error: null }))
    b.single = vi.fn(() => Promise.resolve(c.single ?? { data: null, error: null }))
    return b
  })
  return { supabase: { from }, updateSpy }
}

const cb = (data: string) => ({
  id: 'cbq-1',
  from: { id: 555 },
  message: { message_id: 1, chat: { id: 555 } },
  data,
})

describe('driver handleCallbackQuery — cross-tenant guard (HIGH #1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a callback whose delivery belongs to another store', async () => {
    const { supabase, updateSpy } = makeSupabase({
      delivery_drivers: { maybeSingle: { data: { id: 'drv-1', name: 'D', store_id: 'store-A' } } },
      deliveries: { maybeSingle: { data: { store_id: 'store-B' } } }, // foreign store
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleCallbackQuery(supabase as any, cb('delivered:foreign-delivery-uuid') as any)

    expect(tg.tgAnswerCallback).toHaveBeenCalledWith('cbq-1', '❌ Энэ хүргэлт танд хамаарахгүй')
    expect(updateSpy).not.toHaveBeenCalled() // no mutation on the foreign delivery
  })

  it('allows a callback whose delivery belongs to the driver’s own store', async () => {
    const { supabase } = makeSupabase({
      delivery_drivers: { maybeSingle: { data: { id: 'drv-1', name: 'D', store_id: 'store-A' } } },
      deliveries: {
        maybeSingle: { data: { store_id: 'store-A' } }, // same store → guard passes
        single: {
          data: {
            delivery_number: 'D-1',
            customer_name: 'Bat',
            customer_phone: '99112233',
            delivery_address: 'UB',
          },
        },
      },
    })

    // customer_info reads details and answers with them; guard must NOT reject.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleCallbackQuery(supabase as any, cb('customer_info:own-delivery-uuid') as any)

    expect(tg.tgAnswerCallback).not.toHaveBeenCalledWith('cbq-1', '❌ Энэ хүргэлт танд хамаарахгүй')
    expect(tg.tgAnswerCallback).toHaveBeenCalled()
  })

  it('rejects when the chat is not linked to any driver', async () => {
    const { supabase, updateSpy } = makeSupabase({
      delivery_drivers: { maybeSingle: { data: null } }, // unknown chat
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleCallbackQuery(supabase as any, cb('delivered:some-uuid') as any)

    expect(tg.tgAnswerCallback).toHaveBeenCalledWith('cbq-1', '❌ Жолооч олдсонгүй')
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
