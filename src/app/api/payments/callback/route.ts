import { NextRequest, NextResponse } from 'next/server'
import { checkQPayPayment, isQPayConfigured } from '@/lib/qpay'
import { dispatchNotification } from '@/lib/notifications'
import { decrementStockAndNotify } from '@/lib/stock'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { getSupabase } from '@/lib/supabase/service'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

/**
 * GET /api/payments/callback?order_id=xxx
 *
 * QPay calls this URL after a payment is made.
 * Verifies the payment and updates the order status.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const orderId = request.nextUrl.searchParams.get('order_id')

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  // Validate order_id is a valid UUID to prevent enumeration
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return NextResponse.json({ error: 'Invalid order_id format' }, { status: 400 })
  }

  if (!isQPayConfigured()) {
    return NextResponse.json({ error: 'QPay not configured' }, { status: 500 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, order_number, payment_status, notes, total_amount, payment_method')
    .eq('id', orderId)
    .eq('payment_method', 'qpay')
    .single()

  if (!order) {
    return NextResponse.json({ status: 'not_paid' })
  }

  // Already paid — nothing to do (same response as not-found to prevent enumeration)
  if (order.payment_status === 'paid') {
    return NextResponse.json({ status: 'already_paid' })
  }

  // Extract QPay invoice ID from notes
  let invoiceId: string | null = null
  if (order.notes) {
    try {
      const notesData = JSON.parse(order.notes)
      invoiceId = notesData.qpay_invoice_id
    } catch {
      // not JSON
    }
  }

  if (!invoiceId) {
    return NextResponse.json({ error: 'No QPay invoice found for this order' }, { status: 400 })
  }

  try {
    // Verify payment with QPay
    const checkResult = await checkQPayPayment(invoiceId)

    if (checkResult.count > 0 && checkResult.paid_amount >= order.total_amount) {
      const paymentRow = checkResult.rows[0]

      // Update order as paid (with optimistic lock to prevent double-processing)
      const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed', // Auto-confirm on payment
          updated_at: new Date().toISOString(),
          notes: JSON.stringify({
            qpay_invoice_id: invoiceId,
            qpay_payment_id: paymentRow.payment_id,
            qpay_payment_date: paymentRow.payment_date,
            qpay_paid_amount: checkResult.paid_amount,
            qpay_wallet: paymentRow.payment_wallet,
          }),
        })
        .eq('id', orderId)
        .neq('payment_status', 'paid') // Prevent double-processing
        .select('id')
        .single()

      // If no row was updated, another request already processed this payment
      if (updateError || !updated) {
        return NextResponse.json({ status: 'already_paid' })
      }

      // Decrement stock and trigger low_stock notifications if needed
      await decrementStockAndNotify(supabase, orderId, order.store_id)

      // Dispatch new_order notification
      dispatchNotification(order.store_id, 'new_order', {
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
      })

      return NextResponse.json({
        status: 'paid',
        payment_id: paymentRow.payment_id,
      })
    }

    return NextResponse.json({ status: 'not_paid' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'QPay verification error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
