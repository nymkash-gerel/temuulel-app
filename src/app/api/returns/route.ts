import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications'
import { validateBody, createReturnSchema, parsePagination } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function generateReturnNumber(): string {
  return `RET-${Date.now()}`
}

/**
 * GET /api/returns
 *
 * List return requests for the authenticated user's store.
 * Supports filtering by status and pagination.
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('return_requests')
    .select(`
      id, return_number, return_type, status, reason, refund_amount, refund_method,
      handled_by, admin_notes, created_at, approved_at, completed_at, rejected_at,
      orders(id, order_number, total_amount),
      customers(id, name, phone)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ['pending', 'approved', 'rejected', 'completed'].includes(status)) {
    query = query.eq('status', status as 'pending' | 'approved' | 'rejected' | 'completed')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/returns
 *
 * Create a new return request for an order.
 * For partial returns, include items array with specific order items.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  const { data: body, error: validationError } = await validateBody(request, createReturnSchema)
  if (validationError) return validationError

  const { order_id, return_type, reason, refund_amount, refund_method, admin_notes, items } = body

  // Verify order belongs to store
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, customer_id')
    .eq('id', order_id)
    .eq('store_id', store.id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // For partial returns, items are required
  if (return_type === 'partial' && (!items || items.length === 0)) {
    return NextResponse.json({ error: 'Partial return requires items' }, { status: 400 })
  }

  const returnNumber = generateReturnNumber()
  const finalRefundAmount = refund_amount ?? (return_type === 'full' ? Number(order.total_amount) : 0)

  const { data: newReturn, error: returnError } = await supabase
    .from('return_requests')
    .insert({
      store_id: store.id,
      order_id,
      customer_id: order.customer_id || null,
      return_number: returnNumber,
      return_type,
      reason: reason || null,
      status: 'pending',
      refund_amount: finalRefundAmount,
      refund_method: refund_method || null,
      admin_notes: admin_notes || null,
    })
    .select('id, return_number, status, return_type, refund_amount, created_at')
    .single()

  if (returnError) {
    return NextResponse.json({ error: returnError.message }, { status: 500 })
  }

  // Insert return items for partial returns
  if (return_type === 'partial' && items && items.length > 0) {
    const itemInserts = items.map(item => ({
      return_id: newReturn.id,
      order_item_id: item.order_item_id,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
      reason: item.reason || null,
    }))

    const { error: itemsError } = await supabase
      .from('return_items')
      .insert(itemInserts)

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
  }

  // Dispatch notification
  dispatchNotification(store.id, 'return_requested', {
    return_id: newReturn.id,
    return_number: newReturn.return_number,
    order_number: order.order_number,
    return_type,
    refund_amount: finalRefundAmount,
  })

  return NextResponse.json(newReturn)
}
