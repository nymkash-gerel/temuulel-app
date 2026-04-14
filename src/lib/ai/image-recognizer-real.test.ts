import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { recognizeProductImage } from './image-recognizer'

/**
 * REAL API TEST — uses actual OpenAI Vision API with LOCAL fixture images.
 * Skipped unless OPENAI_API_KEY + RUN_REAL_AI=1 is set.
 * Costs ~$0.01 per test.
 *
 * Fixtures: tests/fixtures/ai-images/{shoe,sweater,bag}.jpg
 *
 * Usage: OPENAI_API_KEY=sk-... RUN_REAL_AI=1 npx vitest run src/lib/ai/image-recognizer-real.test.ts
 */

const REAL_TESTS = Boolean(process.env.OPENAI_API_KEY && process.env.RUN_REAL_AI === '1')
const describeFn = REAL_TESTS ? describe : describe.skip

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/ai-images')

function loadImageAsDataUrl(filename: string): string {
  const buffer = fs.readFileSync(path.join(FIXTURES, filename))
  const base64 = buffer.toString('base64')
  return `data:image/jpeg;base64,${base64}`
}

describeFn('image-recognizer — REAL API with local fixtures', () => {
  const testCases = [
    {
      label: 'Nike-style shoe',
      file: 'shoe.jpg',
      expectCategory: ['shoes', 'other'],
      expectKeywords: ['shoe', 'пүүз', 'sneaker', 'гутал'],
    },
    {
      label: 'Wool sweater',
      file: 'sweater.jpg',
      expectCategory: ['clothing', 'other'],
      expectKeywords: ['sweater', 'цамц', 'wool', 'ноолуур', 'knit'],
    },
    {
      label: 'Leather handbag',
      file: 'bag.jpg',
      expectCategory: ['bags', 'accessories', 'other'],
      expectKeywords: ['bag', 'цүнх', 'handbag', 'purse'],
    },
  ]

  for (const tc of testCases) {
    it(`identifies: ${tc.label}`, async () => {
      const dataUrl = loadImageAsDataUrl(tc.file)
      const result = await recognizeProductImage(dataUrl)
      expect(result, `Should recognize ${tc.label} (${tc.file})`).not.toBeNull()

      console.log(`[${tc.label}] →`, {
        name: result!.productName,
        category: result!.category,
        keywords: result!.searchKeywords.slice(0, 5),
      })

      // Case-insensitive keyword match in either name or keywords
      const allText = [result!.productName, ...result!.searchKeywords].join(' ').toLowerCase()
      const hasAnyKeyword = tc.expectKeywords.some(kw => allText.includes(kw.toLowerCase()))
      expect(hasAnyKeyword,
        `Expected one of ${JSON.stringify(tc.expectKeywords)} in "${allText}"`
      ).toBe(true)

      expect(tc.expectCategory).toContain(result!.category)
    }, 30000)
  }
})
