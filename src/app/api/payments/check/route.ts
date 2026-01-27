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
 * POST /api/payments/check
 *
 * Checks the payment status for an order.
 * - QPay: Calls QPay API to verify payment
 * - Bank/Cash: Manual verification only (admin marks as paid)
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const body = await request.json()
  const { order_id } = body

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, order_number, payment_method, payment_status, notes, total_amount')
    .eq('id', order_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Already paid
  if (order.payment_status === 'paid') {
    return NextResponse.json({
      status: 'paid',
      payment_method: order.payment_method,
    })
  }

  // QPay payment check
  if (order.payment_method === 'qpay' && isQPayConfigured()) {
    try {
      // Extract invoice_id from notes
      let invoiceId: string | null = null
      if (order.notes) {
        try {
          const notesData = JSON.parse(order.notes)
          invoiceId = notesData.qpay_invoice_id
        } catch {
          // notes is not JSON, skip
        }
      }

      if (!invoiceId) {
        return NextResponse.json({
          status: 'pending',
          payment_method: 'qpay',
          message: 'QPay invoice not found for this order',
        })
      }

      const checkResult = await checkQPayPayment(invoiceId)

      if (checkResult.count > 0 && checkResult.paid_amount >= order.total_amount) {
        // Payment confirmed — update order
        const paymentRow = checkResult.rows[0]

        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            updated_at: new Date().toISOString(),
            notes: JSON.stringify({
              qpay_invoice_id: invoiceId,
              qpay_payment_id: paymentRow.payment_id,
              qpay_payment_date: paymentRow.payment_date,
              qpay_paid_amount: checkResult.paid_amount,
            }),
          })
          .eq('id', order_id)

        // Decrement stock and trigger low_stock notifications if needed
        await decrementStockAndNotify(supabase, order_id, order.store_id)

        // Dispatch new_order notification
        dispatchNotification(order.store_id, 'new_order', {
          order_id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          payment_method: order.payment_method,
        })

        return NextResponse.json({
          status: 'paid',
          payment_method: 'qpay',
          paid_amount: checkResult.paid_amount,
          payment_id: paymentRow.payment_id,
          payment_date: paymentRow.payment_date,
        })
      }

      return NextResponse.json({
        status: 'pending',
        payment_method: 'qpay',
        message: 'Payment not yet received',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'QPay check error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Non-QPay: return current status
  return NextResponse.json({
    status: order.payment_status || 'pending',
    payment_method: order.payment_method,
  })
}

/**
 * PATCH /api/payments/check
 *
 * Manually update payment status (for bank transfer and cash payments)
 */
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase()
  const body = await request.json()
  const { order_id, payment_status } = body

  if (!order_id || !payment_status) {
    return NextResponse.json(
      { error: 'order_id and payment_status required' },
      { status: 400 }
    )
  }

  const validStatuses = ['paid', 'pending', 'refunded']
  if (!validStatuses.includes(payment_status)) {
    return NextResponse.json(
      { error: `Invalid payment_status. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update({
      payment_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)
    .select('id, payment_status')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    order_id: order.id,
    payment_status: order.payment_status,
    updated: true,
  })
}
