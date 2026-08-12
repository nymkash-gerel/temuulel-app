/**
 * "Асуулт байна" — a question ANNOUNCEMENT, not a greeting.
 *
 * Measured before the fix (via hybridClassify, the real entry point):
 *   "асуулт байна"                    → greeting 2.00
 *   "хүргэлтийн талаар асуулт байна"  → greeting 2.00  (keyword tier had
 *                                        correctly said shipping 1.25!)
 * The ML tier learned the trailing "байна" as greeting and STOLE real intents
 * whenever the phrase appeared. Adding "асуулт байна" to the general keyword
 * list was tried in 2026-08 and rejected — padded-substring scoring made it
 * steal in the opposite direction. The fix is a clarification path: a new
 * question_prompt intent that invites the question.
 */
import { describe, it, expect, vi } from 'vitest'
import { hybridClassify } from './ai/hybrid-classifier'
import { generateResponse, generateAIResponse } from './response-generator'
import { updateState, emptyState, resolveFollowUp } from './conversation-state'

describe('bare announcements → question_prompt', () => {
  it.each([
    'асуулт байна',
    'Асуулт байна?',
    'асуулт бна',
    'нэг юм асууя',
    'асуух зүйл байна',
    'asuult baina',
    'asuult bn',
    'neg yum asuuya',
    // adversarial review 2026-08-12 — previously missed phrasings
    'асуулт байгаа',
    'asuult bgaa',
    'би нэг юм асууя',
    'уучлаарай нэг юм асууя',
    'нэг юм асуумаар байна лээ',
    'асуумаар юм байна аа',
    'асуулт их байна',
    'танд нэг жоохон юм асуумаар байна шүү дээ',
  ])('%s', (msg) => {
    const r = hybridClassify(msg)
    expect(r.intent).toBe('question_prompt')
    // ≥1.5 so hybridClassifyAsync's BERT/GPT tiers can't re-steal it
    expect(r.confidence).toBeGreaterThanOrEqual(1.5)
  })
})

describe('announcements WITH a topic keep their real intent', () => {
  it.each([
    ['Захиалгын талаар асуулт байна', 'order_status'],
    ['хүргэлтийн талаар асуулт байна', 'shipping'],
    ['буцаалтын асуулт байна', 'return_exchange'],
    ['Танайд асуулт байна: энэ цамц хэдэн төгрөг вэ?', 'product_search'],
  ])('%s → %s', (msg, expected) => {
    expect(hybridClassify(msg).intent).toBe(expected)
  })

  it('a topic no tier can parse still gets the invitation, not a greeting', () => {
    const r = hybridClassify('бүтээгдэхүүний талаар асуулт байна')
    expect(r.intent).toBe('question_prompt')
  })
})

describe('what must NOT change', () => {
  it('асуудал (= problem) is a complaint, never question_prompt', () => {
    // Shares the асуу- prefix with асуулт — the one-word difference between
    // "I have a question" and "I have a PROBLEM".
    const r = hybridClassify('асуудал байна')
    expect(r.intent).toBe('complaint')
  })

  it('real greetings still greet', () => {
    expect(hybridClassify('сайн байна уу').intent).toBe('greeting')
    expect(hybridClassify('sain bn uu').intent).toBe('greeting')
  })

  it('greeting + announcement is the announcement, not a product search', () => {
    // The availability guard used to read the word АСУУЛТ as a product noun.
    const r = hybridClassify('sn bnu asuult bna')
    expect(r.intent).toBe('question_prompt')
  })

  it('the availability guard still catches real noun + бну after the reorder', () => {
    expect(hybridClassify('Skims бну').intent).toBe('product_search')
  })

  it('асуудлууд (elided plural of асуудал) is never question_prompt', () => {
    // асуудал → асуудлууд drops the vowel, escaping a plain асуудал check.
    expect(hybridClassify('асуудлууд байна').intent).not.toBe('question_prompt')
    expect(hybridClassify('надад асуудлууд байна').intent).not.toBe('question_prompt')
    expect(hybridClassify('asuudluud baina').intent).not.toBe('question_prompt')
  })

  it('a filler-phrased question that WAS asked keeps its keyword intent', () => {
    // Every word is announcement-filler + асууя, but the question is right
    // there ("let me ask what you have" = browse) — keyword 2.0 wins.
    expect(hybridClassify('танд юу байна гэж асууя').intent).toBe('product_search')
  })

  it('past/habitual асуу- forms are not announcements', () => {
    expect(hybridClassify('би асуултаа асуусан шүү дээ').intent).not.toBe('question_prompt')
    expect(hybridClassify('би их асуудаг').intent).not.toBe('question_prompt')
  })

  it('a long message mentioning асуулт mid-sentence is not hijacked', () => {
    const r = hybridClassify('өчигдөр асуулт асуусан ч хариу аваагүй, захиалга минь хаана байна')
    expect(r.intent).not.toBe('question_prompt')
    expect(r.intent).not.toBe('greeting')
  })
})

