import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, generateStaffCommissionsSchema } from '@/lib/validations'

/**
 * POST /api/staff-commissions/generate
 *
 * Auto-generate commission records from completed appointments
 * that don't already have commission records.
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

  const { data: body, error: validationError } = await validateBody(request, generateStaffCommissionsSchema)
  if (validationError) return validationError

  // Find completed appointments in the date range
  let appointmentQuery = supabase
    .from('appointments')
    .select('id, staff_id, total_amount, scheduled_at')
    .eq('store_id', store.id)
    .eq('status', 'completed')
    .gte('scheduled_at', body.date_from)
    .lte('scheduled_at', body.date_to)
    .not('total_amount', 'is', null)

  if (body.staff_id) {
    appointmentQuery = appointmentQuery.eq('staff_id', body.staff_id)
  }

  const { data: appointments, error: appointmentsError } = await appointmentQuery

  if (appointmentsError) {
    return NextResponse.json({ error: appointmentsError.message }, { status: 500 })
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ generated: 0, commissions: [] })
  }

  // Check which appointments already have commission records
  const appointmentIds = appointments.map(a => a.id)
  const { data: existingCommissions } = await supabase
    .from('staff_commissions')
    .select('appointment_id')
    .in('appointment_id', appointmentIds)

  const existingAppointmentIds = new Set(
    (existingCommissions || []).map(c => c.appointment_id)
  )

  // Filter to only appointments without existing commissions and with a staff member
  const eligibleAppointments = appointments.filter(
    a => !existingAppointmentIds.has(a.id) && a.staff_id
  )

  if (eligibleAppointments.length === 0) {
    return NextResponse.json({ generated: 0, commissions: [] })
  }

  // Calculate and build commission records
  const commissionRecords = eligibleAppointments.map(a => ({
    store_id: store.id,
    staff_id: a.staff_id!,
    appointment_id: a.id,
    sale_type: 'service',
    sale_amount: Number(a.total_amount),
    commission_rate: body.commission_rate,
    commission_amount: Number(a.total_amount) * body.commission_rate / 100,
    status: 'pending',
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('staff_commissions')
    .insert(commissionRecords)
    .select(`
      id, staff_id, appointment_id, sale_type, sale_amount, commission_rate,
      commission_amount, status, paid_at, notes, created_at, updated_at
    `)

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    generated: inserted?.length || 0,
    commissions: inserted,
  })
}
