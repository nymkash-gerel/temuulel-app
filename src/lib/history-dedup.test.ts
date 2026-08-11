/**
 * The message being answered must not also appear inside the history.
 *
 * The widget (ChatWidget POSTs /api/chat first) and the Messenger webhook both
 * persist the incoming message BEFORE calling processAIChat, so it is already
 * the newest row when history is fetched — and contextual-responder appends it
 * again as the final `user` turn. GPT saw the question twice and one slot of
 * real history was spent on a copy of it.
 */
import { describe, it, expect, vi } from 'vitest'
import { fetchRecentMessages } from './response-generator'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type Row = { content: string; is_from_customer: boolean }

/** Supabase returns rows newest-first; also records the limit that was asked for. */
function mockSupabase(rowsNewestFirst: Row[]) {
  const seen: { limit?: number } = {}
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: (n: number) => {
              seen.limit = n
              return Promise.resolve({ data: rowsNewestFirst.slice(0, n), error: null })
            },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>
  return { client, seen }
}

const CONV = 'c1b2c3d4-e5f6-4789-ab01-234567890abc'

describe('fetchRecentMessages', () => {
  it('drops the trailing customer message when it is the one being answered', async () => {
    const { client } = mockSupabase([
      { content: 'Хар өнгө байна уу?', is_from_customer: true },
      { content: 'Байна! 👇', is_from_customer: false },
      { content: 'Цамц байна уу', is_from_customer: true },
    ])
    const history = await fetchRecentMessages(client, CONV, 6, 'Хар өнгө байна уу?')
    expect(history.map(h => h.content)).toEqual(['Цамц байна уу', 'Байна! 👇'])
  })

  it('over-fetches by one so the full window survives the drop', async () => {
    const { client, seen } = mockSupabase([])
    await fetchRecentMessages(client, CONV, 6, 'Сайн уу')
    expect(seen.limit).toBe(7)
  })

  it('keeps the plain limit when no current message is supplied', async () => {
    const { client, seen } = mockSupabase([])
    await fetchRecentMessages(client, CONV, 6)
    expect(seen.limit).toBe(6)
  })

  it('keeps an identical EARLIER message — only the newest row is the echo', async () => {
    const { client } = mockSupabase([
      { content: 'Тийм', is_from_customer: false },
      { content: 'Байна уу', is_from_customer: true },
    ])
    // Newest row is the assistant's, so nothing is dropped: the customer really
    // did say "Байна уу" before, and that turn is part of the conversation.
    const history = await fetchRecentMessages(client, CONV, 6, 'Байна уу')
    expect(history.map(h => h.content)).toEqual(['Байна уу', 'Тийм'])
  })

  it('never drops an assistant message that happens to match', async () => {
    const { client } = mockSupabase([
      { content: 'Баярлалаа', is_from_customer: false },
      { content: 'Сайн уу', is_from_customer: true },
    ])
    const history = await fetchRecentMessages(client, CONV, 6, 'Баярлалаа')
    expect(history.map(h => h.content)).toEqual(['Сайн уу', 'Баярлалаа'])
  })

  it('returns [] for an empty conversation', async () => {
    const { client } = mockSupabase([])
    expect(await fetchRecentMessages(client, CONV, 6, 'Сайн уу')).toEqual([])
  })

  it('trims to the requested limit when nothing is dropped', async () => {
    const rows: Row[] = Array.from({ length: 7 }, (_, i) => ({
      content: `msg${i}`,
      is_from_customer: i % 2 === 0,
    }))
    const { client } = mockSupabase(rows)
    const history = await fetchRecentMessages(client, CONV, 6, 'something else')
    expect(history).toHaveLength(6)
  })
})

describe('contextual responder — GPT never sees the question twice', () => {
  it('drops a trailing history turn equal to currentMessage', async () => {
    vi.resetModules()
    const capture: { messages?: { role: string; content: string }[] } = {}
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async ({ messages }: { messages: { role: string; content: string }[] }) => {
        capture.messages = messages
        return { data: { response: 'ok' } }
      },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    await contextualAIResponse({
      history: [
        { role: 'user', content: 'Цамц байна уу' },
        { role: 'assistant', content: 'Байна!' },
        { role: 'user', content: 'Хэд вэ?' },
      ],
      hasPriorTurns: true,
      currentMessage: 'Хэд вэ?',
      intent: 'general',
      products: [],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })

    const userTurns = (capture.messages ?? []).filter(m => m.role === 'user')
    expect(userTurns.filter(m => m.content === 'Хэд вэ?')).toHaveLength(1)
    vi.doUnmock('./ai/openai-client')
  })

  it('an empty history no longer means "first message" when hasPriorTurns says otherwise', async () => {
    vi.resetModules()
    let called = false
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async () => { called = true; return { data: { response: 'ok' } } },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    // size_info is not a turn-1 GPT intent; without the flag this would bail.
    await contextualAIResponse({
      history: [],
      hasPriorTurns: true,
      currentMessage: 'Хэмжээ хэд вэ?',
      intent: 'size_info',
      products: [{ name: 'Цамц', base_price: 50000 }],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })
    expect(called).toBe(true)
    vi.doUnmock('./ai/openai-client')
  })

  it('a missing or reset state row does not silence GPT mid-conversation', async () => {
    vi.resetModules()
    let called = false
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async () => { called = true; return { data: { response: 'ok' } } },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    // turn_count says 0, but the messages table plainly shows a prior turn.
    // Real history wins: falling back to a template mid-chat is the visible bug.
    await contextualAIResponse({
      history: [
        { role: 'user', content: 'Цамц байна уу' },
        { role: 'assistant', content: 'Байна!' },
      ],
      hasPriorTurns: false,
      currentMessage: 'Хэмжээ хэд вэ?',
      intent: 'size_info',
      products: [{ name: 'Цамц', base_price: 50000 }],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })
    expect(called).toBe(true)
    vi.doUnmock('./ai/openai-client')
  })

  it('a history holding only the echoed message is still turn 1', async () => {
    vi.resetModules()
    let called = false
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async () => { called = true; return { data: { response: 'ok' } } },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    // The dedup runs before the turn-1 guard, so an un-deduped caller handing us
    // [the message itself] is correctly read as "nothing has happened yet".
    const result = await contextualAIResponse({
      history: [{ role: 'user', content: 'Хэмжээ хэд вэ?' }],
      currentMessage: 'Хэмжээ хэд вэ?',
      intent: 'size_info',
      products: [{ name: 'Цамц', base_price: 50000 }],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })
    expect(result).toBeNull()
    expect(called).toBe(false)
    vi.doUnmock('./ai/openai-client')
  })

  it('still bails on a genuine first message for a non-turn-1 intent', async () => {
    vi.resetModules()
    let called = false
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async () => { called = true; return { data: { response: 'ok' } } },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    const result = await contextualAIResponse({
      history: [],
      hasPriorTurns: false,
      currentMessage: 'Хэмжээ хэд вэ?',
      intent: 'size_info',
      products: [{ name: 'Цамц', base_price: 50000 }],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })
    expect(result).toBeNull()
    expect(called).toBe(false)
    vi.doUnmock('./ai/openai-client')
  })
})
