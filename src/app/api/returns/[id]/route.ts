import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications'
import { validateBody, updateReturnSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/returns/[id]
 *
 * Get a single return request with items and related order info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data, error } = await supabase
    .from('return_requests')
    .select(`
      *,
      orders(id, order_number, total_amount, status, payment_status),
      customers(id, name, phone, email),
      return_items(
        id, quantity, unit_price, subtotal, reason,
        order_items(id, variant_label, products(id, name, images), product_variants(size, color, products(id, name, images)))
      )
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/returns/[id]
 *
 * Update a return request status: approve, reject, or complete.
 * - approved: sets handled_by, approved_at
 * - rejected: sets handled_by, rejected_at
 * - completed: sets completed_at, updates order payment_status to 'refunded'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, updateReturnSchema)
  if (validationError) return validationError

  const { status, handled_by, refund_amount, refund_method, admin_notes } = body

  // Fetch current return
  const { data: returnReq } = await supabase
    .from('return_requests')
    .select('id, status, order_id, return_number, refund_amount, store_id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!returnReq) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  // Validate status transitions
  const validTransitions: Record<string, string[]> = {
    pending: ['approved', 'rejected'],
    approved: ['completed', 'rejected'],
  }

  const allowed = validTransitions[returnReq.status]
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({
      error: `Cannot transition from ${returnReq.status} to ${status}`,
    }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (handled_by) updateData.handled_by = handled_by
  updateData.handled_by_user_id = user.id

  if (refund_amount !== undefined) updateData.refund_amount = refund_amount
  if (refund_method) updateData.refund_method = refund_method
  if (admin_notes) updateData.admin_notes = admin_notes

  if (status === 'approved') {
    updateData.approved_at = now
  } else if (status === 'rejected') {
    updateData.rejected_at = now
  } else if (status === 'completed') {
    updateData.completed_at = now
  }

  const { data: updated, error: updateError } = await supabase
    .from('return_requests')
    .update(updateData)
    .eq('id', id)
    .select('id, return_number, status, handled_by, refund_amount, refund_method, approved_at, completed_at, rejected_at, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // If completed, update order payment_status to 'refunded'
  if (status === 'completed') {
    await supabase
      .from('orders')
      .update({ payment_status: 'refunded', updated_at: now })
      .eq('id', returnReq.order_id)
  }

  // Fetch order info for notification
  const { data: order } = await supabase
    .from('orders')
    .select('order_number')
    .eq('id', returnReq.order_id)
    .single()

  // Dispatch notification
  const eventMap: Record<string, 'return_approved' | 'return_rejected' | 'return_completed'> = {
    approved: 'return_approved',
    rejected: 'return_rejected',
    completed: 'return_completed',
  }

  dispatchNotification(store.id, eventMap[status], {
    return_id: updated.id,
    return_number: updated.return_number,
    order_number: order?.order_number || '',
    handled_by: updated.handled_by || '',
    refund_amount: updated.refund_amount,
    refund_method: updated.refund_method,
  })

  return NextResponse.json(updated)
}
