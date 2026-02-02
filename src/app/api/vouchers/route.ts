import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parsePagination } from '@/lib/validations'

/**
 * GET /api/vouchers
 *
 * List vouchers for the authenticated user's store.
 * Supports filtering by status.
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
    .from('vouchers')
    .select(`
      id, voucher_code, compensation_type, compensation_value, max_discount_amount,
      complaint_category, complaint_summary, status, approved_by,
      valid_until, redeemed_at, created_at,
      customers(id, name, phone),
      compensation_policies(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ['pending_approval', 'approved', 'rejected', 'redeemed', 'expired'].includes(status)) {
    query = query.eq('status', status as 'pending_approval' | 'approved' | 'rejected' | 'redeemed' | 'expired')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mark expired vouchers on-the-fly
  const now = new Date().toISOString()
  const processed = (data || []).map(v => {
    if (v.status === 'approved' && v.valid_until && v.valid_until < now) {
      return { ...v, status: 'expired' as const }
    }
    return v
  })

  return NextResponse.json({ data: processed, total: count })
}
