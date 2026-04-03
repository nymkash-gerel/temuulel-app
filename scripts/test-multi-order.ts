#!/usr/bin/env npx tsx
/**
 * Multi-item order + search alias stress test
 * Tests product disambiguation, multi-product orders, and alias matching
 */

import { searchProducts } from '../src/lib/product-search'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m',
}

// Load production env
let url = '', key = ''
const envPath = path.join(__dirname, '..', '.env.production.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
  if (m) { if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') url = m[2]; else key = m[2] }
}
const supabase = createClient(url, key)

// Get store ID
async function getStoreId(): Promise<string> {
  const { data } = await supabase.from('stores').select('id').ilike('name', '%монгол маркет%').limit(1).single()
  return data!.id
}

interface SearchTest {
  query: string
  expectedProduct: string  // substring match on product name
  scenario: string
}

interface MultiOrderTest {
  message: string
  expectedProducts: string[]  // substring matches
  scenario: string
}

// ── Search alias tests ──
const SEARCH_TESTS: SearchTest[] = [
  // Exact Cyrillic names
  { query: 'скимс', expectedProduct: 'SKIMS', scenario: 'cyrillic_brand' },
  { query: 'леевчик', expectedProduct: 'Леевчик', scenario: 'cyrillic_exact' },
  { query: 'турсик', expectedProduct: 'турсик', scenario: 'cyrillic_turshik' },
  { query: 'корсет', expectedProduct: 'корсет', scenario: 'cyrillic_korset' },
  { query: 'кашемир', expectedProduct: 'Кашемир', scenario: 'cyrillic_cashmere' },
  { query: 'даашинз', expectedProduct: 'Даашинз', scenario: 'cyrillic_dress' },
  { query: 'малгай', expectedProduct: 'малгай', scenario: 'cyrillic_hat' },
  { query: 'тарпизан', expectedProduct: 'Тарпизан', scenario: 'cyrillic_tarpzan' },
  { query: 'боолт', expectedProduct: 'боолт', scenario: 'cyrillic_hairband' },
  { query: 'цүнх', expectedProduct: 'цүнх', scenario: 'cyrillic_bag' },

  // Latin transliterations
  { query: 'skims', expectedProduct: 'SKIMS', scenario: 'latin_skims' },
  { query: 'leevchik', expectedProduct: 'Леевчик', scenario: 'latin_leevchik' },
  { query: 'turshik', expectedProduct: 'турсик', scenario: 'latin_turshik' },
  { query: 'korset', expectedProduct: 'корсет', scenario: 'latin_korset' },
  { query: 'kashemir', expectedProduct: 'Кашемир', scenario: 'latin_cashmere' },
  { query: 'daashinz', expectedProduct: 'Даашинз', scenario: 'latin_dress' },
  { query: 'malgai', expectedProduct: 'малгай', scenario: 'latin_hat' },
  { query: 'boolt', expectedProduct: 'боолт', scenario: 'latin_hairband' },
  { query: 'tsunh', expectedProduct: 'цүнх', scenario: 'latin_bag' },
  { query: 'tarpzan', expectedProduct: 'Тарпизан', scenario: 'latin_tarpzan' },

  // Typos & misspellings
  { query: 'скимс хуулбар', expectedProduct: 'SKIMS', scenario: 'typo_skims_cyrillic' },
  { query: 'levchik', expectedProduct: 'Леевчик', scenario: 'typo_leevchik' },
  { query: 'turshk', expectedProduct: 'турсик', scenario: 'typo_turshik' },
  { query: 'tsamts', expectedProduct: 'цамц', scenario: 'latin_tsamts' },
  { query: 'corsет', expectedProduct: 'корсет', scenario: 'mixed_korset' },
  { query: 'omd', expectedProduct: 'өмд', scenario: 'latin_omd' },

  // Disambiguation tests — same category, should pick correct one
  { query: 'галбир цамц', expectedProduct: 'Галбир', scenario: 'disambig_galbar_vs_kashemir' },
  { query: 'кашемир цамц', expectedProduct: 'Кашемир', scenario: 'disambig_kashemir_vs_galbar' },
  { query: 'леевчик сет', expectedProduct: 'сет', scenario: 'disambig_leevchik_set' },
  { query: 'леевчик дангаар', expectedProduct: 'Леевчик', scenario: 'disambig_leevchik_solo' },
  { query: 'үсний боолт 86', expectedProduct: '86', scenario: 'disambig_boolt_86' },
  { query: 'үсний ком 80', expectedProduct: '80', scenario: 'disambig_boolt_80' },
  { query: 'бензэн турсик', expectedProduct: 'Бензэн турсик', scenario: 'disambig_benzen' },
  { query: '3 давхар корсет', expectedProduct: '3 давхар', scenario: 'disambig_3layer' },
  { query: 'zara даашинз', expectedProduct: 'Zara', scenario: 'disambig_zara_dress' },

  // Short/slang queries
  { query: 'сет', expectedProduct: 'сет', scenario: 'short_set' },
  { query: 'ком', expectedProduct: 'ком', scenario: 'short_kom' },
  { query: 'бүс', expectedProduct: 'корсет', scenario: 'slang_bus_korset' },
  { query: 'тайл гаргагч', expectedProduct: 'Тайл', scenario: 'alias_tail' },
]

// ── Multi-product order tests ──
const MULTI_ORDER_TESTS: MultiOrderTest[] = [
  {
    message: 'SKIMS + leevchik авъя',
    expectedProducts: ['SKIMS', 'Леевчик'],
    scenario: '2_products_latin',
  },
  {
    message: 'корсет + галбир цамц авъя',
    expectedProducts: ['корсет', 'Галбир'],
    scenario: '2_products_disambig',
  },
  {
    message: 'leevchik + turshik + skims авъя',
    expectedProducts: ['Леевчик', 'турсик', 'SKIMS'],
    scenario: '3_products_latin',
  },
  {
    message: '2sh leevchik, 4sh turshik авъя',
    expectedProducts: ['Леевчик', 'турсик'],
    scenario: '2_products_with_qty',
  },
  {
    message: 'кашемир цамц болон тарпизан өмд авъя',
    expectedProducts: ['Кашемир', 'Тарпизан'],
    scenario: '2_products_bolon',
  },
  {
    message: 'скимс бас леевчик сет авна',
    expectedProducts: ['SKIMS', 'сет'],
    scenario: '2_products_bas',
  },
  {
    message: 'zara даашинз + 3 давхар корсет авъя',
    expectedProducts: ['Zara', 'корсет'],
    scenario: '2_products_brand_mix',
  },
  {
    message: 'леевчик + турсик + корсет + галбир цамц авъя',
    expectedProducts: ['Леевчик', 'турсик', 'корсет', 'Галбир'],
    scenario: '4_products',
  },
  {
    message: 'үсний боолт ком 86ш, үсний ком 80ш авъя',
    expectedProducts: ['86', '80'],
    scenario: '2_similar_products',
  },
  {
    message: 'цамц + өмд сет авъя',
    expectedProducts: ['сет'],
    scenario: 'set_product',
  },
]

async function main() {
  const storeId = await getStoreId()
  console.log(`${c.cyan}${c.bold}`)
  console.log(`  ╔═══════════════════════════════════════════╗`)
  console.log(`  ║  Multi-Order + Search Alias Stress Test   ║`)
  console.log(`  ╚═══════════════════════════════════════════╝`)
  console.log(`${c.reset}`)

  // ── Part 1: Search alias tests ──
  console.log(`${c.cyan}Part 1: Search Alias Tests (${SEARCH_TESTS.length})${c.reset}\n`)
  let searchPass = 0, searchFail = 0

  for (const test of SEARCH_TESTS) {
    const results = await searchProducts(supabase, test.query, storeId, { maxProducts: 3, originalQuery: test.query })
    const topResult = results[0]?.name || '(no results)'
    const found = topResult.toLowerCase().includes(test.expectedProduct.toLowerCase())

    if (found) {
      searchPass++
      process.stdout.write(`  ${c.green}✓${c.reset} `)
    } else {
      searchFail++
      process.stdout.write(`  ${c.red}✗${c.reset} `)
    }
    console.log(`"${test.query}" → ${found ? c.green : c.red}${topResult}${c.reset}${!found ? ` (expected: ${test.expectedProduct})` : ''} ${c.dim}[${test.scenario}]${c.reset}`)
  }

  console.log(`\n  Search: ${c.green}${searchPass} pass${c.reset}, ${searchFail > 0 ? c.red : c.green}${searchFail} fail${c.reset} / ${SEARCH_TESTS.length}\n`)

  // ── Part 2: Multi-product split tests ──
  console.log(`${c.cyan}Part 2: Multi-Product Order Tests (${MULTI_ORDER_TESTS.length})${c.reset}\n`)
  let multiPass = 0, multiFail = 0

  for (const test of MULTI_ORDER_TESTS) {
    // Simulate the split logic from startMultiProductDraft
    const parts = test.message.split(/[+,&]|\sболон\s|\sба\s|\s(?:дээр|бас|нэмж|мөн)\s/i)
      .map(p => p.trim())
      .filter(p => p.length >= 2)

    const foundProducts: string[] = []
    for (const part of parts) {
      const cleanSearch = part.replace(/\d+\s*(?:ш|sh|ширхэг|shirheg)/i, '').replace(/авъя|авья|авах|авна|захиал|awya|awah|авии|avo|авмаар/gi, '').trim()
      if (cleanSearch.length < 2) continue
      const results = await searchProducts(supabase, cleanSearch, storeId, { maxProducts: 1, originalQuery: cleanSearch })
      if (results.length > 0) foundProducts.push(results[0].name)
    }

    // Check each expected product found
    const allFound = test.expectedProducts.every(exp =>
      foundProducts.some(f => f.toLowerCase().includes(exp.toLowerCase()))
    )
    const noDuplicates = new Set(foundProducts).size === foundProducts.length

    if (allFound && noDuplicates) {
      multiPass++
      console.log(`  ${c.green}✓${c.reset} "${test.message}"`)
      console.log(`    → ${foundProducts.join(' + ')} ${c.dim}[${test.scenario}]${c.reset}`)
    } else {
      multiFail++
      console.log(`  ${c.red}✗${c.reset} "${test.message}"`)
      console.log(`    → Got: ${foundProducts.join(' + ')}`)
      console.log(`    → Expected: ${test.expectedProducts.join(' + ')}`)
      if (!noDuplicates) console.log(`    ${c.red}⚠ DUPLICATES${c.reset}`)
      console.log(`    ${c.dim}[${test.scenario}]${c.reset}`)
    }
    console.log()
  }

  console.log(`  Multi-order: ${c.green}${multiPass} pass${c.reset}, ${multiFail > 0 ? c.red : c.green}${multiFail} fail${c.reset} / ${MULTI_ORDER_TESTS.length}\n`)

  // ── Summary ──
  const totalPass = searchPass + multiPass
  const totalFail = searchFail + multiFail
  const total = SEARCH_TESTS.length + MULTI_ORDER_TESTS.length
  console.log(`${c.cyan}${'═'.repeat(50)}`)
  console.log(`  Total: ${totalPass}/${total} pass (${Math.round(totalPass / total * 100)}%)`)
  console.log(`${'═'.repeat(50)}${c.reset}`)

  if (totalFail > 0) process.exit(1)
}

main().catch(console.error)
