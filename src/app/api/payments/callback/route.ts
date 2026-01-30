import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkQPayPayment, isQPayConfigured } from '@/lib/qpay'
import { dispatchNotification } from '@/lib/notifications'
import { decrementStockAndNotify } from '@/lib/stock'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * GET /api/payments/callback?order_id=xxx
 *
 * QPay calls this URL after a payment is made.
 * Verifies the payment and updates the order status.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const orderId = request.nextUrl.searchParams.get('order_id')

  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  if (!isQPayConfigured()) {
    return NextResponse.json({ error: 'QPay not configured' }, { status: 500 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, order_number, payment_status, notes, total_amount, payment_method')
    .eq('id', orderId)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Already paid — nothing to do
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

      // Update order as paid
      await supabase
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
