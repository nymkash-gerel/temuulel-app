import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications'
import { validateBody, updateVoucherSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/vouchers/[id]
 *
 * Get a single voucher with customer and policy info.
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
    .from('vouchers')
    .select(`
      *,
      customers(id, name, phone, email),
      compensation_policies(id, name, complaint_category)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/vouchers/[id]
 *
 * Update voucher status: approve, reject, or redeem.
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

  const { data: body, error: validationError } = await validateBody(request, updateVoucherSchema)
  if (validationError) return validationError

  const { status, approved_by, admin_notes, redeemed_order_id } = body

  // Fetch current voucher
  const { data: voucher } = await supabase
    .from('vouchers')
    .select('id, status, voucher_code, customer_id, store_id, compensation_type, compensation_value')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!voucher) {
    return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    pending_approval: ['approved', 'rejected'],
    approved: ['redeemed'],
  }

  const allowed = validTransitions[voucher.status]
  if (!allowed || !allowed.includes(status)) {
    return NextResponse.json({
      error: `Cannot transition from ${voucher.status} to ${status}`,
    }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (status === 'approved') {
    updateData.approved_by = approved_by || null
    updateData.approved_by_user_id = user.id
  } else if (status === 'redeemed') {
    updateData.redeemed_at = now
    if (redeemed_order_id) updateData.redeemed_order_id = redeemed_order_id
  }

  if (admin_notes) updateData.admin_notes = admin_notes

  const { data: updated, error: updateError } = await supabase
    .from('vouchers')
    .update(updateData)
    .eq('id', id)
    .select('id, voucher_code, status, approved_by, redeemed_at, updated_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Get customer name for notification
  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', voucher.customer_id)
    .single()

  const compLabel =
    voucher.compensation_type === 'percent_discount'
      ? `${voucher.compensation_value}% хөнгөлөлт`
      : voucher.compensation_type === 'fixed_discount'
        ? `${new Intl.NumberFormat('mn-MN').format(voucher.compensation_value)}₮ хөнгөлөлт`
        : voucher.compensation_type === 'free_shipping'
          ? 'Үнэгүй хүргэлт'
          : 'Үнэгүй бараа'

  // Dispatch notification
  const eventMap: Record<string, 'compensation_approved' | 'compensation_rejected' | 'voucher_redeemed'> = {
    approved: 'compensation_approved',
    rejected: 'compensation_rejected',
    redeemed: 'voucher_redeemed',
  }

  dispatchNotification(store.id, eventMap[status], {
    voucher_id: updated.id,
    voucher_code: updated.voucher_code,
    customer_name: customer?.name || '',
    compensation_label: compLabel,
    admin_notes: admin_notes || '',
  })

  return NextResponse.json(updated)
}
