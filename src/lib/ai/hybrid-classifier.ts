/**
 * Hybrid intent classifier that combines keyword-based and ML-based approaches.
 * Strategy: Use keyword classifier for high confidence matches, ML for medium confidence,
 * fall back to keyword classifier for low confidence cases.
 */

import { classifyIntentWithConfidence, IntentResult } from '../intent-classifier'
import { mlClassify } from './ml-classifier'
import { normalizeText } from '../text-normalizer'

// Availability question suffixes — when combined with a noun these mean product_search.
// "Skims бну?" = "SKIMS байна уу?" = product_search, NOT greeting.
// Note: \b doesn't work with Cyrillic — use space/start/end anchors instead.
const AVAILABILITY_SUFFIXES = /(?:^|\s)(бну|бнуу|бгаа|бгааю|байна уу|байгаа юу|байгаа уу|бий юу)(?:\s|$)/

/**
 * Hybrid classification strategy:
 * 1. If keyword confidence >= 2.0, use keyword result (high confidence)
 * 2. If ML says "greeting" but message has a noun + availability question → product_search
 * 3. If ML confidence >= 0.7, use ML result (medium-high confidence)
 * 4. Otherwise, use keyword result (fallback)
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

  if (mlResult.confidence >= 0.7) {
    // Guard: ML says "greeting" but message contains a noun + availability question
    // e.g. "Skims бну?" → "скимс бну" → ML thinks greeting because "бну" ≈ "сн бну"
    // Override to product_search when a non-greeting word precedes the suffix.
    if (mlResult.intent === 'greeting') {
      const normalized = normalizeText(message)
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

    // High ML confidence and keyword confidence is low - use ML
    return {
      intent: mlResult.intent,
      confidence: mlResult.confidence * 2 // Scale to match keyword confidence range
    }
  }

  // Low confidence from both - fall back to keyword classifier
  // (keyword classifier has good fallback to 'general' intent)
  return keywordResult
}