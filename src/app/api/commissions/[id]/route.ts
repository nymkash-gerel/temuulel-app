import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateStaffCommissionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/commissions/:id
 *
 * Get a single staff commission by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
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

  const { data: commission, error } = await supabase
    .from('staff_commissions')
    .select(`
      id, staff_id, appointment_id, sale_type, sale_amount, commission_rate,
      commission_amount, status, paid_at, notes, created_at, updated_at,
      staff(id, name),
      appointments(id, scheduled_at)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !commission) {
    return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
  }

  return NextResponse.json(commission)
}

/**
 * PATCH /api/commissions/:id
 *
 * Update a staff commission (status, rate, amount, notes).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { data: body, error: validationError } = await validateBody(request, updateStaffCommissionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.paid_at !== undefined) updateData.paid_at = body.paid_at || null

  // Auto-set paid_at when status transitions to paid
  if (body.status === 'paid' && !body.paid_at) {
    updateData.paid_at = new Date().toISOString()
  }

  const { data: commission, error } = await supabase
    .from('staff_commissions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!commission) {
    return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
  }

  return NextResponse.json(commission)
}
