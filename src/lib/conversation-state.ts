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

export type GiftCardStep =
  | 'select_amount'   // bot asked: which denomination?
  | 'confirm'         // bot showed amount + QPay prompt
  | 'send_to'         // purchase done, asking if they want to send to someone
  | 'done'            // flow complete

export interface GiftCardDraft {
  step: GiftCardStep
  amount?: number            // chosen denomination
  code?: string              // generated code after purchase
  recipientContact?: string  // phone / messenger handle to forward card to
}

export interface ConversationState {
  last_intent: string
  last_products: StoredProduct[]
  last_query: string
  turn_count: number
  order_draft?: OrderDraft | null
  gift_card_draft?: GiftCardDraft | null
  /** Pending gift card code from customer message — awaiting redeem confirmation */
  pending_gift_card_code?: string | null
}

export type FollowUpType =
  | 'number_reference'
  | 'select_single'
  | 'order_intent'
  | 'order_step_input'
  | 'order_cancel'
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
  return {
    last_intent: '',
    last_products: [],
    last_query: '',
    turn_count: 0,
    order_draft: null,
    gift_card_draft: null,
    pending_gift_card_code: null,
  }
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
    gift_card_draft: (state.gift_card_draft && typeof state.gift_card_draft === 'object' && !Array.isArray(state.gift_card_draft))
      ? state.gift_card_draft as unknown as GiftCardDraft
      : null,
    pending_gift_card_code: typeof state.pending_gift_card_code === 'string' ? state.pending_gift_card_code : null,
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
      updated_at: new Date().toISOString(),
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
  // Gift / recommendation queries — need LLM for contextual suggestions
  'бэлэг', 'санал болг', 'санал болох', 'зөвлөж', 'зөвлөх',
  'юу авбал', 'юу авах вэ', 'ямар авах', 'юу авмаар',
  'эхнэрт', 'нөхөрт', 'найздаа', 'ойрын', 'ахдаа', 'эгчдээ', 'дүүдээ',
  'эцэгт', 'эхэд', 'аавт', 'ээждээ', 'охиндоо', 'хүүдээ',
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

  // 0. Active order draft — intercept UNLESS the message is clearly off-topic
  if (state.order_draft) {
    const normalized = normalizeText(message).trim()
    // Cancel keywords: "цуцлах", "болих", "өөр", "буцах", "буцаа"
    const cancelWords = ['цуцл', 'болих', 'буцах', 'буцаа']
    const isCancelRequest = cancelWords.some((w) => normalized.includes(normalizeText(w)))
    if (isCancelRequest) {
      return { type: 'order_cancel' as FollowUpType }
    }

    // Complaint/frustration signals ALWAYS interrupt the order flow.
    // A frustrated customer shouldn't be asked for their address — they need help.
    const COMPLAINT_INTERRUPT = [
      // Delivery issues
      'ирэхгүй', 'ирсэнгүй', 'хүрэхгүй', 'хүрсэнгүй',
      'хэзээ ирэх', 'хэдэн хоног', 'хоног болсон', 'хоног өнгөрсөн',
      'удаан', 'хоцорсон', 'алга болсон',
      // Complaint/frustration words
      'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа',
      'сэтгэл ханамжгүй', 'чанар муу', 'эвдэрсэн', 'гэмтсэн',
      'хуурамч', 'луйвар', 'тохиромжгүй', 'залилсан', 'хуурсан',
      'уурласан', 'бухимдсан', 'ичмээр',
      // Return/refund
      'буцаах', 'буцаалт', 'мөнгө буцаах', 'буцааж өгөх',
      'солих', 'солилцох',
      // Payment dispute
      'төлбөр буруу', 'давхар төлсөн', 'мөнгө ирээгүй', 'төлбөр төлсөн',
    ]
    const isComplaint = COMPLAINT_INTERRUPT.some((kw) => normalized.includes(normalizeText(kw)))
    if (isComplaint) {
      // Return null → handler clears draft, routes to normal complaint classification
      return null
    }

    // Detect off-topic: message looks like a product query or browsing request
    // If message has 3+ words and contains browsing keywords, escape the order flow
    const words = normalized.split(/\s+/)
    const browseKeywords = ['узи', 'узэ', 'узь', 'харуул', 'юу байна', 'бну', 'байна уу',
      'юу', 'ямар', 'бусад', 'каталог', 'жагсаалт', 'бараа',
      'өөр бараа', 'өөр зүйл']
    const hasBrowseIntent = browseKeywords.some((kw) => normalized.includes(normalizeText(kw)))
    // If message has browse intent and is NOT a valid phone/address, escape order flow
    const looksLikePhone = /^\d{8}$/.test(message.trim())
    const looksLikeAddress = /дүүрэг|хороо|байр|тоот|гудамж|хотхон|орон|гэр|apartment/i.test(message)
      || /сбд|бзд|бгд|худ|схд|чд|sbd|bzd|bgd|hud|shd|chd/i.test(message)

    if (hasBrowseIntent && !looksLikePhone && !looksLikeAddress) {
      // Off-topic — cancel draft and process as normal message
      return null
    }

    // Suppress unused variable warning
    void words

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

  // 1d. Order intent: customer has products in context and wants to order
  //     Skip if message is a gift/recommendation query — "бэлэг авъя" ≠ "захиалъя"
  const GIFT_WORDS = ['бэлэг', 'санал болох', 'санал болго', 'зөвлөж', 'зөвлөх', 'юу авбал', 'юу авах вэ']
  const isGiftQuery = GIFT_WORDS.some((w) => normalized.includes(normalizeText(w)))
  if (products.length > 0 && !isGiftQuery) {
    const msgWords = normalized.split(/\s+/)
    const hasOrder = msgWords.some((w) =>
      ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
      || ORDER_EXACT_WORDS.some((ew) => paddedIncludes(` ${w} `, ew))
    )
    if (hasOrder) {
      if (products.length === 1) {
        // Only 1 product in context — auto-select it
        return { type: 'order_intent', product: products[0] }
      }
      // Multiple products — try to match a product name from the message
      const nonOrderWords = msgWords.filter((w) =>
        w.length >= 3  // Filter particles like "ни", "нь" that cause false substring matches
        && !ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
        && !ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
      )
      if (nonOrderWords.length > 0) {
        const nameMatch = products.find((p) => {
          const pWords = normalizeText(p.name).split(/\s+/)
          return nonOrderWords.some((mw) =>
            mw.length >= 3 && pWords.some((pw) => pw.includes(mw) || mw.includes(pw))
          )
        })
        if (nameMatch) {
          return { type: 'order_intent', product: nameMatch }
        }
      }
      // No clear product match with multiple products — don't guess, fall through
      // to normal classification which will show catalog
      return null
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

  // If products were found this turn, always save them — even if intent was
  // misclassified (e.g. "ухаалаг цаг узи" classified as 'general' but products found).
  const nextProducts = products.length > 0
    ? products.slice(0, 10)
    : preserveIntents.includes(intent) ? current.last_products : []

  const nextQuery = products.length > 0 && query
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
