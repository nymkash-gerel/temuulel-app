import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { getAllTemplates, getTemplate } from '@/lib/industry-templates'
import type { Json } from '@/lib/database.types'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

/**
 * GET /api/templates/apply
 * Returns all available industry templates (public, no auth).
 */
export async function GET() {
  const templates = getAllTemplates().map(t => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    category: t.category,
    accentColor: t.accentColor,
    servicesCount: t.sampleServices?.length ?? 0,
    productsCount: t.sampleProducts?.length ?? 0,
    categories: t.categories,
  }))

  return NextResponse.json({ templates })
}

/**
 * POST /api/templates/apply
 * Applies an industry template to the authenticated user's store.
 * Seeds chatbot settings + sample services/products (if store is empty).
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: { template_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { template_id } = body
  if (!template_id || typeof template_id !== 'string') {
    return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
  }

  // Look up template
  const template = getTemplate(template_id)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Update store: business_type, chatbot_settings, ai_auto_reply
  const { error: updateError } = await supabase
    .from('stores')
    .update({
      business_type: template.id,
      chatbot_settings: template.chatbotSettings as unknown as Json,
      ai_auto_reply: true,
    })
    .eq('id', store.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  let servicesSeeded = 0
  let productsSeeded = 0

  // Seed sample services (only if store has none)
  if (template.sampleServices && template.sampleServices.length > 0) {
    const { count } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)

    if (count === 0) {
      const rows = template.sampleServices.map(s => ({
        store_id: store.id,
        name: s.name,
        description: s.description,
        category: s.category,
        duration_minutes: s.duration_minutes,
        base_price: s.base_price,
        ai_context: s.ai_context ?? null,
        status: 'active' as const,
      }))

      const { error: svcErr } = await supabase.from('services').insert(rows)
      if (!svcErr) {
        servicesSeeded = rows.length
      }
    }
  }

  // Seed sample products (only if store has none)
  if (template.sampleProducts && template.sampleProducts.length > 0) {
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)

    if (count === 0) {
      const rows = template.sampleProducts.map(p => ({
        store_id: store.id,
        name: p.name,
        description: p.description,
        category: p.category,
        base_price: p.base_price,
        ai_context: p.ai_context ?? null,
        search_aliases: p.search_aliases ?? [],
        status: 'active' as const,
      }))

      const { error: prodErr } = await supabase.from('products').insert(rows)
      if (!prodErr) {
        productsSeeded = rows.length
      }
    }
  }

  return NextResponse.json({
    success: true,
    template_id: template.id,
    services_seeded: servicesSeeded,
    products_seeded: productsSeeded,
  })
}
