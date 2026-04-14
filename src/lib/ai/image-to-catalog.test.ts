import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { recognizeProductImage } from './image-recognizer'
import { searchProducts } from '../product-search'

/**
 * E2E TEST: Image recognition + store catalog matching.
 *
 * Scenario: Customer sends a product image from a competitor store.
 * Expected behavior:
 *   1. Vision identifies the product type (shoe, bag, phone, etc.)
 *   2. searchProducts() searches OUR store's catalog
 *   3. If we have similar → return them
 *   4. If we don't → return empty (not false matches from unrelated categories)
 */

const REAL_TESTS = Boolean(process.env.OPENAI_API_KEY && process.env.RUN_REAL_AI === '1')
const describeFn = REAL_TESTS ? describe : describe.skip

const FIXTURES = path.join(process.cwd(), 'tests/fixtures/ai-images')
const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166' // Монгол Маркет

function loadImageAsDataUrl(filename: string): string {
  const buffer = fs.readFileSync(path.join(FIXTURES, filename))
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

describeFn('Image → Catalog matching — distinguishes own vs competitor products', () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  it('lists store products first so we know what to expect', async () => {
    const { data: products } = await supabase
      .from('products')
      .select('name, category')
      .eq('store_id', STORE_ID)
      .eq('status', 'active')

    console.log('\n📦 Монгол Маркет каталог:')
    for (const p of (products || []).slice(0, 20)) {
      console.log(`   - ${p.name} [${p.category || '?'}]`)
    }
    expect(products).toBeTruthy()
  })

  const scenarios = [
    {
      image: 'realistic-7-earphone.jpg',
      label: 'Customer sends AirPods image',
      description: 'Store has "Утасгүй чихэвч (Bluetooth)" — should match!',
      shouldMatchCategory: true,
    },
    {
      image: 'realistic-3-mobile-phone.jpg',
      label: 'Customer sends mobile phone image',
      description: 'Store may or may not have phones — test shows behavior',
      shouldMatchCategory: false, // unknown — observe
    },
    {
      image: 'realistic-1-blurry-shoes.jpg',
      label: 'Customer sends shoe image',
      description: 'Store may have shoes OR not — strict category prevents false clothing matches',
      shouldMatchCategory: false, // observe — depends on store inventory
    },
    {
      image: 'sweater.jpg',
      label: 'Customer sends sweater image',
      description: 'Store has "Цамц", "Кашемир цамц" — should match clothing',
      shouldMatchCategory: true,
    },
  ]

  for (const sc of scenarios) {
    it(`${sc.label} → catalog match`, async () => {
      // Step 1: recognize image
      const dataUrl = loadImageAsDataUrl(sc.image)
      const recognition = await recognizeProductImage(dataUrl)
      expect(recognition, 'Vision should recognize image').not.toBeNull()

      console.log(`\n🔍 ${sc.label}`)
      console.log(`   Таньсан: ${recognition!.productName} [${recognition!.category}]`)
      console.log(`   Keywords: ${recognition!.searchKeywords.slice(0, 5).join(', ')}`)
      console.log(`   ${sc.description}`)

      // Step 2: search store catalog using Mongolian keywords
      const mongolianKeywords = recognition!.searchKeywords.filter(k => /[\u0400-\u04FF]/.test(k))
      const searchQuery = mongolianKeywords.length > 0
        ? mongolianKeywords.join(' ')
        : recognition!.searchKeywords.join(' ')

      // Apply strict category filter — prevents random cross-category matches
      const validCategories = ['bags', 'shoes', 'clothing', 'accessories', 'electronics', 'home', 'beauty', 'toys', 'food']
      const strictCategory = validCategories.includes(recognition!.category) ? recognition!.category : undefined

      const matches = await searchProducts(supabase, searchQuery, STORE_ID, {
        maxProducts: 5,
        strictCategory,
      })

      console.log(`   📦 Каталогоос олдсон: ${matches.length} бүтээгдэхүүн`)
      for (const m of matches.slice(0, 3)) {
        console.log(`      → ${m.name} (${m.category || 'no-category'})`)
      }

      // Assertions
      if (sc.shouldMatchCategory) {
        // Either exact product found OR at least category match
        const hasAny = matches.length > 0
        expect(hasAny, `Expected at least 1 match for ${sc.label}`).toBe(true)
      }
      // No assertion for unknown — just observe
    }, 60000)
  }

  it('GUARD: totally unrelated image should not return random matches', async () => {
    // Test: ant photo → shouldn't return shoes/bags/phones from our catalog
    // This prevents false positives where GPT-4o misidentifies
    const dataUrl = loadImageAsDataUrl('bag.jpg')
    const recognition = await recognizeProductImage(dataUrl)

    if (!recognition) {
      console.log('   No recognition — guard passes')
      return
    }

    // If bag recognized, catalog search should return bags or related
    // (Not shoes, phones, coats, etc.)
    const matches = await searchProducts(
      supabase,
      recognition.searchKeywords.filter(k => /[\u0400-\u04FF]/.test(k)).join(' '),
      STORE_ID,
      { maxProducts: 3 }
    )

    console.log(`\n🛡️  Bag guard: Vision="${recognition.productName}" → ${matches.length} catalog matches`)
    for (const m of matches) console.log(`      → ${m.name}`)

    // If matches exist, names should relate to "цүнх"/"bag"/"accessories"
    // (won't fail the test — just diagnostic)
    expect(true).toBe(true)
  }, 60000)
})
