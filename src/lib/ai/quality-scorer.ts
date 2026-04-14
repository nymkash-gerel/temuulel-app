/**
 * AI Quality Scorer
 * Scores AI responses 0-100 and detects unanswered questions
 */

export interface QualityInput {
  confidence: number
  detectedIssues: string[]
  requiresHumanReview: boolean
  intent: string
  responseText: string
  customerMessage: string
}

export interface QualityScore {
  score: number        // 0-100
  isUnanswered: boolean
}

// Patterns indicating the AI couldn't answer
const UNANSWERED_PATTERNS = [
  'байхгүй байна',
  'олдсонгүй',
  'олдохгүй',
  'мэдэхгүй',
  'мэдээлэлгүй',
  'хариулж чадахгүй',
  'дэлгүүртэй холбогдоно уу',
  'мэргэжилтэн',
  'жагсаалтад байхгүй',
  'тодорхойлж чадсангүй',
]

/**
 * Score an AI response 0-100.
 * Higher = better quality.
 */
export function scoreAIResponse(input: QualityInput): QualityScore {
  // Base score from confidence (0.0-1.0 → 0-100)
  let score = Math.round(input.confidence * 100)

  // Penalize human review needed
  if (input.requiresHumanReview) {
    score -= 20
  }

  // Penalize per detected issue
  score -= input.detectedIssues.length * 10

  // Check for unanswered markers
  const responseLower = input.responseText.toLowerCase()
  const hasUnansweredMarker = UNANSWERED_PATTERNS.some(p => responseLower.includes(p))

  if (hasUnansweredMarker) {
    score -= 30
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))

  // Unanswered if markers found OR score is very low
  const isUnanswered = hasUnansweredMarker || score < 30

  return { score, isUnanswered }
}
