/**
 * Product, order, and table search helpers.
 * Handles Mongolian synonym expansion, Latin→Cyrillic search term extraction,
 * and category mapping.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { normalizeText } from './text-normalizer'
import { getRedis } from './redis'
import type { ProductMatch, TableMatch, OrderMatch } from './chat-ai-types'

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** Cache TTL in seconds (5 minutes) */
const PRODUCT_CACHE_TTL = 300

/**
 * Build a deterministic cache key from search parameters.
 */
function productCacheKey(storeId: string, query: string, opts: SearchProductsOptions): string {
  const norm = normalizeText(query)
  const flags = [
    opts.availableOnly ? 'avail' : '',
    opts.maxProducts ? `max${opts.maxProducts}` : '',
  ].filter(Boolean).join(':')
  return `psearch:${storeId}:${norm}${flags ? ':' + flags : ''}`
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Escape Postgres LIKE special characters in user-provided search terms.
 * Prevents users from injecting `%` or `_` wildcards into `.ilike` filters.
 */
function escapeLike(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * Escape PostgreSQL array literal characters to prevent injection.
 * Removes/escapes `{`, `}`, `,`, `"` characters that could break array syntax.
 */
function escapeArrayLiteral(term: string): string {
  return term.replace(/[{},\"]/g, '')
}

// ---------------------------------------------------------------------------
// Stop words & Category mapping
// ---------------------------------------------------------------------------

const STOP_WORDS = [
  'байна', 'уу', 'юу', 'та', 'нар', 'надад', 'энэ', 'тэр', 'ямар',
  'ямар нэг', 'нэг', 'хэд', 'хэдэн', 'чи', 'бид', 'тэд', 'манай',
  'танай', 'миний', 'маш', 'их', 'бага', 'мөн', 'бас', 'ба', 'болон',
  'гэж', 'гэсэн', 'гэдэг', 'гэхэд', 'харуулна', 'харуул', 'хайх',
  'сайн', 'өглөөний', 'мэнд', 'сонирхож', 'авмаар', 'байгаа',
  // Generic product/commerce terms (not useful as search filters)
  'бараа', 'бара', 'барааа', 'бараагаа',
  'бүтээгдэхүүн', 'бутээгдэхүүн', 'бутээгдхүүн', 'бүтээгдхүүн',
  'худалдаж', 'зарна', 'зарах', 'авах', 'авъя', 'авья',
  'үзүүл', 'үзүүлнэ', 'ймар', 'бн', 'ве', 'вэ',
]

export const CATEGORY_MAP: Record<string, string> = {
  // Clothing
  'хувцас': 'clothing', 'хувцаас': 'clothing', 'хувцс': 'clothing',
  'кийим': 'clothing', 'өмсөх': 'clothing',
  'цамц': 'clothing', 'даашинз': 'clothing', 'өмд': 'clothing',
  'куртка': 'clothing', 'пальто': 'clothing', 'хүрэм': 'clothing',
  'дээл': 'clothing', 'малгай': 'clothing',
  // Mongolian cashmere/textile products
  'кашемир': 'clothing', 'ноолуур': 'clothing', 'ноолууран': 'clothing',
  // Shoes
  'гутал': 'shoes', 'гуталаа': 'shoes', 'гутлаа': 'shoes',
  'пүүз': 'shoes', 'пууз': 'shoes', 'пүүзээ': 'shoes',
  'шаахай': 'shoes',
  // Bags
  'цүнх': 'bags', 'цунх': 'bags', 'цүнхээ': 'bags',
  'уут': 'bags',
  // Accessories
  'аксессуар': 'accessories', 'аксесуар': 'accessories', 'аксесор': 'accessories',
  'бүс': 'accessories', 'бүсээ': 'accessories',
  'зүүлт': 'accessories', 'бөгж': 'accessories', 'бугуйвч': 'accessories',
}

// ---------------------------------------------------------------------------
// Search term extraction
// ---------------------------------------------------------------------------

export function extractSearchTerms(message: string): string {
  const words = normalizeText(message).split(/\s+/)
  const meaningful = words.filter((w) => w.length > 1 && !STOP_WORDS.includes(w))
  return meaningful.join(' ')
}

/**
 * Extract the original Latin words from a message (before Cyrillic normalization).
 * Used as a fallback search — "cashmere" won't match "Кашемир" after normalization.
 */
export function extractLatinTerms(message: string): string[] {
  const latinWordRegex = /[a-zA-Z]{3,}/g
  const matches = message.match(latinWordRegex) || []
  return matches.map((w) => w.toLowerCase())
}

// ---------------------------------------------------------------------------
// English → Mongolian translation map
// ---------------------------------------------------------------------------

const ENGLISH_TO_MONGOLIAN: Record<string, string[]> = {
  cashmere: ['кашемир', 'ноолуур'],
  shirt: ['цамц'],
  hat: ['малгай'],
  bag: ['цүнх', 'уут'],
  shoes: ['гутал'],
  pants: ['өмд'],
  jacket: ['куртка', 'хүрэм'],
  coat: ['пальто'],
  watch: ['цаг'],
  earphone: ['чихэвч'],
  earphones: ['чихэвч'],
  headphone: ['чихэвч'],
  headphones: ['чихэвч'],
  charger: ['цэнэглэгч'],
  toy: ['тоглоом'],
  lego: ['лего'],
  shampoo: ['шампунь'],
  cream: ['тос'],
}

// ---------------------------------------------------------------------------
// Synonym expansion
// ---------------------------------------------------------------------------

const MONGOLIAN_SYNONYMS: string[][] = [
  ['кашемир', 'ноолуур', 'ноолууран'],
  ['арьс', 'арьсан', 'leather'],
  ['гутал', 'шаахай', 'пүүз'],
  ['цүнх', 'уут', 'bag'],
]

/** Given a search word, return any synonyms from MONGOLIAN_SYNONYMS */
function expandSynonyms(word: string): string[] {
  const extras: string[] = []
  for (const group of MONGOLIAN_SYNONYMS) {
    if (group.some((syn) => word.includes(syn) || syn.includes(word))) {
      extras.push(...group.filter((syn) => syn !== word))
    }
  }
  return extras
}

// ---------------------------------------------------------------------------
// Product search
// ---------------------------------------------------------------------------

export interface SearchProductsOptions {
  maxProducts?: number
  /** Filter to only available items (restaurant menus) */
  availableOnly?: boolean
  /** Original message before Cyrillic normalization — used to extract Latin words for search */
  originalQuery?: string
}

/**
 * Generic product search. Accepts any Supabase client (browser or service-role).
 */
export async function searchProducts(
  supabase: SupabaseClient<Database>,
  query: string,
  storeId: string,
  options: SearchProductsOptions = {}
): Promise<ProductMatch[]> {
  const { maxProducts = 5, availableOnly = false, originalQuery } = options

  // Try Redis cache first
  const redis = getRedis()
  const cacheKey = productCacheKey(storeId, query, options)
  if (redis) {
    try {
      const cached = await redis.get<ProductMatch[]>(cacheKey)
      if (cached) return cached
    } catch {
      // Cache miss or error — fall through to DB
    }
  }
  const normalizedQuery = normalizeText(query)

  // Detect "browse all" requests — generic queries that mean "show me everything"
  const BROWSE_ALL_PATTERNS = [
    'бараа үз', 'бара үз', 'бараа уз', 'бара уз',
    'бараа харуул', 'бараа харъя', 'юу байна', 'юу байгаа',
    'бараа бгаа', 'бара бгаа', 'бараагаа харуул', 'бүтээгдэхүүн', 'каталог',
    'бараа жагсаалт', 'бүх бараа', 'бараа авъя', 'бараа авмаар',
    'юу зарж', 'юу зарна', 'ямар бараа', 'ямар бара',
    'бара авъя', 'бара авмаар', 'бара харуул',
  ]
  // Also match if the only meaningful words left after stop-word removal are browse verbs
  const browseVerbs = ['үзэх', 'үзье', 'үзи', 'үзих', 'узэх', 'узи', 'узих', 'харах', 'харъя', 'харуул', 'харуулна']
  const afterStopWords = extractSearchTerms(query)
  const isBrowseVerb = afterStopWords.split(/\s+/).filter(Boolean).every(w => browseVerbs.some(v => w.startsWith(v)))
    && afterStopWords.length > 0
  const isBrowseAll = BROWSE_ALL_PATTERNS.some(p => normalizedQuery.includes(p)) || isBrowseVerb

  let mappedCategory: string | null = null
  for (const [mn, en] of Object.entries(CATEGORY_MAP)) {
    if (normalizedQuery.includes(mn)) {
      mappedCategory = en
      break
    }
  }

  // product_faqs and ai_context exist in DB but not in generated Supabase types
  let dbQuery = (supabase
    .from('products') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select(`
      id, name, description, category, base_price, images, sales_script,
      product_faqs, ai_context,
      available_today, sold_out, allergens, spicy_level,
      is_vegan, is_halal, is_gluten_free, dietary_tags,
      product_variants(size, color, price, stock_quantity)
    `)
    .eq('store_id', storeId)
    .eq('status', 'active')

  // For restaurant menus, filter to available items only
  if (availableOnly) {
    dbQuery = dbQuery.eq('available_today', true).eq('sold_out', false)
  }

  if (isBrowseAll) {
    // Return all products — no name/description filter
  } else if (mappedCategory) {
    dbQuery = dbQuery.eq('category', mappedCategory)
  } else {
    const searchTerms = extractSearchTerms(query)
    // Extract Latin words from the ORIGINAL message (before Cyrillic normalization)
    const latinSource = originalQuery || query
    const latinWords = extractLatinTerms(latinSource)
    const translatedWords = latinWords.flatMap((w) => ENGLISH_TO_MONGOLIAN[w] || [])

    const baseWords = searchTerms.split(/\s+/).filter(Boolean)
    // Expand Mongolian synonyms (ноолуур → кашемир, etc.)
    const synonymWords = baseWords.flatMap((w) => expandSynonyms(w))

    const allSearchWords = [
      ...baseWords,
      ...synonymWords,
      ...latinWords,
      ...translatedWords,
    ]

    if (allSearchWords.length > 0) {
      const conditions = allSearchWords
        .flatMap((w) => {
          const safe = escapeLike(w)
          const arraySafe = escapeArrayLiteral(w)
          return [
            `name.ilike.%${safe}%`,
            `description.ilike.%${safe}%`,
            `search_aliases.cs.{${arraySafe}}`,
          ]
        })
        .join(',')
      dbQuery = dbQuery.or(conditions)
    }
  }

  // --- Trigram fuzzy search fallback ---
  // If ILIKE search returns nothing, try pg_trgm similarity search
  // This catches "скимс" → "SKIMS", "цамц" → "Цамц эмэгтэй" etc.
  const isFuzzyCandidate = !isBrowseAll && !mappedCategory && normalizedQuery.length >= 2

  let { data } = await dbQuery.limit(maxProducts)

  // Trigram fuzzy fallback — if ILIKE found nothing, try pg_trgm similarity via raw SQL
  if ((!data || data.length === 0) && isFuzzyCandidate) {
    const fuzzyQuery = extractSearchTerms(query) || normalizedQuery
    const latinSource = originalQuery || query
    const latinTerms = extractLatinTerms(latinSource)
    const fuzzyTerms = [fuzzyQuery, ...latinTerms].filter(Boolean)

    for (const term of fuzzyTerms) {
      if (term.length < 2) continue
      // Use raw SQL with pg_trgm similarity() — avoids RPC schema cache issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fuzzyIds } = await (supabase as any)
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .or(`name.ilike.%${escapeLike(term)}%`)
        .limit(maxProducts)

      // If exact ILIKE didn't match, try fetching ALL active products and filter by similarity client-side
      // This is a pragmatic approach since pg_trgm similarity() can't be used in Supabase JS .or() filters
      if (!fuzzyIds || fuzzyIds.length === 0) {
        const { data: allProducts } = await (supabase.from('products') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select(`
            id, name, description, category, base_price, images, sales_script,
            product_faqs, ai_context, search_aliases,
            available_today, sold_out, allergens, spicy_level,
            is_vegan, is_halal, is_gluten_free, dietary_tags,
            product_variants(size, color, price, stock_quantity)
          `)
          .eq('store_id', storeId)
          .eq('status', 'active')
          .limit(50) // reasonable limit for client-side fuzzy

        if (allProducts && allProducts.length > 0) {
          // Client-side fuzzy matching using Levenshtein distance
          const termLower = term.toLowerCase()
          const maxDist = Math.max(1, Math.floor(termLower.length * 0.4)) // allow 40% edit distance

          const levenshtein = (a: string, b: string): number => {
            const m = a.length, n = b.length
            const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
            for (let i = 0; i <= m; i++) dp[i][0] = i
            for (let j = 0; j <= n; j++) dp[0][j] = j
            for (let i = 1; i <= m; i++)
              for (let j = 1; j <= n; j++)
                dp[i][j] = Math.min(
                  dp[i - 1][j] + 1, dp[i][j - 1] + 1,
                  dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                )
            return dp[m][n]
          }

          const isClose = (a: string, b: string) => {
            if (a.includes(b) || b.includes(a)) return true
            return levenshtein(a, b) <= maxDist
          }

          // Score each product by best Levenshtein distance
          const scored = allProducts
            .map((p: { name: string; search_aliases?: string[] }) => {
              const nameWords = p.name.toLowerCase().split(/\s+/)
              let bestDist = Infinity

              // Check name words
              for (const w of nameWords) {
                if (w.includes(termLower) || termLower.includes(w)) { bestDist = 0; break }
                const d = levenshtein(termLower, w)
                if (d < bestDist) bestDist = d
              }

              // Check aliases
              if (p.search_aliases) {
                for (const a of p.search_aliases) {
                  const aLower = a.toLowerCase()
                  if (aLower.includes(termLower) || termLower.includes(aLower)) { bestDist = 0; break }
                  const d = levenshtein(termLower, aLower)
                  if (d < bestDist) bestDist = d
                }
              }

              // Convert distance to confidence: 0 → 1.0, 1 → 0.85, 2 → 0.7, 3 → 0.55, 4+ → 0.4
              const confidence = bestDist === 0 ? 1.0
                : bestDist === 1 ? 0.85
                : bestDist === 2 ? 0.7
                : bestDist === 3 ? 0.55
                : 0.4

              return { product: p, bestDist, confidence }
            })
            .filter(s => s.bestDist <= maxDist)
            .sort((a, b) => a.bestDist - b.bestDist)

          if (scored.length > 0) {
            // Tag products with searchConfidence
            const fuzzyMatched = scored.slice(0, maxProducts).map(s => ({
              ...s.product,
              _searchConfidence: s.confidence,
            }))
            data = fuzzyMatched
            break
          }
        }
      }
    }
  }

  if (!data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data as any[]).map((row: any) => {
    const rawVariants = row.product_variants as { size: string | null; color: string | null; price: number; stock_quantity: number }[] | undefined
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      category: row.category ?? '',
      base_price: row.base_price ?? 0,
      images: (row.images ?? []) as string[],
      sales_script: row.sales_script,
      product_faqs: (row.product_faqs ?? null) as Record<string, string> | null,
      ai_context: (row.ai_context ?? null) as string | null,
      variants: rawVariants && rawVariants.length > 0 ? rawVariants : undefined,
      // Restaurant features
      available_today: row.available_today ?? true,
      sold_out: row.sold_out ?? false,
      allergens: (row.allergens ?? []) as string[],
      spicy_level: row.spicy_level ?? 0,
      is_vegan: row.is_vegan ?? false,
      is_halal: row.is_halal ?? false,
      is_gluten_free: row.is_gluten_free ?? false,
      dietary_tags: (row.dietary_tags ?? []) as string[],
      // Fuzzy match confidence (1.0 for ILIKE/alias, lower for Levenshtein)
      searchConfidence: row._searchConfidence ?? (isFuzzyCandidate ? 0.9 : 1.0),
    } as ProductMatch
  })

  // Write to Redis cache (fire-and-forget)
  if (redis && results.length > 0) {
    redis.set(cacheKey, results, { ex: PRODUCT_CACHE_TTL }).catch(() => {})
  }

  return results
}

// ---------------------------------------------------------------------------
// Table search
// ---------------------------------------------------------------------------

/**
 * Search for available tables at a restaurant.
 */
export async function searchAvailableTables(
  supabase: SupabaseClient<Database>,
  storeId: string,
  partySize?: number,
  dateTime?: Date
): Promise<TableMatch[]> {
  let dbQuery = supabase
    .from('table_layouts')
    .select('id, name, capacity, status, section')
    .eq('store_id', storeId)
    .eq('status', 'available')
    .eq('is_active', true)
    .order('capacity', { ascending: true })

  if (partySize) {
    dbQuery = dbQuery.gte('capacity', partySize)
  }

  const { data } = await dbQuery.limit(10)
  if (!data) return []

  // If a specific date/time is requested, filter out tables with conflicting reservations
  if (dateTime) {
    const reservationWindow = new Date(dateTime)
    const windowStart = new Date(reservationWindow.getTime() - 2 * 60 * 60 * 1000)
    const windowEnd = new Date(reservationWindow.getTime() + 2 * 60 * 60 * 1000)

    const { data: reservations } = await supabase
      .from('table_reservations')
      .select('table_id')
      .eq('store_id', storeId)
      .in('status', ['confirmed', 'pending'])
      .gte('reservation_time', windowStart.toISOString())
      .lte('reservation_time', windowEnd.toISOString())

    const reservedTableIds = new Set(reservations?.map(r => r.table_id) ?? [])
    return data
      .filter(t => !reservedTableIds.has(t.id))
      .map(row => ({
        id: row.id,
        table_name: row.name,
        capacity: row.capacity,
        status: row.status,
        location: row.section,
      }))
  }

  return data.map(row => ({
    id: row.id,
    table_name: row.name,
    capacity: row.capacity,
    status: row.status,
    location: row.section,
  }))
}

// ---------------------------------------------------------------------------
// Store busy mode
// ---------------------------------------------------------------------------

/**
 * Check if a store is in busy mode.
 */
export async function checkStoreBusyMode(
  supabase: SupabaseClient<Database>,
  storeId: string
): Promise<{ busy_mode: boolean; busy_message: string | null; estimated_wait_minutes: number | null }> {
  const { data } = await supabase
    .from('stores')
    .select('busy_mode, busy_message, estimated_wait_minutes')
    .eq('id', storeId)
    .single()

  return {
    busy_mode: data?.busy_mode ?? false,
    busy_message: data?.busy_message ?? null,
    estimated_wait_minutes: data?.estimated_wait_minutes ?? null,
  }
}

// ---------------------------------------------------------------------------
// Order search
// ---------------------------------------------------------------------------

/**
 * Generic order search.
 */
export async function searchOrders(
  supabase: SupabaseClient<Database>,
  query: string,
  storeId: string,
  customerId?: string
): Promise<OrderMatch[]> {
  let dbQuery = supabase
    .from('orders')
    .select('id, order_number, status, total_amount, tracking_number, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (customerId) {
    dbQuery = dbQuery.eq('customer_id', customerId)
  }

  // Only filter by query if it looks like an order number or tracking code
  if (query) {
    const looksLikeOrderRef = /ord[-\s]?\d|del[-\s]?\d|\d{6,}/i.test(query)
    if (looksLikeOrderRef) {
      dbQuery = dbQuery.or(`order_number.ilike.%${escapeLike(query)}%,tracking_number.ilike.%${escapeLike(query)}%`)
    }
    // Otherwise: just return customer's recent orders (no text filter)
  }

  const { data } = await dbQuery.limit(5)
  return (data as OrderMatch[]) || []
}
