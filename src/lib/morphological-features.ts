/**
 * morphological-features.ts — Extract intent-bearing signals from Mongolian morphology
 *
 * Uses the deep stemmer to decompose words into root + suffix chain,
 * then maps suffix patterns to intent signals that boost/override classification.
 *
 * Key morphological patterns for ecommerce intent:
 *  -маар/-мээр  (desiderative)  → "want to X" → order_collection
 *  -хгүй/-гүй  (negative)      → "not/won't X" → complaint, cancellation
 *  -сан уу      (past question) → "did X happen?" → order_status
 *  -ж байна     (progressive)   → "X is happening" → order_status
 *  -аарай       (imperative)    → polite request → escalation/shipping
 *  -гд          (passive)       → "was X-ed" → order_status, complaint
 */

import { mnStemDeep, type SuffixCategory, type DeepStemResult } from './mn-stemmer'
import { normalizeText } from './text-normalizer'
import { KNOWN_ROOTS } from './mn-roots'

/** Morphological features extracted from a message. */
export interface MorphFeatures {
  /** Any word has -гүй/-хгүй (negation) */
  hasNegative: boolean
  /** Any word has -маар/-мээр (want/desire) */
  hasDesiderative: boolean
  /** Pattern: verb-сан + уу/үү (past tense question) */
  hasPastQuestion: boolean
  /** Pattern: verb-ж + байна (progressive aspect) */
  hasProgressive: boolean
  /** Any word has -аарай/-ээрэй pattern (imperative request) */
  hasImperative: boolean
  /** Any word has -гд (passive voice) */
  hasPassive: boolean
  /** Any word has past tense suffix (-сан/-лаа etc.) */
  hasPast: boolean
  /** Root word that is negated, if any */
  negatedRoot: string | null
  /** Root word with desiderative suffix, if any */
  desiderativeRoot: string | null
  /** All decomposed words with their stems and suffixes */
  decompositions: DeepStemResult[]
}

/** Semantic root categories for intent signal mapping. */
type RootDomain = 'order' | 'delivery' | 'return' | 'payment' | 'product' | 'other'

/** Map common roots to their semantic domain. */
const ROOT_DOMAINS: ReadonlyMap<string, RootDomain> = new Map([
  // Order-related
  ['захиал', 'order'], ['захиала', 'order'], ['зах', 'order'],
  ['ав', 'order'], ['авах', 'order'],
  ['худалд', 'order'],

  // Delivery-related
  ['хүрг', 'delivery'], ['хүргэ', 'delivery'], ['хүр', 'delivery'],
  ['илгээ', 'delivery'], ['ир', 'delivery'], ['ирэ', 'delivery'], ['ирэх', 'delivery'],
  ['яв', 'delivery'],

  // Return-related
  ['буц', 'return'], ['буцаа', 'return'], ['буцааг', 'return'],
  ['сол', 'return'], ['солиу', 'return'],

  // Payment-related
  ['төл', 'payment'], ['төлб', 'payment'],
  ['шилж', 'payment'], ['шилжүүл', 'payment'],

  // Product-related
  ['бар', 'product'], ['бараа', 'product'],
  ['хай', 'product'], ['ол', 'product'], ['үз', 'product'], ['хар', 'product'],
])

/** Resolve a stem to its semantic domain. */
function getRootDomain(stem: string): RootDomain {
  return ROOT_DOMAINS.get(stem) ?? 'other'
}

/** Intent signal produced by morphological analysis. */
export interface MorphIntentSignal {
  intent: string
  weight: number
  reason: string
}

/**
 * Extract morphological features from a normalized message.
 * Input should already be passed through normalizeText().
 */
