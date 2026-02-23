/**
 * Hybrid intent classifier that combines keyword-based and ML-based approaches.
 * Strategy: Use keyword classifier for high confidence matches, ML for medium confidence,
 * fall back to keyword classifier for low confidence cases.
 */

import { classifyIntentWithConfidence, IntentResult } from '../intent-classifier'
import { mlClassify } from './ml-classifier'

/**
 * Hybrid classification strategy:
 * 1. If keyword confidence >= 2.0, use keyword result (high confidence)
 * 2. If ML confidence >= 0.7, use ML result (medium-high confidence) 
 * 3. Otherwise, use keyword result (fallback)
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