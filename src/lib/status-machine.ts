/**
 * Shared status transition validation for all entity workflows.
 *
 * Each machine defines: { [currentStatus]: allowedNextStatuses[] }
 * Use `validateTransition()` in PATCH handlers to reject invalid state changes.
 */

export type TransitionMap = Record<string, string[]>

export interface TransitionResult {
  valid: boolean
  error?: string
}

/**
 * Validate that a status transition is allowed.
 */
export function validateTransition(
  machine: TransitionMap,
  currentStatus: string,
  nextStatus: string
): TransitionResult {
  if (currentStatus === nextStatus) {
    return { valid: true } // no-op, same status
  }

  const allowed = machine[currentStatus]
  if (!allowed || !allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${nextStatus}'`,
    }
  }

  return { valid: true }
}

// ── Reservation (hotel / guesthouse / camping) ──────────────────────
export const reservationTransitions: TransitionMap = {
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [], // terminal
  cancelled: [],   // terminal
  no_show: [],     // terminal
}

// ── Housekeeping tasks ──────────────────────────────────────────────
export const housekeepingTransitions: TransitionMap = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['completed', 'skipped'],
  completed: [],  // terminal
  skipped: [],    // terminal
}

// ── Maintenance requests ────────────────────────────────────────────
export const maintenanceTransitions: TransitionMap = {
  reported: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],  // terminal
  cancelled: [],  // terminal
}

// ── Repair orders ───────────────────────────────────────────────────
export const repairOrderTransitions: TransitionMap = {
  received: ['diagnosed', 'cancelled'],
  diagnosed: ['quoted', 'cancelled'],
  quoted: ['approved', 'cancelled'],
  approved: ['in_repair', 'cancelled'],
  in_repair: ['completed', 'cancelled'],
  completed: ['delivered'],
  delivered: [],   // terminal
  cancelled: [],   // terminal
}

// ── Laundry orders ──────────────────────────────────────────────────
export const laundryOrderTransitions: TransitionMap = {
  received: ['processing', 'cancelled'],
  processing: ['washing', 'cancelled'],
  washing: ['drying'],
  drying: ['ironing', 'ready'],
  ironing: ['ready'],
  ready: ['delivered'],
  delivered: [],   // terminal
  cancelled: [],   // terminal
}

// ── Legal cases ─────────────────────────────────────────────────────
export const legalCaseTransitions: TransitionMap = {
  open: ['in_progress', 'closed'],
  in_progress: ['pending_hearing', 'settled', 'closed'],
  pending_hearing: ['in_progress', 'settled', 'closed'],
  settled: ['closed', 'archived'],
  closed: ['archived'],
  archived: [],    // terminal
}

// ── Projects ────────────────────────────────────────────────────────
export const projectTransitions: TransitionMap = {
  planning: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
}

// ── Consultations ───────────────────────────────────────────────────
export const consultationTransitions: TransitionMap = {
  scheduled: ['in_progress', 'cancelled', 'no_show', 'rescheduled'],
  rescheduled: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],   // terminal
  cancelled: [],   // terminal
  no_show: [],     // terminal
}

// ── Photo sessions ──────────────────────────────────────────────────
export const photoSessionTransitions: TransitionMap = {
  scheduled: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],   // terminal
  cancelled: [],   // terminal
  no_show: [],     // terminal
}

// ── Class bookings ──────────────────────────────────────────────────
export const classBookingTransitions: TransitionMap = {
  booked: ['attended', 'cancelled', 'no_show'],
  attended: [],    // terminal
  cancelled: [],   // terminal
  no_show: [],     // terminal
}

// ── Desk bookings (coworking) ───────────────────────────────────────
export const deskBookingTransitions: TransitionMap = {
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  completed: [],   // terminal
  cancelled: [],   // terminal
  no_show: [],     // terminal
}

// ── Enrollments (education) ─────────────────────────────────────────
export const enrollmentTransitions: TransitionMap = {
  active: ['completed', 'withdrawn', 'suspended'],
  suspended: ['active', 'withdrawn'],
  completed: [],   // terminal
  withdrawn: [],   // terminal
}

// ── Purchase orders ─────────────────────────────────────────────────
export const purchaseOrderTransitions: TransitionMap = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['partially_received', 'received', 'cancelled'],
  partially_received: ['received'],
  received: [],    // terminal
  cancelled: [],   // terminal
}

// ── Treatment plans ─────────────────────────────────────────────────
export const treatmentPlanTransitions: TransitionMap = {
  draft: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
}

// ── Subscriptions ───────────────────────────────────────────────────
export const subscriptionTransitions: TransitionMap = {
  active: ['paused', 'cancelled', 'expired'],
  paused: ['active', 'cancelled'],
  cancelled: [],   // terminal
  expired: [],     // terminal
}

// ── Service requests ────────────────────────────────────────────────
export const serviceRequestTransitions: TransitionMap = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
}

// ── Lab orders ─────────────────────────────────────────────────────
export const labOrderTransitions: TransitionMap = {
  ordered: ['collected', 'cancelled'],
  collected: ['processing', 'cancelled'],
  processing: ['completed', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
}

// ── Admissions (inpatient) ─────────────────────────────────────────
export const admissionTransitions: TransitionMap = {
  admitted: ['discharged', 'transferred'],
  discharged: [],    // terminal
  transferred: [],   // terminal
}

// ── Medical complaints ─────────────────────────────────────────────
export const medicalComplaintTransitions: TransitionMap = {
  open: ['assigned', 'closed'],
  assigned: ['reviewed', 'closed'],
  reviewed: ['resolved', 'closed'],
  resolved: ['closed'],
  closed: [],   // terminal
}
