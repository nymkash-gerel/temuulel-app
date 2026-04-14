import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { recognizeProductImage } from './image-recognizer'

/**
 * REAL-WORLD STRESS TEST — simulates what Mongolian FB store customers
 * actually send: low quality, blurry, dark, varied product types.
 *
 * Skipped unless RUN_REAL_AI=1.
 */

const REAL_TESTS = Boolean(process.env.OPENAI_API_KEY && process.env.RUN_REAL_AI === '1')
const describeFn = REAL_TESTS ? describe : describe.skip

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/ai-images')

function loadImageAsDataUrl(filename: string): string {
  const buffer = fs.readFileSync(path.join(FIXTURES, filename))
  const base64 = buffer.toString('base64')
  return `data:image/jpeg;base64,${base64}`
}

describeFn('image-recognizer — REALISTIC FB customer scenarios', () => {
  const scenarios = [
    {
      file: 'realistic-1-blurry-shoes.jpg',
      label: 'Blurry low-quality shoe photo (typical mobile)',
      expectAny: ['shoe', 'пүүз', 'гутал', 'sneaker', 'footwear'],
      expectCategories: ['shoes', 'other'],
    },
    {
      file: 'realistic-2-dark-bag.jpg',
      label: 'Dark/shadowy handbag photo',
      expectAny: ['bag', 'цүнх', 'handbag', 'purse'],
      expectCategories: ['bags', 'accessories', 'other'],
    },
    {
      file: 'realistic-3-mobile-phone.jpg',
      label: 'Mobile phone device',
      expectAny: ['phone', 'утас', 'mobile', 'smartphone', 'iphone', 'samsung'],
      expectCategories: ['electronics', 'other'],
    },
    {
      file: 'realistic-4-coat.jpg',
      label: 'Winter coat / outerwear',
      expectAny: ['coat', 'куртка', 'пальто', 'хүрэм', 'jacket', 'outerwear'],
      expectCategories: ['clothing', 'other'],
    },
    {
      file: 'realistic-5-watch.jpg',
      label: 'Wristwatch',
      expectAny: ['watch', 'цаг', 'wristwatch', 'timepiece'],
      expectCategories: ['accessories', 'electronics', 'other'],
    },
    {
      file: 'realistic-6-dress.jpg',
      label: 'Dress / women clothing',
      expectAny: ['dress', 'даашинз', 'gown', 'clothing'],
      expectCategories: ['clothing', 'other'],
    },
    {
      file: 'realistic-7-earphone.jpg',
      label: 'Earphones / headphones',
      expectAny: ['earphone', 'чихэвч', 'headphone', 'earbuds', 'airpods'],
      expectCategories: ['electronics', 'accessories', 'other'],
    },
  ]

  for (const sc of scenarios) {
    it(`recognizes: ${sc.label}`, async () => {
      const dataUrl = loadImageAsDataUrl(sc.file)
      const result = await recognizeProductImage(dataUrl)
      expect(result, `Should not return null for ${sc.file}`).not.toBeNull()

      console.log(`[${sc.label}] →`, {
        name: result!.productName,
        category: result!.category,
        keywords: result!.searchKeywords.slice(0, 5),
      })

      const allText = [result!.productName, ...result!.searchKeywords].join(' ').toLowerCase()
      const matchedKeyword = sc.expectAny.find(kw => allText.includes(kw.toLowerCase()))
      expect(matchedKeyword,
        `Expected one of ${JSON.stringify(sc.expectAny)} in "${allText}"`
      ).toBeTruthy()

      expect(sc.expectCategories).toContain(result!.category)
    }, 45000)
  }

  // Aggregate accuracy report
  it('aggregates recognition accuracy across all scenarios', async () => {
    let correct = 0
    let total = 0
    for (const sc of scenarios) {
      total++
      try {
        const dataUrl = loadImageAsDataUrl(sc.file)
        const result = await recognizeProductImage(dataUrl)
        if (!result) continue
        const allText = [result.productName, ...result.searchKeywords].join(' ').toLowerCase()
        const hasKw = sc.expectAny.some(kw => allText.includes(kw.toLowerCase()))
        const hasCat = sc.expectCategories.includes(result.category)
        if (hasKw && hasCat) correct++
      } catch { /* skip */ }
    }
    const accuracy = (correct / total) * 100
    console.log(`\n🎯 FINAL ACCURACY: ${correct}/${total} (${accuracy.toFixed(1)}%)\n`)
    expect(accuracy).toBeGreaterThanOrEqual(70) // at least 70% correct
  }, 300000)
})
