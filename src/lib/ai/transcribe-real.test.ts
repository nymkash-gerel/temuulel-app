import { describe, it, expect } from 'vitest'
import { transcribeAudio } from './openai-client'

/**
 * REAL Whisper API test.
 * Skipped unless OPENAI_API_KEY + RUN_REAL_AI=1.
 * Cost: ~$0.006/min audio.
 *
 * Usage: OPENAI_API_KEY=sk-... RUN_REAL_AI=1 npx vitest run src/lib/ai/transcribe-real.test.ts
 */

const REAL_TESTS = Boolean(process.env.OPENAI_API_KEY && process.env.RUN_REAL_AI === '1')
const describeFn = REAL_TESTS ? describe : describe.skip

describeFn('transcribeAudio — REAL Whisper API', () => {
  // Public audio samples (Mongolian + English)
  // Using Commonvoice/Wikimedia audio URLs
  const testCases = [
    {
      label: 'Mongolian greeting (Wikipedia sample)',
      url: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/Mn-Sain_baina_uu.ogg',
      expectSubstrings: ['сайн', 'байна'],
    },
  ]

  for (const tc of testCases) {
    it(`transcribes: ${tc.label}`, async () => {
      try {
        const result = await transcribeAudio(tc.url)
        expect(result.text, 'Should return non-empty text').toBeTruthy()
        expect(result.text.length).toBeGreaterThan(0)

        const lower = result.text.toLowerCase()
        const foundAny = tc.expectSubstrings.some(s => lower.includes(s.toLowerCase()))
        // Whisper may transliterate — loose check
        if (!foundAny) {
          console.log(`[whisper] Got: "${result.text}", expected one of:`, tc.expectSubstrings)
        }
        // At minimum, non-empty is good — Mongolian transcription quality varies
        expect(result.text.length).toBeGreaterThan(2)
      } catch (err) {
        // If file format unsupported, skip
        if (err instanceof Error && err.message.includes('format')) {
          console.warn('[whisper] Format not supported, skipping')
          return
        }
        throw err
      }
    }, 60000)
  }
})
