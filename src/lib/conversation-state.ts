/**
 * Conversation memory — deterministic follow-up detection (keyword tier).
 *
 * Stores lightweight state in conversations.metadata.conversation_state.
 * Detects number references, "this one" selections, price questions,
 * and query refinements without any AI calls.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { toJson } from '@/lib/supabase/json'
import { normalizeText, neutralizeVowels } from './chat-ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredProduct {
  id: string
  name: string
  base_price: number
}

export interface OrderDraft {
  product_id: string
  product_name: string
  variant_id?: string
  variant_label?: string
  unit_price: number
  quantity: number
  /** 'variant' = pick size/color, 'info' = collecting address+phone, 'confirming' = summary shown */
  step: 'variant' | 'info' | 'confirming'
  address?: string
  phone?: string
}

export interface ConversationState {
  last_intent: string
  last_products: StoredProduct[]
  last_query: string
  turn_count: number
  order_draft?: OrderDraft | null
}

export type FollowUpType =
  | 'number_reference'
  | 'select_single'
  | 'order_intent'
  | 'order_step_input'
  | 'price_question'
  | 'size_question'
  | 'contextual_question'
  | 'query_refinement'
  | 'prefer_llm'

export type ContextTopic =
  | 'delivery'
  | 'order'
  | 'payment'
  | 'material'
  | 'warranty'
  | 'stock'
  | 'detail'

export interface FollowUpResult {
  type: FollowUpType
  /** For number_reference / select_single — the resolved product */
  product?: StoredProduct
  /** For price_question / size_question / contextual_question — all products from state */
  products?: StoredProduct[]
  /** For query_refinement — the refined query string */
  refinedQuery?: string
  /** For prefer_llm — reason the LLM tier was chosen */
  reason?: 'emotional' | 'repeated_low_confidence'
  /** For contextual_question — the topic being asked about */
  contextTopic?: ContextTopic
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

export function emptyState(): ConversationState {
  return { last_intent: '', last_products: [], last_query: '', turn_count: 0, order_draft: null }
}

/**
 * Read conversation state from the metadata JSONB column.
 */
export async function readState(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<ConversationState> {
  const { data } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single()

  const meta = data?.metadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return emptyState()

  const raw = (meta as Record<string, Json | undefined>).conversation_state
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState()

  const state = raw as Record<string, Json | undefined>
  return {
    last_intent: typeof state.last_intent === 'string' ? state.last_intent : '',
    last_products: Array.isArray(state.last_products) ? (state.last_products as unknown as StoredProduct[]).slice(0, 10) : [],
    last_query: typeof state.last_query === 'string' ? state.last_query : '',
    turn_count: typeof state.turn_count === 'number' ? state.turn_count : 0,
    order_draft: (state.order_draft && typeof state.order_draft === 'object' && !Array.isArray(state.order_draft))
      ? state.order_draft as unknown as OrderDraft
      : null,
  }
}

/**
 * Write updated conversation state back to metadata (merges with existing metadata).
 */
export async function writeState(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  state: ConversationState
): Promise<void> {
  // Read existing metadata first to merge
  const { data } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single()

  const meta = data?.metadata
  const existing = (meta && typeof meta === 'object' && !Array.isArray(meta))
    ? meta as Record<string, Json | undefined>
    : {} as Record<string, Json | undefined>

  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...existing,
        conversation_state: toJson(state),
      },
    })
    .eq('id', conversationId)
}

// ---------------------------------------------------------------------------
// Follow-up detection
// ---------------------------------------------------------------------------

/** Mongolian ordinal words → 0-based index */
const ORDINALS: Record<string, number> = {
  'эхнийх': 0, 'эхний': 0, 'нэг дэх': 0, 'нэгдүгээр': 0, '1': 0,
  'хоёр дахь': 1, 'хоёрдугаар': 1, '2': 1,
  'гурав дахь': 2, 'гуравдугаар': 2, '3': 2,
  'дөрөв дэх': 3, 'дөрөвдүгээр': 3, '4': 3,
  'тав дахь': 4, 'тавдугаар': 4, '5': 4,
  'сүүлийнх': -1, 'сүүлийн': -1,
}

/** Prefix stems + exact words for order/buy intent */
const ORDER_WORD_STEMS = ['захиал', 'авъ', 'авь']
const ORDER_EXACT_WORDS = [
  'авна', 'авах', 'авйа', 'ави', 'авмаар',
  'тийм', 'за', 'зүгээр', 'болно',
]

/** Words that mean "this one" / "I'll take it" */
const SELECT_WORDS = [
  'энийг', 'авъя', 'авья', 'энийг авъя', 'энийг авья', 'үүнийг',
  'энэ', 'энийгээ', 'үүнийгээ', 'авна', 'авах',
  // Slang/abbreviations
  'авйа',
  'энийг авч', 'захиалъя', 'захиалья',
]

