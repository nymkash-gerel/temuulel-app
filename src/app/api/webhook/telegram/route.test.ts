import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Mocks -----------------------------------------------------------------
// vi.mock factories are hoisted above imports, so referenced values must be
// created via vi.hoisted (not plain top-level consts).
const { telegramMocks, getSupabase } = vi.hoisted(() => ({
  telegramMocks: {
    sendTelegramMessage: vi.fn(),
    answerCallbackQuery: vi.fn(),
    editMessageText: vi.fn(),
  },
  getSupabase: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}))
vi.mock('@/lib/telegram', () => telegramMocks)
vi.mock('@/lib/supabase/service', () => ({ getSupabase: () => getSupabase() }))

import { POST } from './route'

// A chainable Supabase mock. Each table returns canned results:
//   responses[table] = { list?: {data,error}, single?: {data,error} }
// - awaiting the builder resolves to `list`
// - .single()/.maybeSingle() resolve to `single`
function makeSupabase(responses: Record<string, { list?: unknown; single?: unknown }>) {
  const from = vi.fn((table: string) => {
    const r = responses[table] ?? {}
    const list = r.list ?? { data: [], error: null }
    const single = r.single ?? { data: null, error: null }
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.update = vi.fn(chain)
    b.insert = vi.fn(chain)
    b.delete = vi.fn(chain)
    b.eq = vi.fn(chain)
    b.in = vi.fn(chain)
    b.order = vi.fn(chain)
    b.limit = vi.fn(chain)
    b.single = vi.fn(() => Promise.resolve(single))
    b.maybeSingle = vi.fn(() => Promise.resolve(single))
    b.then = (resolve: (v: unknown) => unknown) => resolve(list)
    return b
  })
  return { from }
}

function makeReq(body: unknown, headers: Record<string, string> = {}) {
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as import('next/server').NextRequest
}

const confirmBody = {
  callback_query: {
    id: 'cb-1',
    from: { id: 555 },
    message: { message_id: 10, chat: { id: 555 }, text: 'Appointment' },
    data: 'confirm_appointment:appt-uuid',
  },
}

describe('POST /api/webhook/telegram — security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
    getSupabase.mockReturnValue(makeSupabase({}))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    delete process.env.TELEGRAM_WEBHOOK_SECRET
  })

  it('fails closed in production when TELEGRAM_WEBHOOK_SECRET is unset', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.TELEGRAM_WEBHOOK_SECRET

    const res = await POST(makeReq(confirmBody))
    expect(res.status).toBe(500)
    expect(getSupabase).not.toHaveBeenCalled()
  })

  it('rejects a request whose secret header does not match', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.TELEGRAM_WEBHOOK_SECRET = 'correct-secret'

    const res = await POST(makeReq(confirmBody, { 'x-telegram-bot-api-secret-token': 'wrong' }))
    expect(res.status).toBe(401)
    expect(getSupabase).not.toHaveBeenCalled()
  })

  it('rejects a callback from a chat linked to no store (cross-tenant guard)', async () => {
    vi.stubEnv('NODE_ENV', 'development') // no secret required in dev
    delete process.env.TELEGRAM_WEBHOOK_SECRET
    // chat 555 maps to no store_members / staff rows
    getSupabase.mockReturnValue(makeSupabase({
      store_members: { list: { data: [], error: null } },
      staff: { list: { data: [], error: null } },
    }))

    const res = await POST(makeReq(confirmBody))
    expect(res.status).toBe(200) // Telegram always gets 200 ok
    expect(telegramMocks.answerCallbackQuery).toHaveBeenCalledWith('cb-1', 'Эрх байхгүй')
  })

  it('does not touch the appointments table for an unauthorized chat', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const supa = makeSupabase({
      store_members: { list: { data: [], error: null } },
      staff: { list: { data: [], error: null } },
    })
    getSupabase.mockReturnValue(supa)

    await POST(makeReq(confirmBody))
    const tablesTouched = supa.from.mock.calls.map((c) => c[0])
    expect(tablesTouched).not.toContain('appointments')
  })

  it('confirms an appointment for an authorized chat', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getSupabase.mockReturnValue(makeSupabase({
      store_members: { list: { data: [{ store_id: 'store-A' }], error: null } },
      staff: { list: { data: [], error: null } },
      appointments: { list: { data: [{ id: 'appt-uuid' }], error: null } },
    }))

    const res = await POST(makeReq(confirmBody))
    expect(res.status).toBe(200)
    expect(telegramMocks.answerCallbackQuery).toHaveBeenCalledWith('cb-1', 'Баталгаажуулсан!')
  })

  it('reports not-found when the appointment belongs to another store', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    getSupabase.mockReturnValue(makeSupabase({
      store_members: { list: { data: [{ store_id: 'store-A' }], error: null } },
      staff: { list: { data: [], error: null } },
      // store-scoped update matches no row -> empty data
      appointments: { list: { data: [], error: null } },
    }))

    const res = await POST(makeReq(confirmBody))
    expect(res.status).toBe(200)
    expect(telegramMocks.answerCallbackQuery).toHaveBeenCalledWith('cb-1', 'Захиалга олдсонгүй эсвэл эрх байхгүй')
  })
})
