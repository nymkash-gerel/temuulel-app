import OpenAI from 'openai'
import { withSpan } from '@/lib/sentry-helpers'
import { withCircuitBreaker, CircuitOpenError } from './circuit-breaker'
import { trackOpenAIUsage } from './cost-tracker'

export { CircuitOpenError }

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

    const response = await withCircuitBreaker(() => openai.chat.completions.create({
      model: MODEL,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: req.messages,
    }))

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
// Chat completion with JSON output (multi-turn, structured JSON)
// ---------------------------------------------------------------------------

/**
 * Send a multi-turn chat completion request with JSON output mode.
 * Parses the response as JSON of type T.
 */
export async function chatCompletionJSON<T>(req: ChatCompletionRequest): Promise<CompletionResult<T>> {
  return withSpan('openai.chatCompletionJSON', 'ai.completion', async () => {
    const openai = getClient()

    const response = await withCircuitBreaker(() => openai.chat.completions.create({
      model: MODEL,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: req.messages,
    }))

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const data = JSON.parse(content) as T
    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    console.log(
      `[openai-chat-json] model=${MODEL} tokens=${usage.total_tokens} (prompt=${usage.prompt_tokens} completion=${usage.completion_tokens})`
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

    const response = await withCircuitBreaker(() => openai.chat.completions.create({
      model: MODEL,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userContent },
      ],
    }))

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

// ---------------------------------------------------------------------------
// Vision completion (image understanding via gpt-4o)
// ---------------------------------------------------------------------------

const VISION_MODEL = 'gpt-4o'

export interface VisionResult {
  content: string
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/**
 * Analyze an image using GPT-4o Vision.
 * Pass the image URL directly — OpenAI fetches it.
 */
export async function visionCompletion(
  systemPrompt: string,
  imageUrl: string,
  userPrompt?: string,
  maxTokens = 300
): Promise<VisionResult> {
  return withSpan('openai.visionCompletion', 'ai.completion', async () => {
    const openai = getClient()

    const userContent: OpenAI.ChatCompletionContentPart[] = [
      { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
    ]
    if (userPrompt) {
      userContent.unshift({ type: 'text', text: userPrompt })
    }

    const response = await withCircuitBreaker(() => openai.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }))

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty vision response from OpenAI')

    const usage = response.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    console.log(`[openai-vision] model=${VISION_MODEL} tokens=${usage.total_tokens}`)
    trackOpenAIUsage({
      model: VISION_MODEL,
      operation: 'vision',
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    })

    return {
      content,
      usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens },
    }
  }, { 'ai.model': VISION_MODEL, 'ai.max_tokens': maxTokens })
}

// ---------------------------------------------------------------------------
// Audio transcription (Whisper)
// ---------------------------------------------------------------------------

export interface TranscriptionResult {
  text: string
}

/**
 * Business-type-specific vocabulary for Whisper prompt.
 * Helps Whisper choose the right Mongolian words for each vertical.
 */
const WHISPER_PROMPTS: Record<string, string> = {
  restaurant: 'Энэ Монгол ресторанд хэрэглэгчийн ярилцлага. Бууз, хуушуур, цуйван, цэс, захиалга, хүргэлт, ширээ захиалах.',
  beauty_salon: 'Энэ Монгол гоо сайхны салон. Үсчин, маникюр, педикюр, цаг захиалах, будалт, нүүр арчилгаа.',
  coffee_shop: 'Энэ Монгол кофе шоп. Латте, капучино, эспрессо, бялуу, смузи, захиалга.',
  fitness: 'Энэ Монгол фитнесс клуб. Багц, сургагч, хуваарь, хэлбэр, цалин, гишүүнчлэл.',
  hospital: 'Энэ Монгол эмнэлэг. Үзлэг, эмч, цаг захиалах, эмчилгээ, даатгал, шүдний.',
  dental_clinic: 'Энэ Монгол шүдний эмнэлэг. Шүдний үзлэг, цэвэрлэгээ, ломбодох, цаг захиалах.',
  real_estate: 'Энэ Монгол үл хөдлөх хөрөнгө. Орон сууц, байр, өрөө, үнэ, зээл, түрээс.',
  camping_guesthouse: 'Энэ Монгол кемпинг зочид буудал. Гэр, майхан, хүүхэд, морь, байгаль.',
  ecommerce: 'Энэ Монгол онлайн дэлгүүр. Ноолууран цамц, хувцас, гутал, захиалга, хүргэлт, үнэ.',
  education: 'Энэ Монгол сургалт. Хичээл, багш, сургалт, төлбөр, цаг, бүртгэл.',
}
const DEFAULT_WHISPER_PROMPT = 'Энэ Монгол хэл дээрх ярилцлага. Сайн байна уу. Захиалга, хүргэлт, үнэ.'

/**
 * Transcribe audio from a URL using OpenAI Whisper.
 * @param audioUrl - audio file URL
 * @param businessType - store's business type (for vocabulary hints)
 */
export async function transcribeAudio(audioUrl: string, businessType?: string): Promise<TranscriptionResult> {
  return withSpan('openai.transcribeAudio', 'ai.transcription', async () => {
    const openai = getClient()

    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error(`Failed to download audio: ${audioRes.status}`)
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())

    const file = new File([audioBuffer], 'voice.mp4', { type: 'audio/mp4' })

    // Whisper does NOT support 'mn' (Mongolian) as a language hint — returns 400.
    // Without hints, Whisper may transcribe Mongolian audio in wrong script (Armenian/Cyrillic mix).
    // Use a `prompt` with Cyrillic Mongolian example to anchor the output script + business vocab.
    const prompt = (businessType && WHISPER_PROMPTS[businessType]) || DEFAULT_WHISPER_PROMPT

    const transcription = await withCircuitBreaker(() => openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      prompt,
    }))

    console.log(`[openai-whisper] transcribed ${transcription.text.length} chars`)
    trackOpenAIUsage({
      model: 'whisper-1',
      operation: 'whisper',
      audioSeconds: Math.max(1, Math.ceil(audioBuffer.length / 32000)), // ~32kbps MP3 estimate
    })
    return { text: transcription.text }
  }, { 'ai.model': 'whisper-1' })
}
