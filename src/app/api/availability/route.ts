import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkConflicts } from '@/lib/booking-conflict'

/**
 * GET /api/availability
 *
 * Check availability for a staff member or resource on a given date.
 * Query params: staff_id, resource_id, date (YYYY-MM-DD), duration_minutes (default 30)
 * Returns available time slots for the requested day.
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
  const staffId = searchParams.get('staff_id')
  const resourceId = searchParams.get('resource_id')
  const date = searchParams.get('date')
  const durationMinutes = parseInt(searchParams.get('duration_minutes') || '30') || 30
  const excludeAppointmentId = searchParams.get('exclude_appointment_id')

  if (!staffId && !resourceId) {
    return NextResponse.json({ error: 'staff_id or resource_id is required' }, { status: 400 })
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 })
  }

  // Get store hours for this day
  const dayOfWeek = new Date(date + 'T00:00:00').getDay()
  const { data: storeHours } = await supabase
    .from('store_hours')
    .select('open_time, close_time, is_closed')
    .eq('store_id', store.id)
    .eq('day_of_week', dayOfWeek)
    .single()

  // Default working hours: 09:00 - 18:00
  const openTime = storeHours?.open_time || '09:00'
  const closeTime = storeHours?.close_time || '18:00'
  const isClosed = storeHours?.is_closed || false

  if (isClosed) {
    return NextResponse.json({ slots: [], message: 'Store is closed on this day' })
  }

  // Check for store closure on this specific date
  const { data: closure } = await supabase
    .from('store_closures')
    .select('id')
    .eq('store_id', store.id)
    .eq('date', date)
    .maybeSingle()

  if (closure) {
    return NextResponse.json({ slots: [], message: 'Store is closed on this date' })
  }

  // Generate potential time slots
  const slots: Array<{ start: string; end: string; available: boolean }> = []
  const dayStart = new Date(`${date}T${openTime}:00`)
  const dayEnd = new Date(`${date}T${closeTime}:00`)
  const slotDuration = durationMinutes * 60000 // in ms
  const stepMinutes = 30 // 30-minute intervals
  const step = stepMinutes * 60000

  for (let slotStart = dayStart.getTime(); slotStart + slotDuration <= dayEnd.getTime(); slotStart += step) {
    const startAt = new Date(slotStart).toISOString()
    const endAt = new Date(slotStart + slotDuration).toISOString()

    const result = await checkConflicts(supabase, {
      storeId: store.id,
      staffId: staffId || undefined,
      resourceId: resourceId || undefined,
      startAt: startAt,
      endAt: endAt,
      excludeAppointmentId: excludeAppointmentId || undefined,
    })

    slots.push({
      start: startAt,
      end: endAt,
      available: !result.hasConflict,
    })
  }

  return NextResponse.json({
    date,
    staff_id: staffId,
    resource_id: resourceId,
    duration_minutes: durationMinutes,
    open_time: openTime,
    close_time: closeTime,
    slots,
  })
}
