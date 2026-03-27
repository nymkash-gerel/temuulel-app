/**
 * Hybrid intent classifier that combines keyword-based, ML-based, and GPT fallback approaches.
 * Strategy: Use keyword classifier for high confidence matches, ML for medium confidence,
 * GPT-4o-mini for low confidence cases where both keyword and ML fail.
 */

import { classifyIntentWithConfidence, IntentResult } from '../intent-classifier'
import { mlClassify } from './ml-classifier'
import { normalizeText } from '../text-normalizer'
import { extractMorphFeatures, deriveMorphIntentSignals, type MorphIntentSignal } from '../morphological-features'

// ---------------------------------------------------------------------------
// GPT Fallback Intent Classification
// ---------------------------------------------------------------------------

const VALID_INTENTS = [
  'product_search', 'order_collection', 'order_status', 'shipping',
  'complaint', 'return_exchange', 'size_info', 'greeting', 'general',
  'escalation', 'store_info',
]

/**
 * GPT-4o-mini fallback for intent classification when keyword + ML both fail.
 * Called async — returns a promise. Caller decides whether to await.
 */
export async function gptClassifyIntent(message: string): Promise<IntentResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return { intent: 'general', confidence: 0 }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 30,
        messages: [
          {
            role: 'system',
            content: `Classify the user message intent. Reply with ONLY one of: ${VALID_INTENTS.join(', ')}. Mongolian language — Latin эсвэл Cyrillic бичсэн байж болно.

ДҮРЭМ:
- "[бараа нэр] + бну/бнум/бга/байна уу/үзи/хэдүү" = product_search (бараа хайж байна)
- "сн бну", "сайн байна уу", "hello" (бараа нэр БАЙХГҮЙ) = greeting
- Жишээ: "Skims bnum" = product_search (Skims бараа хайж байна), "sn bnu" = greeting`,
          },
          { role: 'user', content: message },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return { intent: 'general', confidence: 0 }
    const data = await res.json()
    const raw = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()
    const intent = VALID_INTENTS.find(i => raw.includes(i)) || 'general'
    return { intent, confidence: 1.5 }
  } catch {
    return { intent: 'general', confidence: 0 }
  }
}

// Availability question suffixes — when combined with a noun these mean product_search.
// "Skims бну?" = "SKIMS байна уу?" = product_search, NOT greeting.
// Note: \b doesn't work with Cyrillic — use space/start/end anchors instead.
const AVAILABILITY_SUFFIXES = /(?:^|\s)(бну|бнуу|бгаа|бгааю|байна уу|байгаа юу|байгаа уу|бий юу)(?:\s|$)/

/**
 * Apply morphological intent signals to adjust classification.
 * Returns an adjusted IntentResult if morph signals are strong enough,
 * or null if morph signals don't override.
 */
function applyMorphSignals(
  keywordResult: IntentResult,
  morphSignals: MorphIntentSignal[],
): IntentResult | null {
  if (morphSignals.length === 0) return null

  // Find the strongest morphological signal
  const strongest = morphSignals.reduce((a, b) => a.weight > b.weight ? a : b)

  // If morph signal agrees with keyword result, boost confidence
  if (strongest.intent === keywordResult.intent) {
    return {
      intent: keywordResult.intent,
      confidence: keywordResult.confidence + strongest.weight,
    }
  }

  // If morph signal is strong enough (>= 1.0) and disagrees, override
  if (strongest.weight >= 1.0 && keywordResult.confidence < 1.5) {
    return {
      intent: strongest.intent,
      confidence: strongest.weight + 0.5,
    }
  }

  return null
}

/**
 * Hybrid classification strategy:
 * 1. If keyword confidence >= 2.0, use keyword result (high confidence)
 * 2. Apply morphological signals for medium-confidence disambiguation
 * 3. If ML says "greeting" but message has a noun + availability question → product_search
 * 4. If ML confidence >= 0.7, use ML result (medium-high confidence)
 * 5. Otherwise, use keyword result (fallback)
 */
export function hybridClassify(message: string): IntentResult {
  // Get both classifications
  const keywordResult = classifyIntentWithConfidence(message)
  const mlResult = mlClassify(message)

  // Strategy implementation
  if (keywordResult.confidence >= 2.0) {
    // High keyword confidence - trust the keyword classifier
    return keywordResult
  }

  // Morphological analysis — extract features and derive intent signals
  const normalized = normalizeText(message)
  const morphFeatures = extractMorphFeatures(normalized)
  const morphSignals = deriveMorphIntentSignals(morphFeatures)
  const morphResult = applyMorphSignals(keywordResult, morphSignals)

  // If morphological signals produce a strong result, use it
  if (morphResult && morphResult.confidence >= 1.5) {
    return morphResult
  }

  // Medium keyword confidence (1.0–1.99): keyword matched real domain vocabulary.
  // Trust keyword over ML for complaint/return_exchange — ML often confuses typos/Latin
  // with wrong intents (e.g. "tom baina"→ML:product_search, but KW:return_exchange is correct).
  // Only apply to these high-value intents; other intents (size_info, order_collection)
  // benefit from ML's broader pattern matching.
  const KW_PRIORITY_INTENTS = ['complaint', 'return_exchange']
  if (keywordResult.confidence >= 1.0 && KW_PRIORITY_INTENTS.includes(keywordResult.intent)) {
    return keywordResult
  }

  if (mlResult.confidence >= 0.7) {
    // Guard: ML says "greeting" but message contains a noun + availability question
    // e.g. "Skims бну?" → "скимс бну" → ML thinks greeting because "бну" ≈ "сн бну"
    // Override to product_search when a non-greeting word precedes the suffix.
    if (mlResult.intent === 'greeting') {
      const words = normalized.split(/\s+/)
      const hasAvailabilitySuffix = AVAILABILITY_SUFFIXES.test(normalized)
      // Check that words before the suffix are NOT greeting words (сн, сайн, мэнд, etc.)
      const GREETING_PREFIXES = ['сн', 'сайн', 'мэнд', 'амар', 'оройн', 'өглөөний', 'сбну', 'сайнбну']
      const nonGreetingWords = words.filter(w => !GREETING_PREFIXES.some(gp => w.startsWith(gp)) && !AVAILABILITY_SUFFIXES.test(w))
      const hasProductNoun = nonGreetingWords.length >= 1 && hasAvailabilitySuffix
      if (hasProductNoun) {
        return { intent: 'product_search', confidence: 1.5 }
      }
    }

    // If morph signals are moderate, prefer morph over ML
    if (morphResult && morphResult.confidence >= 1.0) {
      return morphResult
    }

    // High ML confidence and keyword confidence is low - use ML
    return {
      intent: mlResult.intent,
      confidence: mlResult.confidence * 2 // Scale to match keyword confidence range
    }
  }

  // If morph signals exist but weren't strong enough to override above, still use them
  if (morphResult) {
    return morphResult
  }

  // Low confidence from both - fall back to keyword classifier
  // (keyword classifier has good fallback to 'general' intent)
  return keywordResult
}

/**
 * Async hybrid classification with GPT fallback.
 * Same as hybridClassify but when both keyword + ML return low confidence (< 1),
 * calls GPT-4o-mini to classify the intent.
 */
export async function hybridClassifyAsync(message: string): Promise<IntentResult> {
  const result = hybridClassify(message)

  // If confidence is decent, trust keyword/ML
  if (result.confidence >= 1) return result

  // Low confidence — try GPT fallback
  const gptResult = await gptClassifyIntent(message)
  if (gptResult.confidence > 0 && gptResult.intent !== 'general') {
    return gptResult
  }

  return result
}