export function extractMorphFeatures(normalizedMessage: string): MorphFeatures {
  const tokens = normalizedMessage.split(' ').filter(t => t.length > 0)
  const decompositions = tokens.map(t => mnStemDeep(t))

  let hasNegative = false
  let hasDesiderative = false
  let hasPassive = false
  let hasPast = false
  let negatedRoot: string | null = null
  let desiderativeRoot: string | null = null

  for (const d of decompositions) {
    for (const s of d.suffixes) {
      switch (s.category) {
        case 'negative':
          hasNegative = true
          if (!negatedRoot) negatedRoot = d.stem
          break
        case 'desiderative':
          hasDesiderative = true
          if (!desiderativeRoot) desiderativeRoot = d.stem
          break
        case 'passive':
          hasPassive = true
          break
        case 'tense_past':
        case 'tense_past_spoken':
        case 'completive':
          hasPast = true
          break
      }
    }
  }

  // Multi-word pattern: past question (verb-сан + уу/үү)
  let hasPastQuestion = false
  for (let i = 0; i < tokens.length - 1; i++) {
    const d = decompositions[i]
    const nextToken = tokens[i + 1]
    const hasPastSuffix = d.suffixes.some(
      s => s.category === 'tense_past' || s.category === 'tense_past_spoken' || s.category === 'completive'
    )
    if (hasPastSuffix && (nextToken === 'уу' || nextToken === 'үү' || nextToken === 'юу')) {
      hasPastQuestion = true
      break
    }
  }

  // Multi-word pattern: progressive (verb-ж + байна/байгаа)
  let hasProgressive = false
  for (let i = 0; i < tokens.length - 1; i++) {
    const d = decompositions[i]
    const nextToken = tokens[i + 1]
    const hasConverb = d.suffixes.some(s => s.category === 'converb')
    if (hasConverb && (nextToken === 'байна' || nextToken === 'байгаа' || nextToken === 'байн')) {
      hasProgressive = true
      break
    }
  }

  // Imperative pattern: word ends with -аарай/-ээрэй/-оорой/-ууд
  const hasImperative = tokens.some(t =>
    t.endsWith('аарай') || t.endsWith('ээрэй') || t.endsWith('оорой') || t.endsWith('өөрэй')
  )

  return {
    hasNegative,
    hasDesiderative,
    hasPastQuestion,
    hasProgressive,
    hasImperative,
    hasPassive,
    hasPast,
    negatedRoot,
    desiderativeRoot,
    decompositions,
  }
}

/**
 * Derive intent signals from morphological features.
 * Returns an array of (intent, weight) pairs that should be applied
 * as adjustments to the hybrid classifier's scoring.
 */
export function deriveMorphIntentSignals(features: MorphFeatures): MorphIntentSignal[] {
  const signals: MorphIntentSignal[] = []

  // Desiderative + order/product root → order_collection
  if (features.hasDesiderative && features.desiderativeRoot) {
    const domain = getRootDomain(features.desiderativeRoot)
    if (domain === 'order' || domain === 'product') {
      signals.push({
        intent: 'order_collection',
        weight: 1.0,
        reason: `desiderative(-маар) + ${domain} root "${features.desiderativeRoot}"`,
      })
    } else {
      signals.push({
        intent: 'product_search',
        weight: 0.5,
        reason: `desiderative(-маар) + general root "${features.desiderativeRoot}"`,
      })
    }
  }

  // Negative + delivery root → complaint
  if (features.hasNegative && features.negatedRoot) {
    const domain = getRootDomain(features.negatedRoot)
    if (domain === 'delivery') {
      signals.push({
        intent: 'complaint',
        weight: 1.5,
        reason: `negative(-гүй) + delivery root "${features.negatedRoot}"`,
      })
    } else if (domain === 'order') {
      signals.push({
        intent: 'complaint',
        weight: 1.0,
        reason: `negative(-гүй) + order root "${features.negatedRoot}"`,
      })
    } else if (domain === 'return') {
      signals.push({
        intent: 'return_exchange',
        weight: 1.0,
        reason: `negative(-гүй) + return root "${features.negatedRoot}"`,
      })
    }
  }

  // Past question → order_status
  if (features.hasPastQuestion) {
    signals.push({
      intent: 'order_status',
      weight: 1.0,
      reason: 'past question pattern (-сан уу)',
    })
  }

  // Progressive + wait/delivery → order_status
  if (features.hasProgressive) {
    const hasWaitOrDeliveryRoot = features.decompositions.some(d => {
      const domain = getRootDomain(d.stem)
      return domain === 'delivery' || domain === 'order'
    })
    if (hasWaitOrDeliveryRoot) {
      signals.push({
        intent: 'order_status',
        weight: 1.0,
        reason: 'progressive(-ж байна) + delivery/order context',
      })
    }
  }

  // Imperative → escalation boost
  if (features.hasImperative) {
    signals.push({
      intent: 'escalation',
      weight: 0.5,
      reason: 'imperative request pattern (-аарай)',
    })
  }

  // Passive + past → something was done to order/delivery
  if (features.hasPassive && features.hasPast) {
    signals.push({
      intent: 'order_status',
      weight: 0.5,
      reason: 'passive past pattern (-гдсан) suggests status inquiry',
    })
  }

  return signals
}
