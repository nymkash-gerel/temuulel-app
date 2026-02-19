import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createQPayInvoice, isQPayConfigured } from '@/lib/qpay'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createPaymentSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * POST /api/payments/create
 *
 * Creates a payment for an order.
 * - QPay: Generates a QR invoice via QPay API
 * - Bank: Returns bank account details from store settings
 * - Cash: Marks as cash on delivery
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()

  const { data: body, error: validationError } = await validateBody(request, createPaymentSchema)
  if (validationError) return validationError
  const { order_id, payment_method } = body

  // Get order with store info
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, store_id, payment_status')
    .eq('id', order_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.payment_status === 'paid') {
    return NextResponse.json({ error: 'Order already paid' }, { status: 400 })
  }

  // Get store payment settings
  const { data: store } = await supabase
    .from('stores')
    .select('name, payment_settings')
    .eq('id', order.store_id)
    .single()

  const paymentSettings = (store?.payment_settings || {}) as Record<string, unknown>

  // Update order payment method
  await supabase
    .from('orders')
    .update({
      payment_method,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id)

  switch (payment_method) {
    case 'qpay': {
      if (!isQPayConfigured()) {
        return NextResponse.json(
          { error: 'QPay not configured. Set QPAY_USERNAME, QPAY_PASSWORD, and QPAY_INVOICE_CODE environment variables.' },
          { status: 500 }
        )
      }

      if (!paymentSettings.qpay_enabled) {
        return NextResponse.json(
          { error: 'QPay is not enabled for this store' },
          { status: 400 }
        )
      }

      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
        const callbackUrl = `${baseUrl}/api/payments/callback?order_id=${order_id}`

        const invoice = await createQPayInvoice({
          orderNumber: order.order_number,
          amount: order.total_amount,
          description: `${store?.name || 'Temuulel'} - Захиалга #${order.order_number}`,
          callbackUrl,
        })

        // Store invoice_id in order notes or metadata for later checking
        await supabase
          .from('orders')
          .update({
            notes: JSON.stringify({
              qpay_invoice_id: invoice.invoice_id,
              qpay_short_url: invoice.qPay_shortUrl,
            }),
          })
          .eq('id', order_id)

        return NextResponse.json({
          payment_method: 'qpay',
          invoice_id: invoice.invoice_id,
          qr_image: invoice.qr_image,
          qr_text: invoice.qr_text,
          short_url: invoice.qPay_shortUrl,
          deeplinks: invoice.urls,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'QPay error'
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    case 'bank': {
      if (!paymentSettings.bank_transfer_enabled) {
        return NextResponse.json(
          { error: 'Bank transfer is not enabled for this store' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        payment_method: 'bank',
        bank_name: paymentSettings.bank_name || '',
        bank_account: paymentSettings.bank_account || '',
        bank_holder: paymentSettings.bank_holder || '',
        amount: order.total_amount,
        description: `Захиалга #${order.order_number}`,
        note: `Гүйлгээний утга: ${order.order_number}`,
      })
    }

    case 'cash': {
      return NextResponse.json({
        payment_method: 'cash',
        amount: order.total_amount,
        message: 'Хүргэлтийн үед бэлнээр төлнө',
      })
    }

    default:
      return NextResponse.json(
        { error: `Unknown payment method: ${payment_method}` },
        { status: 400 }
      )
  }
}
