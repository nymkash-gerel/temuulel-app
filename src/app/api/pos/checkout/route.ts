import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { withSpan, addBreadcrumb } from '@/lib/sentry-helpers'
import { z } from 'zod'

const posCheckoutSchema = z.object({
  session_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        unit_price: z.number().min(0),
        variant_id: z.string().uuid().optional(),
      })
    )
    .min(1),
  payment_method: z.enum(['cash', 'card', 'qpay', 'bank']),
  amount_paid: z.number().min(0),
  notes: z.string().optional(),
  order_type: z.enum(['dine_in', 'pickup', 'delivery', 'catering']).default('dine_in'),
  table_session_id: z.string().uuid().optional(),
})

/**
 * POST /api/pos/checkout
 *
 * Creates an order from a POS session. Verifies the session belongs to
 * the store and is open, inserts the order and order items, then updates
 * the POS session totals.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const log = createRequestLogger(crypto.randomUUID(), '/api/pos/checkout', {
    userId: user.id,
    storeId: store.id,
  })

  return withSpan('pos.checkout', 'pos.transaction', async () => {

  let body: z.infer<typeof posCheckoutSchema>
  try {
    const json = await request.json()
    body = posCheckoutSchema.parse(json)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Verify session belongs to the store and is open
  const { data: session, error: sessionError } = await supabase
    .from('pos_sessions')
    .select('id, status, total_sales, total_transactions')
    .eq('id', body.session_id)
    .eq('store_id', store.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'POS session not found' }, { status: 404 })
  }

  if (session.status !== 'open') {
    return NextResponse.json(
      { error: 'POS session is not open' },
      { status: 400 }
    )
  }

  // Calculate total amount from items
  const total_amount = body.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  )

  // Generate order number
  const orderNumber = `POS-${Date.now()}`

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      order_number: orderNumber,
      total_amount,
      status: 'completed',
      payment_method: body.payment_method,
      payment_status: 'paid',
      notes: body.notes || null,
      order_type: body.order_type,
      table_session_id: body.table_session_id || null,
    })
    .select()
    .single()

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 })
  }

  // Insert order items
  const orderItems = body.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    variant_id: item.variant_id || null,
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)
    .select()

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Update POS session: increment total_sales and total_transactions
  const { error: updateError } = await supabase
    .from('pos_sessions')
    .update({
      total_sales: (session.total_sales || 0) + total_amount,
      total_transactions: (session.total_transactions || 0) + 1,
    })
    .eq('id', session.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  void addBreadcrumb('pos.checkout', 'Order created', {
    orderNumber,
    total_amount,
    item_count: body.items.length,
    payment_method: body.payment_method,
  })
  log.info('POS checkout complete', { orderNumber, total_amount, item_count: body.items.length })

  return NextResponse.json(
    { ...order, items: insertedItems },
    { status: 201 }
  )

  }) // end withSpan
}
