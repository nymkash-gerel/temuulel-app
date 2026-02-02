/**
 * Booking conflict detection for staff and resource availability.
 * Checks appointments, booking_items, and blocks for overlapping time ranges.
 */
import { SupabaseClient } from '@supabase/supabase-js'

interface ConflictCheckParams {
  storeId: string
  staffId?: string
  resourceId?: string
  startAt: string  // ISO timestamp
  endAt: string    // ISO timestamp
  excludeAppointmentId?: string  // Exclude current appointment when updating
}

interface ConflictResult {
  hasConflict: boolean
  conflicts: Array<{
    type: 'appointment' | 'block' | 'booking_item'
    id: string
    startAt: string
    endAt: string
    reason?: string
  }>
}

/**
 * Check if a staff member or resource has scheduling conflicts
 * in the given time range.
 */
export async function checkConflicts(
  supabase: SupabaseClient,
  params: ConflictCheckParams,
): Promise<ConflictResult> {
  const conflicts: ConflictResult['conflicts'] = []

  // Check staff conflicts
  if (params.staffId) {
    // Check appointments
    let appointmentQuery = supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes')
      .eq('store_id', params.storeId)
      .eq('staff_id', params.staffId)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('scheduled_at', params.endAt)

    if (params.excludeAppointmentId) {
      appointmentQuery = appointmentQuery.neq('id', params.excludeAppointmentId)
    }

    const { data: appointments } = await appointmentQuery

    if (appointments) {
      for (const apt of appointments) {
        const aptEnd = new Date(
          new Date(apt.scheduled_at).getTime() + (apt.duration_minutes || 60) * 60000,
        ).toISOString()

        if (apt.scheduled_at < params.endAt && aptEnd > params.startAt) {
          conflicts.push({
            type: 'appointment',
            id: apt.id,
            startAt: apt.scheduled_at,
            endAt: aptEnd,
          })
        }
      }
    }

    // Check blocks
    const { data: staffBlocks } = await supabase
      .from('blocks')
      .select('id, start_at, end_at, reason')
      .eq('store_id', params.storeId)
      .eq('staff_id', params.staffId)
      .lt('start_at', params.endAt)
      .gt('end_at', params.startAt)

    if (staffBlocks) {
      for (const block of staffBlocks) {
        conflicts.push({
          type: 'block',
          id: block.id,
          startAt: block.start_at,
          endAt: block.end_at,
          reason: block.reason || undefined,
        })
      }
    }

    // Check booking items
    let bookingItemQuery = supabase
      .from('booking_items')
      .select('id, start_at, end_at, appointment_id')
      .eq('store_id', params.storeId)
      .eq('staff_id', params.staffId)
      .not('status', 'eq', 'cancelled')
      .lt('start_at', params.endAt)
      .gt('end_at', params.startAt)

    if (params.excludeAppointmentId) {
      bookingItemQuery = bookingItemQuery.neq('appointment_id', params.excludeAppointmentId)
    }

    const { data: bookingItems } = await bookingItemQuery

    if (bookingItems) {
      for (const item of bookingItems) {
        conflicts.push({
          type: 'booking_item',
          id: item.id,
          startAt: item.start_at,
          endAt: item.end_at,
        })
      }
    }
  }

  // Check resource conflicts
  if (params.resourceId) {
    // Check appointments with this resource
    let resourceAptQuery = supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes')
      .eq('store_id', params.storeId)
      .eq('resource_id', params.resourceId)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('scheduled_at', params.endAt)

    if (params.excludeAppointmentId) {
      resourceAptQuery = resourceAptQuery.neq('id', params.excludeAppointmentId)
    }

    const { data: resourceApts } = await resourceAptQuery

    if (resourceApts) {
      for (const apt of resourceApts) {
        const aptEnd = new Date(
          new Date(apt.scheduled_at).getTime() + (apt.duration_minutes || 60) * 60000,
        ).toISOString()

        if (apt.scheduled_at < params.endAt && aptEnd > params.startAt) {
          conflicts.push({
            type: 'appointment',
            id: apt.id,
            startAt: apt.scheduled_at,
            endAt: aptEnd,
          })
        }
      }
    }

    // Check resource blocks
    const { data: resourceBlocks } = await supabase
      .from('blocks')
      .select('id, start_at, end_at, reason')
      .eq('store_id', params.storeId)
      .eq('resource_id', params.resourceId)
      .lt('start_at', params.endAt)
      .gt('end_at', params.startAt)

    if (resourceBlocks) {
      for (const block of resourceBlocks) {
        conflicts.push({
          type: 'block',
          id: block.id,
          startAt: block.start_at,
          endAt: block.end_at,
          reason: block.reason || undefined,
        })
      }
    }

    // Check booking items for resource
    let resourceItemQuery = supabase
      .from('booking_items')
      .select('id, start_at, end_at, appointment_id')
      .eq('store_id', params.storeId)
      .eq('resource_id', params.resourceId)
      .not('status', 'eq', 'cancelled')
      .lt('start_at', params.endAt)
      .gt('end_at', params.startAt)

    if (params.excludeAppointmentId) {
      resourceItemQuery = resourceItemQuery.neq('appointment_id', params.excludeAppointmentId)
    }

    const { data: resourceItems } = await resourceItemQuery

    if (resourceItems) {
      for (const item of resourceItems) {
        conflicts.push({
          type: 'booking_item',
          id: item.id,
          startAt: item.start_at,
          endAt: item.end_at,
        })
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
