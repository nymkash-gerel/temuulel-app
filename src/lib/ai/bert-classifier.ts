/**
 * BERT-based intent classifier client.
 * Calls the FastAPI BERT server for high-accuracy Mongolian intent classification.
 * Falls back to local ML classifier if BERT API is unavailable.
 */

const BERT_API_URL = process.env.BERT_API_URL || ''
const BERT_TIMEOUT = 3000 // 3 seconds

interface BertResult {
  intent: string
  confidence: number
  all_intents?: Record<string, number>
}

/**
 * Classify text using the BERT API server.
 * Returns null if the server is unavailable (for graceful fallback).
 */
export async function bertClassify(text: string): Promise<BertResult | null> {
  if (!BERT_API_URL) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), BERT_TIMEOUT)

    const response = await fetch(`${BERT_API_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json()
    return {
      intent: data.intent,
      confidence: data.confidence,
      all_intents: data.all_intents,
    }
  } catch {
    // Server unavailable — fall back to local classifier
    return null
  }
}

/**
 * Batch classify multiple texts using the BERT API server.
 */
export async function bertBatchClassify(texts: string[]): Promise<BertResult[] | null> {
  if (!BERT_API_URL || texts.length === 0) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), BERT_TIMEOUT * 2)

    const response = await fetch(`${BERT_API_URL}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const data = await response.json()
    return data.results
  } catch {
    return null
  }
}

/**
 * Check if BERT API is healthy.
 */
export async function isBertAvailable(): Promise<boolean> {
  if (!BERT_API_URL) return false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const response = await fetch(`${BERT_API_URL}/health`, {
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}