describe('question_prompt plumbing', () => {
  it('template invites the question instead of greeting', () => {
    const text = generateResponse('question_prompt', [], [], 'Тест дэлгүүр')
    expect(text).toContain('Асуултаа')
    expect(text).not.toContain('тавтай морил')
  })

  it('preserves product context — the question is usually about whats on screen', () => {
    const state = {
      ...emptyState(),
      last_intent: 'product_search',
      last_products: [{ id: 'p1', name: 'Цамц', base_price: 50000 }],
    }
    const next = updateState(state, 'question_prompt', [], 'асуулт байна')
    expect(next.last_products).toHaveLength(1)
    expect(next.last_products[0].name).toBe('Цамц')
  })

  it('turn 1 falls to the deterministic template, not GPT', async () => {
    // question_prompt is not a TURN1_GPT_INTENT — a first-message announcement
    // gets the deterministic invite.
    const text = await generateAIResponse(
      'question_prompt', [], [], 'Тест дэлгүүр', 'асуулт байна',
      undefined, [], undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      0, // turnCount — genuine turn 1
    )
    expect(text).toContain('Асуултаа')
  })
})

describe('mid-checkout interruption', () => {
  const draftState = () => ({
    ...emptyState(),
    turn_count: 5,
    order_draft: {
      step: 'name' as const,
      items: [{ product_id: 'p1', product_name: 'Цамц', variant_id: null, variant_label: null, unit_price: 50000, quantity: 1 }],
    },
  })

  it('асуулт байна at the name step is NOT stored as the customer name', () => {
    // Before the exemption, resolveFollowUp returned order_step_input and the
    // handler saved customer_name = "асуулт байна", advancing to address.
    expect(resolveFollowUp('асуулт байна', draftState())).toBeNull()
    expect(resolveFollowUp('нэг юм асууя', draftState())).toBeNull()
  })

  it('a real name still advances checkout, and болих still cancels', () => {
    expect(resolveFollowUp('Болд', draftState())?.type).toBe('order_step_input')
    expect(resolveFollowUp('болих', draftState())?.type).toBe('order_cancel')
  })

  it('the INVITED question is not swallowed either — pause lasts one turn', () => {
    // t1 "асуулт байна" → invite + order_draft_paused persisted; t2 the actual
    // question must reach the classifier, not become the customer's name.
    const paused = { ...draftState(), order_draft_paused: true }
    expect(resolveFollowUp('Хүргэлт хэдэн төгрөг вэ?', paused)).toBeNull()
    // flag cleared (updateState omits it) → interception resumes
    expect(resolveFollowUp('Болд', draftState())?.type).toBe('order_step_input')
  })

  it('updateState never carries the pause flag forward', () => {
    const next = updateState(
      { ...draftState(), order_draft_paused: true }, 'shipping', [], 'Хүргэлт хэдэн төгрөг вэ?')
    expect(next.order_draft_paused).toBeUndefined()
  })
})

describe('GPT prompt integration', () => {
  it('mid-conversation the system prompt tells GPT to invite, not guess', async () => {
    vi.resetModules()
    const capture: { messages?: { role: string; content: string }[] } = {}
    vi.doMock('./ai/openai-client', () => ({
      isOpenAIConfigured: () => true,
      chatCompletionJSON: async ({ messages }: { messages: { role: string; content: string }[] }) => {
        capture.messages = messages
        return { data: { response: 'За, сонсож байна!' } }
      },
    }))
    const { contextualAIResponse } = await import('./ai/contextual-responder')

    await contextualAIResponse({
      history: [
        { role: 'user', content: 'Цамц байна уу' },
        { role: 'assistant', content: 'Байна!' },
      ],
      hasPriorTurns: true,
      currentMessage: 'асуулт байна',
      intent: 'question_prompt',
      products: [],
      orders: [],
      storeName: 'Тест дэлгүүр',
    })

    const system = capture.messages?.[0]?.content ?? ''
    expect(system).toContain('асуултаа хараахан асуугаагүй')
    // and the empty products list must NOT trigger the "store has no products" rule
    expect(system).not.toContain('БАРАА БАЙХГҮЙ')
    vi.doUnmock('./ai/openai-client')
  })

  it('preferred colours reach the system prompt', async () => {
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
      history: [{ role: 'user', content: 'юу байна' }],
      hasPriorTurns: true,
      currentMessage: 'цамц үзүүлээч',
      intent: 'product_search',
      products: [{ name: 'Цамц', base_price: 50000 }],
      orders: [],
      storeName: 'Тест дэлгүүр',
      customerPrefs: { preferred_colors: ['хар', 'улаан'] },
    })

    const system = capture.messages?.[0]?.content ?? ''
    expect(system).toContain('ДУРТАЙ ӨНГӨ: хар, улаан')
    vi.doUnmock('./ai/openai-client')
  })
})