/** Words that ask about price */
const PRICE_WORDS = [
  'үнэ', 'хэд', 'хэдтэй', 'үнэтэй', 'ямар үнэ', 'үнийг',
  // Slang/abbreviations
  'хэдвэ', 'хэд вэ', 'үнэнь', 'үнэ нь', 'хэдэн төг', 'хэдэн төгрөг',
  'ямар үнэтэй', 'хямдруулна',
]

/** Emotional / indirect phrasing — suggests LLM would handle tone better */
const EMOTIONAL_WORDS = [
  'яагаад', 'яагаа', 'ойлгохгүй', 'ойлгосонгүй', 'бухимдсан', 'бухимдаа',
  'уурласан', 'уурлаа', 'сэтгэл ханамжгүй',
  'хэцүү', 'ядарсан', 'итгэхгүй', 'гомдсон', 'гомдоо', 'харамсалтай',
  'яаж ингэж', 'яаж болж', 'юу болсон', 'ямар учиртай',
  'тусалж', 'тусална уу', 'гуйж', 'гуйя',
  // Slang/informal
  'юубэ', 'юу бэ', 'яавал', 'ойлгохгуй', 'ойлгсонгуй',
  'алга болчих', 'хариу өг', 'хариу огоч',
]

/** Color / size refinement words */
const REFINEMENT_WORDS = [
  'улаан', 'хөх', 'ногоон', 'хар', 'цагаан', 'шар', 'ягаан', 'бор', 'саарал',
  'том', 'жижиг', 'дунд', 'урт', 'богино', 'өргөн', 'нарийн',
  's', 'm', 'l', 'xl', 'xxl',
]

/** Size/fit question keywords */
const SIZE_QUESTION_WORDS = [
  'размер', 'хэмжээ', 'хэмжээг', 'хэмжээ нь', 'тохирох', 'тохирно', 'тохирох уу',
  'таарах', 'таарна', 'таарах уу',
  'али нь', 'алинийг', 'сайз', 'сайзаа',
  // Latin-typed variants (normalizeText converts to Cyrillic, but endings may differ)
  'али ни',
  // English (also matches Latin→Cyrillic normalized forms)
  'size', 'fit', 'measurement',
  // Slang/informal
  'хэмжээнь', 'размераа', 'сайзаар', 'ямар размер',
  'багтах', 'багтана', 'багтах уу',
]

/** Body measurement patterns (numbers + unit) */
const BODY_MEASUREMENT_RE = /\d+\s*(?:кг|см|kg|cm)/i

/** Contextual follow-up keyword groups — topic → keywords */
const CONTEXT_KEYWORDS: { topic: ContextTopic; words: string[] }[] = [
  {
    topic: 'delivery',
    words: [
      'хүргэлт', 'хүргэх', 'хүргэнэ', 'хэзээ ирэх', 'хэдэн өдөр',
      'шуудан', 'хаяг', 'хүргүүлэх',
      'delivery', 'deliver', 'shipping',
      // Mongolian market — countryside/city
      'аймаг', 'сум', 'дүүрэг', 'хороо', 'хөдөө', 'орон нутаг',
      'хүргүүлмээр', 'хүрч', 'хүрнэ', 'хүрэх',
    ],
  },
  {
    topic: 'order',
    words: [
      'захиалах', 'захиалга', 'захиалмаар', 'захиалъя', 'захиалья',
      'яаж авах', 'хэрхэн авах', 'худалдаж авах',
      'order', 'buy', 'purchase',
      // Slang
      'захялах', 'захялга', 'захиалмаар',
    ],
  },
  {
    topic: 'payment',
    words: [
      'төлбөр', 'төлөх', 'шилжүүлэг', 'карт', 'данс',
      'qpay', 'монпэй', 'socialpay', 'дансаар',
      'payment', 'pay',
      // Mongolian payment methods
      'кюпэй', 'сошиал пэй', 'хипэй', 'hipay',
      'хуваалцаа', 'хуваах', 'хуваан', 'зээлээр', 'лизинг',
      'шилжүүлэх', 'төлье', 'төлъе',
    ],
  },
  {
    topic: 'material',
    words: [
      'материал', 'даавуу', 'бүтэц', 'бүрдэл', 'найрлага',
      'ноос', 'торго', 'арьс', 'хөвөн', 'ноолуур',
      'material', 'fabric', 'cotton', 'cashmere',
      // Mongolian cashmere/textile specifics
      'кашемир', 'тэмээний', 'ноосон', 'ноолууран',
      'чанар', 'зэрэг', 'хөөсөн', 'нэхмэл',
    ],
  },
  {
    topic: 'warranty',
    words: [
      'баталгаа', 'баталгаат', 'буцаах боломж', 'солих боломж',
      'warranty', 'guarantee', 'return policy',
      // Slang
      'буцаалт', 'буцаах', 'солих', 'солилцоо',
    ],
  },
  {
    topic: 'stock',
    words: [
      'нөөц', 'үлдэгдэл', 'байгаа юу', 'бий юу', 'бэлэн байна',
      'stock', 'available', 'availability',
      // Slang
      'бий юу', 'дууссан уу', 'дуусчихсан уу',
    ],
  },
  {
    topic: 'detail',
    words: [
      'дэлгэрэнгүй', 'мэдээлэл', 'тайлбар', 'илүү', 'дэлгэрэнгүй мэдээлэл',
      'detail', 'details', 'info', 'more info',
    ],
  },
]

