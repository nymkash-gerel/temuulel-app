import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createAppointmentSchema, parsePagination } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/appointments — List appointments for the user's store.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const staffId = searchParams.get('staff_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('appointments')
    .select('*, services(id, name), staff(id, name)', { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_at', { ascending: true })

  if (status) query = query.eq('status', status as 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show')
  if (staffId) query = query.eq('staff_id', staffId)
  if (dateFrom) query = query.gte('scheduled_at', dateFrom)
  if (dateTo) query = query.lte('scheduled_at', dateTo)

  const { data: appointments, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ appointments: appointments ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/appointments — Create a new appointment.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, createAppointmentSchema)
  if (validationError) return validationError

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id,
      staff_id: body.staff_id,
      service_id: body.service_id,
      variation_id: body.variation_id,
      resource_id: body.resource_id,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes,
      status: 'pending' as const,
      total_amount: body.total_amount,
      payment_status: 'pending' as const,
      payment_method: body.payment_method,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      notes: body.notes,
      source: body.source,
      check_in_date: body.check_in_date,
      check_out_date: body.check_out_date,
      party_size: body.party_size,
    })
    .select('*, services(name), staff(name), bookable_resources(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispatch appointment_created notification (non-blocking)
  dispatchNotification(store.id, 'appointment_created', {
    appointment_id: appointment.id,
    customer_name: appointment.customer_name || '',
    service_name: (appointment.services as { name: string } | null)?.name || '',
    staff_id: appointment.staff_id,
    staff_name: (appointment.staff as { name: string } | null)?.name || '',
    scheduled_at: appointment.scheduled_at,
    resource_name: (appointment.bookable_resources as { name: string } | null)?.name || '',
  }).catch(err => console.error('Notification dispatch failed:', err))

  return NextResponse.json({ appointment }, { status: 201 })
}
