import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createOrderSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

interface ShippingZone {
  name: string
  price: number
  estimatedDays: string
  enabled: boolean
}

interface ShippingSettings {
  free_shipping_enabled?: boolean
  free_shipping_minimum?: number
  zones?: ShippingZone[]
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}`
}

function calculateShipping(
  subtotal: number,
  zoneName: string | undefined,
  settings: ShippingSettings
): number {
  if (!zoneName || !settings.zones) return 0

  const zone = settings.zones.find((z) => z.name === zoneName && z.enabled)
  if (!zone) return 0

  if (settings.free_shipping_enabled && subtotal >= (settings.free_shipping_minimum || 0)) {
    return 0
  }

  return zone.price
}

/**
 * POST /api/orders
 *
 * Creates an order with line items and calculates shipping from the
 * store's configured shipping zones. Dispatches a new_order notification
 * (email, push, in-app, webhook) upon success.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { data: body, error: validationError } = await validateBody(request, createOrderSchema)
  if (validationError) return validationError

  const { store_id, customer_id, items, shipping_zone, shipping_address, notes } = body

  const supabase = getSupabase()

  // Fetch store to verify it exists and get shipping settings
  const { data: store } = await supabase
    .from('stores')
    .select('id, shipping_settings')
    .eq('id', store_id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    const qty = item.quantity || 1
    return sum + item.unit_price * qty
  }, 0)

  // Calculate shipping
  const shippingSettings = (store.shipping_settings || {}) as ShippingSettings
  const shippingAmount = calculateShipping(subtotal, shipping_zone, shippingSettings)
  const totalAmount = subtotal + shippingAmount

  // Create order
  const orderNumber = generateOrderNumber()
  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id,
      customer_id: customer_id || null,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      shipping_amount: shippingAmount,
      payment_status: 'pending',
      shipping_address: shipping_address || null,
      notes: notes || null,
    })
    .select('id, order_number, total_amount, shipping_amount, status, payment_status, created_at')
    .single()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  // Create order items
  const itemInserts = items.map((item) => ({
    order_id: newOrder.id,
    product_id: item.product_id || null,
    variant_id: item.variant_id || null,
    quantity: item.quantity || 1,
    unit_price: item.unit_price,
    variant_label: item.variant_label || null,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemInserts)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Dispatch new_order notification (non-blocking)
  dispatchNotification(store_id, 'new_order', {
    order_id: newOrder.id,
    order_number: newOrder.order_number,
    total_amount: newOrder.total_amount,
    payment_method: null,
  })

  return NextResponse.json({
    order_id: newOrder.id,
    order_number: newOrder.order_number,
    subtotal,
    shipping_amount: newOrder.shipping_amount,
    total_amount: newOrder.total_amount,
    status: newOrder.status,
    payment_status: newOrder.payment_status,
    created_at: newOrder.created_at,
  })
}
