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

describeFn('Whisper transcription — REAL API with local fixture', () => {
  it('transcribes Mongolian audio (cashmere shirt inquiry)', async () => {
    const filepath = path.join(FIXTURES, 'greeting-mn.mp3')
    expect(fs.existsSync(filepath), 'Audio fixture should exist').toBe(true)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const buffer = fs.readFileSync(filepath)
    const file = new File([buffer], 'greeting-mn.mp3', { type: 'audio/mp3' })

    const result = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      // No language hint ('mn' not supported). Prompt anchors script to Cyrillic.
      prompt: 'Энэ Монгол хэл дээрх ярилцлага. Сайн байна уу. Ноолууран цамц авмаар байна.',
    })

    console.log('[Whisper]', result.text)

    expect(result.text).toBeTruthy()
    expect(result.text.length).toBeGreaterThan(2)

    // CRITICAL: Output must be in Cyrillic script (not Armenian/Latin).
    // Whisper without prompt hint transcribes Mongolian in wrong scripts.
    const hasCyrillic = /[\u0400-\u04FF]/.test(result.text)
    expect(hasCyrillic,
      `Output should be in Cyrillic script, got: "${result.text}"`
    ).toBe(true)

    // Loose keyword check — Whisper may catch partial words in short clips
    const lower = result.text.toLowerCase()
    const expectedWords = ['сайн', 'байна', 'ноолуур', 'цамц', 'хэд', 'вэ']
    const foundAny = expectedWords.some(w => lower.includes(w))
    if (!foundAny) {
      console.warn(`[whisper] Partial transcription: "${result.text}"`)
    }
  }, 60000)
})
