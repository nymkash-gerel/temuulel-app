import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateAppointmentSchema } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'

/**
 * GET /api/appointments/:id — Get a single appointment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: appointment, error } = await supabase
    .from('appointments')
    .select('*, services(id, name), staff(id, name)')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

  return NextResponse.json({ appointment })
}

/**
 * PATCH /api/appointments/:id — Update an appointment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: updates, error: validationError } = await validateBody(request, updateAppointmentSchema)
  if (validationError) return validationError

  // Fetch the current appointment to detect status/staff changes
  const { data: existing } = await supabase
    .from('appointments')
    .select('status, staff_id, customer_name, service_id, scheduled_at, services(name), staff(name), bookable_resources(name)')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  const { data: appointment, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

  // Dispatch notifications for status/staff changes (non-blocking)
  if (existing) {
    const notifData = {
      appointment_id: id,
      customer_name: appointment.customer_name || '',
      service_name: (existing.services as { name: string } | null)?.name || '',
      staff_id: appointment.staff_id,
      staff_name: (existing.staff as { name: string } | null)?.name || '',
      scheduled_at: appointment.scheduled_at,
      resource_name: (existing.bookable_resources as { name: string } | null)?.name || '',
    }

    if (updates.status && updates.status !== existing.status) {
      if (updates.status === 'confirmed') {
        dispatchNotification(store.id, 'appointment_confirmed', notifData)
          .catch(err => console.error('Notification failed:', err))
      } else if (updates.status === 'cancelled') {
        dispatchNotification(store.id, 'appointment_cancelled', notifData)
          .catch(err => console.error('Notification failed:', err))
      }
    }

    if (updates.staff_id && updates.staff_id !== existing.staff_id) {
      dispatchNotification(store.id, 'appointment_assigned', {
        ...notifData,
        staff_id: updates.staff_id,
      }).catch(err => console.error('Notification failed:', err))
    }
  }

  return NextResponse.json({ appointment })
}

/**
 * DELETE /api/appointments/:id — Delete an appointment.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
