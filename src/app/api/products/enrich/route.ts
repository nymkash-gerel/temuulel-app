import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { enrichProduct } from '@/lib/ai/product-enricher'
import type { ProductEnrichmentInput } from '@/lib/ai/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { product_ids } = body as { product_ids: string[] }

  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return NextResponse.json({ error: 'product_ids required' }, { status: 400 })
  }

  // Limit batch size
  const ids = product_ids.slice(0, 20)

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
    .select('id, name, description, category, base_price, product_faqs')
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

    // Merge AI FAQs with existing merchant-written FAQs (merchant takes priority)
    const existingFaqs = (product.product_faqs || {}) as Record<string, string>
    const mergedFaqs: Record<string, string> = { ...result.product_faqs }
    for (const [key, value] of Object.entries(existingFaqs)) {
      if (value && value.trim()) {
        mergedFaqs[key] = value // merchant-written value takes priority
      }
    }

    await supabase
      .from('products')
      .update({
        search_aliases: result.search_aliases,
        product_faqs: mergedFaqs,
      })
      .eq('id', product.id)

    enrichedCount++
  }

  return NextResponse.json({ enriched: enrichedCount })
}
