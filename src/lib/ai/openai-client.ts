import OpenAI from 'openai'
import { withSpan } from '@/lib/sentry-helpers'

const MODEL = 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.3
const DEFAULT_MAX_TOKENS = 512

let client: OpenAI | null = null

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
    client = new OpenAI({ apiKey })
  }
  return client
}

export interface CompletionRequest {
  systemPrompt: string
  userContent: string
  maxTokens?: number
  temperature?: number
}

export interface CompletionResult<T> {
  data: T
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

// ---------------------------------------------------------------------------
// Chat completion (multi-turn, plain text output)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}

export interface ChatCompletionResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/**
 * Send a multi-turn chat completion request.
 * Returns plain text (not JSON). For conversational context.
 */
export async function chatCompletion(req: ChatCompletionRequest): Promise<ChatCompletionResult> {
  return withSpan('openai.chatCompletion', 'ai.completion', async () => {
    const openai = getClient()

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: req.messages,
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    console.log(
      `[openai-chat] model=${MODEL} tokens=${usage.total_tokens} (prompt=${usage.prompt_tokens} completion=${usage.completion_tokens})`
    )

    return {
      content,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    }
  }, { 'ai.model': MODEL, 'ai.max_tokens': req.maxTokens ?? DEFAULT_MAX_TOKENS })
}

// ---------------------------------------------------------------------------
// JSON completion (single-turn, JSON output)
// ---------------------------------------------------------------------------

/**
 * Send a JSON-in / JSON-out completion request.
 * Parses the response as JSON of type T.
 */
export async function jsonCompletion<T>(req: CompletionRequest): Promise<CompletionResult<T>> {
  return withSpan('openai.jsonCompletion', 'ai.completion', async () => {
    const openai = getClient()

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userContent },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const data = JSON.parse(content) as T
    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    console.log(
      `[openai] model=${MODEL} tokens=${usage.total_tokens} (prompt=${usage.prompt_tokens} completion=${usage.completion_tokens})`
    )

    return {
      data,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    }
  }, { 'ai.model': MODEL, 'ai.max_tokens': req.maxTokens ?? DEFAULT_MAX_TOKENS })
}
