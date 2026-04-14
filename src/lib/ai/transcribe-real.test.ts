import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'

/**
 * REAL Whisper API test with LOCAL fixture audio.
 * Skipped unless OPENAI_API_KEY + RUN_REAL_AI=1.
 * Cost: ~$0.006/min audio.
 *
 * Fixture: tests/fixtures/ai-audio/greeting-mn.mp3 (OpenAI TTS generated)
 *
 * Note: transcribeAudio() in openai-client.ts downloads from URL, so here
 * we call the Whisper API directly with a local file.
 */

const REAL_TESTS = Boolean(process.env.OPENAI_API_KEY && process.env.RUN_REAL_AI === '1')
const describeFn = REAL_TESTS ? describe : describe.skip

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/ai-audio')

describeFn('Whisper transcription — REAL API with local fixtures', () => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

  async function transcribe(filename: string) {
    const filepath = path.join(FIXTURES, filename)
    expect(fs.existsSync(filepath), `${filename} should exist`).toBe(true)
    const buffer = fs.readFileSync(filepath)
    const file = new File([buffer], filename, { type: 'audio/mp3' })
    return openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      // Cyrillic prompt anchors output to proper Mongolian script
      prompt: 'Энэ Монгол хэл дээрх ярилцлага. Сайн байна уу. Ноолууран цамц авмаар байна. Захиалга, хүргэлт.',
    })
  }

  it('transcribes short Mongolian greeting in Cyrillic (not Armenian)', async () => {
    const result = await transcribe('greeting-mn.mp3')
    console.log('[Whisper short]', result.text)

    expect(result.text).toBeTruthy()
    const hasCyrillic = /[\u0400-\u04FF]/.test(result.text)
    expect(hasCyrillic,
      `CRITICAL: Output must be Cyrillic, not Armenian. Got: "${result.text}"`
    ).toBe(true)
  }, 60000)

  it('transcribes longer Mongolian conversation with main words correct', async () => {
    const result = await transcribe('longer-mn.mp3')
    console.log('[Whisper long]', result.text)

    expect(result.text).toBeTruthy()
    expect(result.text.length).toBeGreaterThan(30)

    // Must be Cyrillic
    const hasCyrillic = /[\u0400-\u04FF]/.test(result.text)
    expect(hasCyrillic).toBe(true)

    // Longer audio → should catch at least 3 of 5 core words
    const lower = result.text.toLowerCase()
    const coreWords = ['сайн', 'ноолуур', 'цамц', 'хүргэлт', 'байна']
    const matchedCount = coreWords.filter(w => lower.includes(w)).length
    expect(matchedCount,
      `Expected at least 3 of ${JSON.stringify(coreWords)}, got ${matchedCount} in: "${result.text}"`
    ).toBeGreaterThanOrEqual(3)
  }, 60000)
})
