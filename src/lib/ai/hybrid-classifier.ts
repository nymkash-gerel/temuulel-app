/**
 * Hybrid intent classifier that combines keyword-based, ML-based, and GPT fallback approaches.
 * Strategy: Use keyword classifier for high confidence matches, ML for medium confidence,
 * GPT-4o-mini for low confidence cases where both keyword and ML fail.
 */

import { classifyIntentWithConfidence, isPurchaseDeferral, IntentResult } from '../intent-classifier'
import { mlClassify } from './ml-classifier'
import { bertClassify } from './bert-classifier'
import { normalizeText, neutralizeVowels } from '../text-normalizer'
import { extractMorphFeatures, deriveMorphIntentSignals, type MorphIntentSignal } from '../morphological-features'
import { isAnnouncementToken, isBareQuestionAnnouncement } from '../question-announcement'

// ---------------------------------------------------------------------------
// GPT Fallback Intent Classification
// ---------------------------------------------------------------------------

const VALID_INTENTS = [
  'product_search', 'order_collection', 'order_status', 'shipping',
  'complaint', 'return_exchange', 'size_info', 'greeting', 'general',
  'escalation', 'store_info', 'order_cancel_request',
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
- Жишээ: "Skims bnum" = product_search (Skims бараа хайж байна), "sn bnu" = greeting
- "захиалгаа цуцлаач", "zahialgaa tsutslah" (өгсөн захиалгаа цуцлах хүсэлт) = order_cancel_request`,
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
  return demoteDeferredPurchase(message, hybridClassifyInner(message))
}

/**
 * A customer backing out ("авахаа болилоо") or deferring ("одоо биш, дараа
 * авъя") still uses a purchase verb, and the ML tier — which only sees that
 * verb — reports order_collection with high confidence. Applied to the FINAL
 * result rather than inside the keyword classifier, because ML overrides the
 * keyword tier for exactly these messages.
 */
function demoteDeferredPurchase(message: string, result: IntentResult): IntentResult {
  if (result.intent !== 'order_collection') return result
  if (!isPurchaseDeferral(message)) return result
  return { intent: 'general', confidence: result.confidence }
}

// "Асуулт байна" is a customer ANNOUNCING a question, not greeting — but the
// ML tier learned it as greeting (the trailing "байна" resembles "сайн байна").
// Measured damage before this guard: "асуулт байна" → greeting 2.00, and worse,
// "хүргэлтийн талаар асуулт байна" → greeting 2.00 even though the keyword tier
// had correctly said shipping 1.25 — ML was STEALING real intents whenever the
// phrase appeared. Detection lives in question-announcement.ts (shared with
// resolveFollowUp, which must not store "асуулт байна" as a customer name).

function hybridClassifyInner(message: string): IntentResult {
  // Emoji-only messages — handle separately (substring match breaks with emoji bytes)
  const trimmed = message.trim()
  if (/^[\p{Emoji}\s]+$/u.test(trimmed) && trimmed.length <= 12) {
    const ANGRY = ['😡', '😤', '🤬', '😠', '💢']
    const HAPPY = ['👍', '🙏', '❤️', '❤', '💯', '😊', '🥰', '😍', '👏', '🎉', '✅', '💕', '🫶', '😘', '🤩']
    if (ANGRY.some(e => trimmed.includes(e))) return { intent: 'complaint', confidence: 2.0 }
    if (HAPPY.some(e => trimmed.includes(e))) return { intent: 'thanks', confidence: 2.0 }
    return { intent: 'general', confidence: 1.0 }
  }

  // Get both classifications
  const keywordResult = classifyIntentWithConfidence(message)
  const mlResult = mlClassify(message)

  // A bare question announcement ("асуулт байна") short-circuits the rest:
  // the question hasn't been asked yet, so no tier can know the topic — and the
  // ML tier would confidently mislabel it as greeting. Confidence 2.0 also
  // stops hybridClassifyAsync's BERT/GPT tiers from re-promoting it.
  // A confident keyword hit wins ONLY over verb-form announcements: "танд юу
  // байна гэж асууя" is built of filler + асууя, but the customer already
  // ASKED their question (a catalog browse — keyword product_search 2.0).
  // When the noun АСУУЛТ itself is the subject ("asuult bgaa"), the keyword
  // tier's 2.0 comes from reading АСУУЛТ as a product noun before an
  // availability suffix — the announcement wins there.
  const neutralized = neutralizeVowels(normalizeText(trimmed))
  if (isBareQuestionAnnouncement(neutralized)) {
    const hasNounAnnouncement = /(?:^|\s)асуулт/.test(neutralized)
    if (hasNounAnnouncement || keywordResult.confidence < 2.0) {
      return { intent: 'question_prompt', confidence: 2.0 }
    }
  }

  // Morphological analysis — computed up front so a strong negation/complaint signal
  // (e.g. "ирээгүй" = didn't arrive) isn't lost when product-noun keywords score high.
  const normalized = normalizeText(message)
  const morphFeatures = extractMorphFeatures(normalized)
  const morphSignals = deriveMorphIntentSignals(morphFeatures)
  const morphResult = applyMorphSignals(keywordResult, morphSignals)

  // Strategy implementation
  if (keywordResult.confidence >= 2.0) {
    // A strong morphological complaint (negated delivery/order root, e.g. "бараа
    // ирээгүй") must override a product-BROWSING keyword hit — the customer is
    // reporting a problem, not shopping. Does not touch order_status/return intents.
    const BROWSING_KW = ['product_search', 'menu_availability', 'general', 'order_collection']
    const complaintSignal = morphSignals.find((s) => s.intent === 'complaint')
    if (complaintSignal && complaintSignal.weight >= 1.0 && BROWSING_KW.includes(keywordResult.intent)) {
      return { intent: 'complaint', confidence: complaintSignal.weight + 0.5 }
    }
    // High keyword confidence - trust the keyword classifier
    return keywordResult
  }

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

  // Announcement steal guard, half 1 — ML-intent-agnostic: when the message
  // announces a question AND the keyword tier found a real topic at >= 1.0
  // ("хүргэлтийн талаар асуулт байна" → shipping 1.25), no ML intent may
  // replace it — not just greeting: an ML product_search would discard the
  // topic the same way. Returning >= 1.5 also blocks the async BERT tier.
  const hasAnnouncement = neutralized.split(/\s+/).some(isAnnouncementToken)
  if (hasAnnouncement
    && keywordResult.intent !== 'greeting' && keywordResult.intent !== 'general'
    && keywordResult.confidence >= 1.0) {
    return { intent: keywordResult.intent, confidence: Math.max(keywordResult.confidence, 1.5) }
  }

  if (mlResult.confidence >= 0.7) {
    // Guard: ML says "greeting" but message contains a noun + availability question
    // e.g. "Skims бну?" → "скимс бну" → ML thinks greeting because "бну" ≈ "сн бну"
    // Override to product_search when a non-greeting word precedes the suffix.
    if (mlResult.intent === 'greeting') {
      // Announcement steal guard, half 2 — greeting-only: an announcement the
      // keyword tier could NOT anchor (see the >= 1.0 preservation above) that
      // ML reads as greeting gets the invitation instead. Checked before the
      // availability guard below, which would otherwise read the word АСУУЛТ
      // itself as a product noun ("sn bnu asuult bna" → product_search).
      // Deliberately NOT extended to other ML intents: for "би асуултаа
      // асуусан шүү дээ" ML's order_collection is wrong but the invite would
      // loop — only the measured greeting confusion earns the override.
      if (hasAnnouncement) {
        return { intent: 'question_prompt', confidence: 1.5 }
      }

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
 * Async hybrid classification with BERT + GPT fallback.
 * 3-tier strategy:
 *   1. Keyword + ML (synchronous, free, <1ms)
 *   2. BERT API (async, ~50ms, requires BERT_API_URL)
 *   3. GPT-4o-mini (async, ~500ms, ~$0.001/request)
 */
export async function hybridClassifyAsync(message: string): Promise<IntentResult> {
  const result = hybridClassify(message)

  // Tier 1: If keyword/ML confidence is high, trust it
  if (result.confidence >= 1.5) return result

  // Tier 2: Try BERT API (fast, cheap, 83% accuracy)
  const bertResult = await bertClassify(message)
  if (bertResult && bertResult.confidence >= 0.7) {
    return { intent: bertResult.intent, confidence: bertResult.confidence * 2 }
  }

  // If keyword/ML had decent confidence, use it before GPT
  if (result.confidence >= 1) return result

  // Tier 3: GPT-4o-mini fallback (slow, accurate, costs per request)
  const gptResult = await gptClassifyIntent(message)
  if (gptResult.confidence > 0 && gptResult.intent !== 'general') {
    return gptResult
  }

  return result
}