import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { parsePagination } from '@/lib/validations'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

// Mongolian to English category mapping
const categoryMap: Record<string, string> = {
  'хувцас': 'clothing',
  'гутал': 'shoes',
  'пүүз': 'shoes',
  'цүнх': 'bags',
  'аксессуар': 'accessories',
  'бүс': 'accessories',
}

function mapToCategory(query: string): string | null {
  const lowerQuery = query.toLowerCase()
  for (const [mn, en] of Object.entries(categoryMap)) {
    if (lowerQuery.includes(mn)) {
      return en
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = (searchParams.get('query') || '').slice(0, 200)
  const category = searchParams.get('category')
  const { limit, offset } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 50 })
  const storeId = searchParams.get('store_id')

  const supabase = await createClient()

  // Check if query matches a category in Mongolian
  const mappedCategory = mapToCategory(query)

  let dbQuery = supabase
    .from('products')
    .select('id, name, description, category, base_price, images, sales_script', { count: 'exact' })
    .eq('status', 'active')

  if (storeId) {
    dbQuery = dbQuery.eq('store_id', storeId)
  }

  if (mappedCategory) {
    // If user searched for a category term, filter by category
    dbQuery = dbQuery.eq('category', mappedCategory)
  } else if (query) {
    // Search in name, description, and AI-generated search aliases
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const conditions = words
      .flatMap((w) => [
        `name.ilike.%${w}%`,
        `description.ilike.%${w}%`,
        `search_aliases.cs.{${w}}`,
      ])
      .join(',')
    dbQuery = dbQuery.or(conditions)
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category)
  }

  const { data: products, error, count } = await dbQuery.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const formatted = (products || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.base_price,
    images: p.images,
    sales_script: p.sales_script
  }))

  return NextResponse.json({ data: formatted, count: count ?? formatted.length, limit, offset })
}
