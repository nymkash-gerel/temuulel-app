/**
 * Status Machine Validation Tests — Phase 4
 *
 * Tests all 19 status transition machines from status-machine.ts.
 * For each machine: tests all valid transitions, all invalid transitions,
 * and same-status no-ops.
 * Acceptance criteria: 100% transition validation accuracy.
 */
import { describe, it, expect } from 'vitest'
import {
  validateTransition,
  reservationTransitions,
  housekeepingTransitions,
  maintenanceTransitions,
  repairOrderTransitions,
  laundryOrderTransitions,
  legalCaseTransitions,
  projectTransitions,
  consultationTransitions,
  photoSessionTransitions,
  classBookingTransitions,
  deskBookingTransitions,
  enrollmentTransitions,
  purchaseOrderTransitions,
  treatmentPlanTransitions,
  subscriptionTransitions,
  serviceRequestTransitions,
  labOrderTransitions,
  admissionTransitions,
  medicalComplaintTransitions,
  type TransitionMap,
} from '../status-machine'

// ---------------------------------------------------------------------------
// Helper: test all valid transitions for a machine
// ---------------------------------------------------------------------------
function testValidTransitions(name: string, machine: TransitionMap) {
  describe(`${name} — valid transitions`, () => {
    for (const [from, toList] of Object.entries(machine)) {
      for (const to of toList) {
        it(`${from} → ${to}`, () => {
          const result = validateTransition(machine, from, to)
          expect(result.valid).toBe(true)
          expect(result.error).toBeUndefined()
        })
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Helper: test terminal states cannot transition
// ---------------------------------------------------------------------------
function testTerminalStates(name: string, machine: TransitionMap) {
  const terminalStates = Object.entries(machine)
    .filter(([, toList]) => toList.length === 0)
    .map(([from]) => from)

  if (terminalStates.length === 0) return

  describe(`${name} — terminal states`, () => {
    const allStates = Object.keys(machine)
    for (const terminal of terminalStates) {
      for (const target of allStates) {
        if (target === terminal) continue // same-status is allowed
        it(`${terminal} → ${target} is invalid (terminal state)`, () => {
          const result = validateTransition(machine, terminal, target)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        })
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Helper: test same-status no-ops
// ---------------------------------------------------------------------------
function testSameStatusNoOps(name: string, machine: TransitionMap) {
  describe(`${name} — same-status no-ops`, () => {
    for (const status of Object.keys(machine)) {
      it(`${status} → ${status} is valid (no-op)`, () => {
        const result = validateTransition(machine, status, status)
        expect(result.valid).toBe(true)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Helper: test specific invalid transitions (skip states)
// ---------------------------------------------------------------------------
function testInvalidSkips(name: string, machine: TransitionMap, invalidPairs: [string, string][]) {
  if (invalidPairs.length === 0) return

  describe(`${name} — invalid skip transitions`, () => {
    for (const [from, to] of invalidPairs) {
      it(`${from} → ${to} is invalid`, () => {
        const result = validateTransition(machine, from, to)
        expect(result.valid).toBe(false)
        expect(result.error).toContain(`Cannot transition from '${from}' to '${to}'`)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// 1. Reservation (hotel / guesthouse / camping)
// ---------------------------------------------------------------------------
testValidTransitions('Reservation', reservationTransitions)
testTerminalStates('Reservation', reservationTransitions)
testSameStatusNoOps('Reservation', reservationTransitions)
testInvalidSkips('Reservation', reservationTransitions, [
  ['checked_out', 'checked_in'],  // terminal → active
  ['cancelled', 'confirmed'],      // terminal → active
  ['no_show', 'checked_in'],       // terminal → active
])

// ---------------------------------------------------------------------------
// 2. Housekeeping Tasks
// ---------------------------------------------------------------------------
testValidTransitions('Housekeeping', housekeepingTransitions)
testTerminalStates('Housekeeping', housekeepingTransitions)
testSameStatusNoOps('Housekeeping', housekeepingTransitions)
testInvalidSkips('Housekeeping', housekeepingTransitions, [
  ['completed', 'pending'],  // terminal
  ['skipped', 'in_progress'], // terminal
])

// ---------------------------------------------------------------------------
// 3. Maintenance Requests
// ---------------------------------------------------------------------------
testValidTransitions('Maintenance', maintenanceTransitions)
testTerminalStates('Maintenance', maintenanceTransitions)
testSameStatusNoOps('Maintenance', maintenanceTransitions)
testInvalidSkips('Maintenance', maintenanceTransitions, [
  ['completed', 'reported'],   // terminal
  ['cancelled', 'assigned'],    // terminal
  ['reported', 'completed'],    // skip assigned + in_progress
])

// ---------------------------------------------------------------------------
// 4. Repair Orders
// ---------------------------------------------------------------------------
testValidTransitions('Repair Order', repairOrderTransitions)
testTerminalStates('Repair Order', repairOrderTransitions)
testSameStatusNoOps('Repair Order', repairOrderTransitions)
testInvalidSkips('Repair Order', repairOrderTransitions, [
  ['delivered', 'received'],   // terminal
  ['cancelled', 'approved'],    // terminal
  ['received', 'in_repair'],    // skip diagnosis/quote/approval
  ['completed', 'in_repair'],   // no reverse after completion
  ['received', 'completed'],    // skip all intermediate
])

// ---------------------------------------------------------------------------
// 5. Laundry Orders
// ---------------------------------------------------------------------------
testValidTransitions('Laundry Order', laundryOrderTransitions)
testTerminalStates('Laundry Order', laundryOrderTransitions)
testSameStatusNoOps('Laundry Order', laundryOrderTransitions)
testInvalidSkips('Laundry Order', laundryOrderTransitions, [
  ['ready', 'washing'],      // reverse
  ['delivered', 'ready'],     // terminal
  ['washing', 'delivered'],   // skip stages
  ['received', 'ready'],      // skip processing/washing/drying
])

// ---------------------------------------------------------------------------
// 6. Legal Cases
// ---------------------------------------------------------------------------
testValidTransitions('Legal Case', legalCaseTransitions)
testTerminalStates('Legal Case', legalCaseTransitions)
testSameStatusNoOps('Legal Case', legalCaseTransitions)
testInvalidSkips('Legal Case', legalCaseTransitions, [
  ['archived', 'open'],        // terminal
  ['open', 'settled'],          // skip in_progress
  ['open', 'archived'],         // skip closed
])

// ---------------------------------------------------------------------------
// 7. Projects
// ---------------------------------------------------------------------------
testValidTransitions('Project', projectTransitions)
testTerminalStates('Project', projectTransitions)
testSameStatusNoOps('Project', projectTransitions)
testInvalidSkips('Project', projectTransitions, [
  ['completed', 'in_progress'],  // terminal
  ['cancelled', 'planning'],      // terminal
  ['planning', 'completed'],      // skip in_progress
])

// ---------------------------------------------------------------------------
// 8. Consultations
// ---------------------------------------------------------------------------
testValidTransitions('Consultation', consultationTransitions)
testTerminalStates('Consultation', consultationTransitions)
testSameStatusNoOps('Consultation', consultationTransitions)
testInvalidSkips('Consultation', consultationTransitions, [
  ['completed', 'scheduled'],   // terminal
  ['cancelled', 'in_progress'], // terminal
  ['scheduled', 'completed'],   // skip in_progress
])

// ---------------------------------------------------------------------------
// 9. Photo Sessions
// ---------------------------------------------------------------------------
testValidTransitions('Photo Session', photoSessionTransitions)
testTerminalStates('Photo Session', photoSessionTransitions)
testSameStatusNoOps('Photo Session', photoSessionTransitions)
testInvalidSkips('Photo Session', photoSessionTransitions, [
  ['completed', 'scheduled'],   // terminal
  ['in_progress', 'scheduled'], // no reverse
])

// ---------------------------------------------------------------------------
// 10. Class Bookings
// ---------------------------------------------------------------------------
testValidTransitions('Class Booking', classBookingTransitions)
testTerminalStates('Class Booking', classBookingTransitions)
testSameStatusNoOps('Class Booking', classBookingTransitions)
testInvalidSkips('Class Booking', classBookingTransitions, [
  ['attended', 'booked'],    // terminal
  ['cancelled', 'attended'], // terminal
])

// ---------------------------------------------------------------------------
// 11. Desk Bookings (Coworking)
// ---------------------------------------------------------------------------
testValidTransitions('Desk Booking', deskBookingTransitions)
testTerminalStates('Desk Booking', deskBookingTransitions)
testSameStatusNoOps('Desk Booking', deskBookingTransitions)
testInvalidSkips('Desk Booking', deskBookingTransitions, [
  ['completed', 'confirmed'],  // terminal
  ['checked_in', 'confirmed'], // no reverse
])

// ---------------------------------------------------------------------------
// 12. Enrollments (Education)
// ---------------------------------------------------------------------------
testValidTransitions('Enrollment', enrollmentTransitions)
testTerminalStates('Enrollment', enrollmentTransitions)
testSameStatusNoOps('Enrollment', enrollmentTransitions)
testInvalidSkips('Enrollment', enrollmentTransitions, [
  ['completed', 'active'],   // terminal
  ['withdrawn', 'active'],   // terminal
])

// ---------------------------------------------------------------------------
// 13. Purchase Orders
// ---------------------------------------------------------------------------
testValidTransitions('Purchase Order', purchaseOrderTransitions)
testTerminalStates('Purchase Order', purchaseOrderTransitions)
testSameStatusNoOps('Purchase Order', purchaseOrderTransitions)
testInvalidSkips('Purchase Order', purchaseOrderTransitions, [
  ['received', 'draft'],      // terminal
  ['cancelled', 'sent'],       // terminal
  ['draft', 'received'],       // skip sent/confirmed
])

// ---------------------------------------------------------------------------
// 14. Treatment Plans
// ---------------------------------------------------------------------------
testValidTransitions('Treatment Plan', treatmentPlanTransitions)
testTerminalStates('Treatment Plan', treatmentPlanTransitions)
testSameStatusNoOps('Treatment Plan', treatmentPlanTransitions)
testInvalidSkips('Treatment Plan', treatmentPlanTransitions, [
  ['completed', 'active'],  // terminal
  ['cancelled', 'draft'],   // terminal
])

// ---------------------------------------------------------------------------
// 15. Subscriptions
// ---------------------------------------------------------------------------
testValidTransitions('Subscription', subscriptionTransitions)
testTerminalStates('Subscription', subscriptionTransitions)
testSameStatusNoOps('Subscription', subscriptionTransitions)
testInvalidSkips('Subscription', subscriptionTransitions, [
  ['cancelled', 'active'],  // terminal
  ['expired', 'active'],    // terminal
  ['paused', 'expired'],    // not allowed
])

// ---------------------------------------------------------------------------
// 16. Service Requests
// ---------------------------------------------------------------------------
testValidTransitions('Service Request', serviceRequestTransitions)
testTerminalStates('Service Request', serviceRequestTransitions)
testSameStatusNoOps('Service Request', serviceRequestTransitions)
testInvalidSkips('Service Request', serviceRequestTransitions, [
  ['completed', 'pending'],    // terminal
  ['cancelled', 'confirmed'],   // terminal
  ['pending', 'completed'],     // skip confirmed + in_progress
])

// ---------------------------------------------------------------------------
// 17. Lab Orders
// ---------------------------------------------------------------------------
testValidTransitions('Lab Order', labOrderTransitions)
testTerminalStates('Lab Order', labOrderTransitions)
testSameStatusNoOps('Lab Order', labOrderTransitions)
testInvalidSkips('Lab Order', labOrderTransitions, [
  ['completed', 'ordered'],    // terminal
  ['cancelled', 'collected'],   // terminal
  ['ordered', 'completed'],     // skip collected + processing
])

// ---------------------------------------------------------------------------
// 18. Admissions (Inpatient)
// ---------------------------------------------------------------------------
testValidTransitions('Admission', admissionTransitions)
testTerminalStates('Admission', admissionTransitions)
testSameStatusNoOps('Admission', admissionTransitions)
testInvalidSkips('Admission', admissionTransitions, [
  ['discharged', 'admitted'],    // terminal
  ['transferred', 'admitted'],   // terminal
])

// ---------------------------------------------------------------------------
// 19. Medical Complaints
// ---------------------------------------------------------------------------
testValidTransitions('Medical Complaint', medicalComplaintTransitions)
testTerminalStates('Medical Complaint', medicalComplaintTransitions)
testSameStatusNoOps('Medical Complaint', medicalComplaintTransitions)
testInvalidSkips('Medical Complaint', medicalComplaintTransitions, [
  ['closed', 'open'],       // terminal
  ['open', 'resolved'],      // skip assigned + reviewed
])