/**
 * Check if a padded normalized message contains a keyword.
 * Uses both exact match and vowel-neutralized match for Latin-typed tolerance.
 */
function paddedIncludes(paddedNormalized: string, keyword: string): boolean {
  const normKw = normalizeText(keyword)
  if (paddedNormalized.includes(` ${normKw} `)) return true
  // Vowel-neutral fallback: е/э, у/ү, о/ө treated as same
  const neutralPadded = neutralizeVowels(paddedNormalized)
  const neutralKw = neutralizeVowels(normKw)
  return neutralPadded.includes(` ${neutralKw} `)
}

/**
 * Detect follow-up patterns in the customer message given prior conversation state.
 * Returns null if this is not a follow-up (should use normal classification).
 */
export function resolveFollowUp(
  message: string,
  state: ConversationState
): FollowUpResult | null {
  // No state yet — can't be a follow-up
  if (state.turn_count === 0) return null

  // 0. Active order draft — always intercept until order completes or cancels
  if (state.order_draft) {
    return { type: 'order_step_input' }
  }

  const normalized = normalizeText(message).trim()
  const products = state.last_products

  // 1. Number reference: "2 дугаарыг", "2", ordinals
  if (products.length > 0) {
    // Check ordinals first (multi-word patterns)
    // Only match if the entire message IS the ordinal (not "5 sartai hund...")
    for (const [pattern, index] of Object.entries(ORDINALS)) {
      if (normalized === pattern) {
        const resolvedIndex = index === -1 ? products.length - 1 : index
        if (resolvedIndex >= 0 && resolvedIndex < products.length) {
          return { type: 'number_reference', product: products[resolvedIndex] }
        }
        // Out of range — fall through to other checks
      }
    }

    // Plain number at start of message: "2", "2-г", "2 дугаарыг"
    // Only treat as product selection if the message is short (just the number + optional suffix)
    const numMatch = normalized.match(/^(\d+)/)
    if (numMatch) {
      const afterNum = normalized.slice(numMatch[0].length).trim()
      const isProductSelection = afterNum === '' || /^(г|ийг|дугаарыг|дугаар|дэх|дахь|ыг)$/.test(afterNum)
      if (isProductSelection) {
        const idx = parseInt(numMatch[1], 10) - 1 // 1-based → 0-based
        if (idx >= 0 && idx < products.length) {
          return { type: 'number_reference', product: products[idx] }
        }
      }
      // Not a product selection (e.g. "5 сартай" = 5 months) — fall through to other checks
    }
  }

  // 1b. Product name match: user mentions a specific product name from state
  if (products.length > 1) {
    const lowerMsg = message.toLowerCase()
    const nameMatch = products.find((p) => {
      const lowerName = p.name.toLowerCase()
      // Check if significant part of product name appears in message
      const nameWords = lowerName.split(/\s+/).filter((w) => w.length >= 3)
      const matchCount = nameWords.filter((w) => lowerMsg.includes(w)).length
      return matchCount >= 2 || (nameWords.length === 1 && matchCount === 1)
    })
    if (nameMatch) {
      return { type: 'number_reference', product: nameMatch }
    }
  }

  // 1c. Price-based selection: "145ийнхийг", "145000", "145к" — match product by price
  if (products.length > 1) {
    // Extract price-like numbers from the message (supports 145, 145000, 145к, 145,000)
    const priceMatch = message.match(/(\d[\d,]*)\s*(?:к|k|ийнхийг|ынхийг|инхиг|ийг|ыг|₮)?/i)
    if (priceMatch) {
      const rawNum = parseInt(priceMatch[1].replace(/,/g, ''), 10)
      // Try exact match, then try *1000 (e.g. "145" → 145000)
      const matched = products.find((p) => p.base_price === rawNum)
        || (rawNum < 10000 ? products.find((p) => p.base_price === rawNum * 1000) : undefined)
      if (matched) {
        // Check if message has interest/selection context (not just a random number)
        const hasContext = /сонирх|авъя|авья|авах|авна|энийг|үүнийг|ийнхийг|ынхийг|инхиг|ийг|₮/i.test(message)
          || /сонирх|авйа|авйа|авах|авна|энийг|үүнийг/i.test(normalized)
        if (hasContext) {
          return { type: 'number_reference', product: matched }
        }
      }
    }
  }

  // 1d. Order intent: customer saw product (detail or search) and wants to order
  const orderTriggerIntents = ['product_detail', 'product_search', 'product_suggestions']
  if (orderTriggerIntents.includes(state.last_intent) && products.length > 0) {
    const msgWords = normalized.split(/\s+/)
    const hasOrder = msgWords.some((w) =>
      ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
      || ORDER_EXACT_WORDS.some((ew) => paddedIncludes(` ${w} `, ew))
    )
    if (hasOrder) {
      return { type: 'order_intent', product: products[0] }
    }
  }

  // 2. "This one" / "I'll take it" — only works with exactly 1 product
  if (products.length === 1) {
    const padded = ` ${normalized} `
    for (const word of SELECT_WORDS) {
      if (paddedIncludes(padded, word)) {
        return { type: 'select_single', product: products[0] }
      }
    }
  }

  // 3. Size/fit question — when products exist in state and message has measurement/size context
  // (checked BEFORE price, because "хэмжээ хэд" = "what size" not "what price")
  if (products.length > 0) {
    // Check for body measurement patterns (60kg, 165cm, etc.)
    if (BODY_MEASUREMENT_RE.test(normalized) || BODY_MEASUREMENT_RE.test(message)) {
      return { type: 'size_question', products }
    }
    // Check for size question keywords
    const paddedSize = ` ${normalized} `
    for (const word of SIZE_QUESTION_WORDS) {
      if (paddedIncludes(paddedSize, word)) {
        return { type: 'size_question', products }
      }
    }
  }

  // 4. Contextual question — delivery, order, payment, material, etc. when products exist
  // (checked BEFORE price, because "хүргэлт хэд хоног" = "how many days" not "what price")
  if (products.length > 0) {
    const paddedCtx = ` ${normalized} `
    for (const group of CONTEXT_KEYWORDS) {
      for (const word of group.words) {
        if (paddedIncludes(paddedCtx, word)) {
          return { type: 'contextual_question', products, contextTopic: group.topic }
        }
      }
    }
  }

  // 5. Price question — "үнэ хэд?" when products exist
  if (products.length > 0) {
    const paddedPrice = ` ${normalized} `
    for (const word of PRICE_WORDS) {
      if (paddedIncludes(paddedPrice, word)) {
        return { type: 'price_question', products }
      }
    }
  }

  // 6. Query refinement — color/size words when last intent was product_search
  if (state.last_intent === 'product_search' && state.last_query) {
    const padded = ` ${normalized} `
    for (const word of REFINEMENT_WORDS) {
      if (paddedIncludes(padded, word)) {
        return {
          type: 'query_refinement',
          refinedQuery: `${state.last_query} ${normalized}`,
        }
      }
    }
  }

  // 7. Prefer LLM: emotional / indirect phrasing — templates sound robotic here
  {
    const padded = ` ${normalized} `
    for (const word of EMOTIONAL_WORDS) {
      if (paddedIncludes(padded, word)) {
        return { type: 'prefer_llm', reason: 'emotional' }
      }
    }
  }

  // 8. Prefer LLM: repeated low_confidence — user got the "ойлгосонгүй" menu twice
  if (state.last_intent === 'low_confidence') {
    return { type: 'prefer_llm', reason: 'repeated_low_confidence' }
  }

  return null
}

