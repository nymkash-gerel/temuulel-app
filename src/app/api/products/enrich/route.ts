import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { enrichProduct } from '@/lib/ai/product-enricher'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, productEnrichSchema } from '@/lib/validations'
import type { ProductEnrichmentInput } from '@/lib/ai/types'

const RATE_LIMIT = { limit: 5, windowSeconds: 60 }

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: body, error: validationError } = await validateBody(request, productEnrichSchema)
  if (validationError) return validationError
  const ids = body.product_ids

  // Verify user owns these products (through store ownership)
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Fetch products belonging to this store (include existing product_faqs)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, category, base_price')
    .eq('store_id', store.id)
    .in('id', ids)

  if (!products || products.length === 0) {
    return NextResponse.json({ enriched: 0 })
  }

  let enrichedCount = 0

  for (const product of products) {
    const input: ProductEnrichmentInput = {
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      base_price: product.base_price,
    }

    const result = await enrichProduct(input)
    if (!result) continue


    await supabase
      .from('products')
      .update({
        search_aliases: result.search_aliases,
        product_faqs: result.product_faqs,
      })
      .eq('id', product.id)

    enrichedCount++
  }

  return NextResponse.json({ enriched: enrichedCount })
}
