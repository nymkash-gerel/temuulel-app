/**
 * LLM-as-Judge quality scorer — uses GPT-4o-mini to evaluate response quality.
 * Scores on 4 criteria: accuracy, relevance, tone, completeness.
 */

export interface QualityScore {
  accuracy: number    // 1-5
  relevance: number   // 1-5
  tone: number        // 1-5
  completeness: number // 1-5
  overall: number     // weighted average
  issues: string[]
}

const WEIGHTS = { accuracy: 0.35, relevance: 0.25, completeness: 0.25, tone: 0.15 }

/**
 * Score a chatbot response using GPT-4o-mini as judge.
 * Falls back to heuristic scoring if OpenAI is unavailable.
 */
export async function scoreResponse(
  customerMessage: string,
  botResponse: string,
  intent: string,
  context: { products_found: number; orderStep: string | null }
): Promise<QualityScore> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return heuristicScore(customerMessage, botResponse, intent, context)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a QA evaluator for a Mongolian ecommerce chatbot. Score the bot response on 4 criteria (1-5 each). Return JSON only:
{"accuracy":N,"relevance":N,"tone":N,"completeness":N,"issues":["issue1","issue2"]}

Scoring guide:
- 5: Perfect
- 4: Good, minor issues
- 3: Acceptable
- 2: Poor, significant issues
- 1: Failed completely`,
          },
          {
            role: 'user',
            content: `Customer: "${customerMessage}"
Intent: ${intent}
Products found: ${context.products_found}
Order step: ${context.orderStep || 'none'}

Bot response: "${botResponse}"`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return heuristicScore(customerMessage, botResponse, intent, context)

    const data = await res.json()
    const raw = JSON.parse(data.choices?.[0]?.message?.content || '{}')

    const score: QualityScore = {
      accuracy: clamp(raw.accuracy ?? 3),
      relevance: clamp(raw.relevance ?? 3),
      tone: clamp(raw.tone ?? 3),
      completeness: clamp(raw.completeness ?? 3),
      overall: 0,
      issues: Array.isArray(raw.issues) ? raw.issues : [],
    }
    score.overall = weightedAverage(score)
    return score
  } catch {
    return heuristicScore(customerMessage, botResponse, intent, context)
  }
}

/** Heuristic fallback when LLM judge is unavailable. */
function heuristicScore(
  message: string,
  response: string,
  intent: string,
  context: { products_found: number; orderStep: string | null }
): QualityScore {
  const issues: string[] = []
  let accuracy = 4
  let relevance = 4
  let tone = 4
  let completeness = 4

  // Check response basics
  if (!response || response.length < 10) {
    issues.push('Response too short')
    accuracy = 1
    relevance = 1
  }

  if (/undefined|null|error|NaN/i.test(response)) {
    issues.push('Response contains error artifacts')
    accuracy = 2
  }

  // Check intent-specific quality
  if (intent === 'product_search' && context.products_found === 0 && !response.includes('олдсонгүй')) {
    issues.push('No products found but no "not found" message')
    completeness = 3
  }

  if (intent === 'complaint' && !/уучлаарай|харамсаж|ойлгож/i.test(response)) {
    issues.push('Complaint response lacks empathy')
    tone = 3
  }

  if (intent === 'greeting' && response.length > 500) {
    issues.push('Greeting response too long')
    relevance = 3
  }

  const score: QualityScore = { accuracy, relevance, tone, completeness, overall: 0, issues }
  score.overall = weightedAverage(score)
  return score
}

function clamp(n: number): number {
  return Math.max(1, Math.min(5, Math.round(n)))
}

function weightedAverage(s: QualityScore): number {
  return +(
    s.accuracy * WEIGHTS.accuracy +
    s.relevance * WEIGHTS.relevance +
    s.completeness * WEIGHTS.completeness +
    s.tone * WEIGHTS.tone
  ).toFixed(2)
}