// ---------------------------------------------------------------------------
// State update
// ---------------------------------------------------------------------------

/**
 * Produce the next conversation state after a turn.
 * Greeting/thanks don't reset products (allows follow-up after "thanks, show me #2").
 */
export function updateState(
  current: ConversationState,
  intent: string,
  products: StoredProduct[],
  query: string
): ConversationState {
  const preserveIntents = [
    'greeting', 'thanks', 'size_info',
    'delivery_info', 'order_info', 'payment_info', 'warranty_info', 'stock_info',
  ]

  // Intents that fetch/narrow products and should save them to state
  const saveProductIntents = ['product_search', 'low_confidence', 'product_suggestions', 'product_detail']

  // search intent with results → save; preserve intents → keep previous; else → clear
  const nextProducts = saveProductIntents.includes(intent) && products.length > 0
    ? products.slice(0, 10)
    : preserveIntents.includes(intent) ? current.last_products : []

  const nextQuery = saveProductIntents.includes(intent) && query
    ? query
    : preserveIntents.includes(intent) ? current.last_query : ''

  return {
    last_intent: preserveIntents.includes(intent) ? current.last_intent : intent,
    last_products: nextProducts,
    last_query: nextQuery,
    turn_count: current.turn_count + 1,
    order_draft: current.order_draft ?? null,
  }
}
