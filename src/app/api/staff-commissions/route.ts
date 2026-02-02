import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createStaffCommissionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/staff-commissions
 *
 * List staff commissions for the store.
 * Supports filtering by staff_id, status, sale_type.
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
  const staffId = searchParams.get('staff_id')
  const saleType = searchParams.get('sale_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('staff_commissions')
    .select(`
      id, staff_id, appointment_id, sale_type, sale_amount, commission_rate,
      commission_amount, status, paid_at, notes, created_at, updated_at,
      staff(id, name),
      appointments(id, scheduled_at)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['pending', 'approved', 'paid', 'cancelled'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  const validSaleTypes = ['service', 'product', 'package', 'membership'] as const
  if (saleType && validSaleTypes.includes(saleType as typeof validSaleTypes[number])) {
    query = query.eq('sale_type', saleType as typeof validSaleTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/staff-commissions
 *
 * Manually create a staff commission record.
 */
export async function POST(request: NextRequest) {
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

  const { data: body, error: validationError } = await validateBody(request, createStaffCommissionSchema)
  if (validationError) return validationError

  // Verify staff belongs to store
  const { data: staffMember } = await supabase
    .from('staff')
    .select('id, name')
    .eq('id', body.staff_id)
    .eq('store_id', store.id)
    .single()

  if (!staffMember) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  // Verify appointment belongs to store if provided
  if (body.appointment_id) {
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', body.appointment_id)
      .eq('store_id', store.id)
      .single()

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
  }

  const { data: commission, error } = await supabase
    .from('staff_commissions')
    .insert({
      store_id: store.id,
      staff_id: body.staff_id,
      appointment_id: body.appointment_id || null,
      sale_type: body.sale_type || 'service',
      sale_amount: body.sale_amount,
      commission_rate: body.commission_rate,
      commission_amount: body.commission_amount,
      status: 'pending',
    })
    .select(`
      id, staff_id, appointment_id, sale_type, sale_amount, commission_rate,
      commission_amount, status, paid_at, notes, created_at, updated_at,
      staff(id, name),
      appointments(id, scheduled_at)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(commission, { status: 201 })
}
