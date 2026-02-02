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
} from './status-machine'

describe('validateTransition', () => {
  it('allows valid transitions', () => {
    const result = validateTransition(repairOrderTransitions, 'received', 'diagnosed')
    expect(result).toEqual({ valid: true })
  })

  it('rejects invalid transitions', () => {
    const result = validateTransition(repairOrderTransitions, 'received', 'delivered')
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Cannot transition from 'received' to 'delivered'")
  })

  it('allows same-status no-op', () => {
    const result = validateTransition(repairOrderTransitions, 'received', 'received')
    expect(result).toEqual({ valid: true })
  })

  it('rejects transitions from terminal states', () => {
    const result = validateTransition(repairOrderTransitions, 'cancelled', 'received')
    expect(result.valid).toBe(false)
  })

  it('rejects transitions from unknown states', () => {
    const result = validateTransition(repairOrderTransitions, 'nonexistent', 'received')
    expect(result.valid).toBe(false)
  })
})

describe('reservationTransitions', () => {
  it('allows confirmed → checked_in', () => {
    expect(validateTransition(reservationTransitions, 'confirmed', 'checked_in').valid).toBe(true)
  })

  it('allows confirmed → cancelled', () => {
    expect(validateTransition(reservationTransitions, 'confirmed', 'cancelled').valid).toBe(true)
  })

  it('allows confirmed → no_show', () => {
    expect(validateTransition(reservationTransitions, 'confirmed', 'no_show').valid).toBe(true)
  })

  it('allows checked_in → checked_out', () => {
    expect(validateTransition(reservationTransitions, 'checked_in', 'checked_out').valid).toBe(true)
  })

  it('rejects checked_out → checked_in (terminal)', () => {
    expect(validateTransition(reservationTransitions, 'checked_out', 'checked_in').valid).toBe(false)
  })

  it('rejects confirmed → checked_out (skip)', () => {
    expect(validateTransition(reservationTransitions, 'confirmed', 'checked_out').valid).toBe(false)
  })
})

describe('housekeepingTransitions', () => {
  it('allows pending → in_progress', () => {
    expect(validateTransition(housekeepingTransitions, 'pending', 'in_progress').valid).toBe(true)
  })

  it('allows pending → skipped', () => {
    expect(validateTransition(housekeepingTransitions, 'pending', 'skipped').valid).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(validateTransition(housekeepingTransitions, 'in_progress', 'completed').valid).toBe(true)
  })

  it('rejects completed → pending (terminal)', () => {
    expect(validateTransition(housekeepingTransitions, 'completed', 'pending').valid).toBe(false)
  })
})

describe('maintenanceTransitions', () => {
  it('allows reported → assigned', () => {
    expect(validateTransition(maintenanceTransitions, 'reported', 'assigned').valid).toBe(true)
  })

  it('allows assigned → in_progress', () => {
    expect(validateTransition(maintenanceTransitions, 'assigned', 'in_progress').valid).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(validateTransition(maintenanceTransitions, 'in_progress', 'completed').valid).toBe(true)
  })

  it('allows any non-terminal → cancelled', () => {
    expect(validateTransition(maintenanceTransitions, 'reported', 'cancelled').valid).toBe(true)
    expect(validateTransition(maintenanceTransitions, 'assigned', 'cancelled').valid).toBe(true)
    expect(validateTransition(maintenanceTransitions, 'in_progress', 'cancelled').valid).toBe(true)
  })

  it('rejects completed → in_progress (terminal)', () => {
    expect(validateTransition(maintenanceTransitions, 'completed', 'in_progress').valid).toBe(false)
  })
})

describe('repairOrderTransitions', () => {
  const fullPath = ['received', 'diagnosed', 'quoted', 'approved', 'in_repair', 'completed', 'delivered']

  it('allows the full happy-path chain', () => {
    for (let i = 0; i < fullPath.length - 1; i++) {
      const result = validateTransition(repairOrderTransitions, fullPath[i], fullPath[i + 1])
      expect(result.valid).toBe(true)
    }
  })

  it('allows cancellation from non-terminal states', () => {
    const cancellable = ['received', 'diagnosed', 'quoted', 'approved', 'in_repair']
    for (const status of cancellable) {
      expect(validateTransition(repairOrderTransitions, status, 'cancelled').valid).toBe(true)
    }
  })

  it('rejects skipping steps', () => {
    expect(validateTransition(repairOrderTransitions, 'received', 'approved').valid).toBe(false)
    expect(validateTransition(repairOrderTransitions, 'diagnosed', 'in_repair').valid).toBe(false)
  })
})

describe('laundryOrderTransitions', () => {
  it('allows the standard processing chain', () => {
    const chain = ['received', 'processing', 'washing', 'drying', 'ironing', 'ready', 'delivered']
    for (let i = 0; i < chain.length - 1; i++) {
      expect(validateTransition(laundryOrderTransitions, chain[i], chain[i + 1]).valid).toBe(true)
    }
  })

  it('allows drying → ready (skip ironing)', () => {
    expect(validateTransition(laundryOrderTransitions, 'drying', 'ready').valid).toBe(true)
  })

  it('allows early cancellation', () => {
    expect(validateTransition(laundryOrderTransitions, 'received', 'cancelled').valid).toBe(true)
    expect(validateTransition(laundryOrderTransitions, 'processing', 'cancelled').valid).toBe(true)
  })

  it('rejects cancellation after washing starts', () => {
    expect(validateTransition(laundryOrderTransitions, 'washing', 'cancelled').valid).toBe(false)
  })
})

describe('legalCaseTransitions', () => {
  it('allows open → in_progress', () => {
    expect(validateTransition(legalCaseTransitions, 'open', 'in_progress').valid).toBe(true)
  })

  it('allows in_progress → pending_hearing', () => {
    expect(validateTransition(legalCaseTransitions, 'in_progress', 'pending_hearing').valid).toBe(true)
  })

  it('allows pending_hearing → settled', () => {
    expect(validateTransition(legalCaseTransitions, 'pending_hearing', 'settled').valid).toBe(true)
  })

  it('allows closed → archived', () => {
    expect(validateTransition(legalCaseTransitions, 'closed', 'archived').valid).toBe(true)
  })

  it('rejects archived → open (terminal)', () => {
    expect(validateTransition(legalCaseTransitions, 'archived', 'open').valid).toBe(false)
  })
})

describe('projectTransitions', () => {
  it('allows planning → in_progress', () => {
    expect(validateTransition(projectTransitions, 'planning', 'in_progress').valid).toBe(true)
  })

  it('allows in_progress → on_hold', () => {
    expect(validateTransition(projectTransitions, 'in_progress', 'on_hold').valid).toBe(true)
  })

  it('allows on_hold → in_progress (resume)', () => {
    expect(validateTransition(projectTransitions, 'on_hold', 'in_progress').valid).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(validateTransition(projectTransitions, 'in_progress', 'completed').valid).toBe(true)
  })

  it('rejects completed → in_progress (terminal)', () => {
    expect(validateTransition(projectTransitions, 'completed', 'in_progress').valid).toBe(false)
  })
})

describe('consultationTransitions', () => {
  it('allows scheduled → in_progress', () => {
    expect(validateTransition(consultationTransitions, 'scheduled', 'in_progress').valid).toBe(true)
  })

  it('allows scheduled → rescheduled', () => {
    expect(validateTransition(consultationTransitions, 'scheduled', 'rescheduled').valid).toBe(true)
  })

  it('allows rescheduled → in_progress', () => {
    expect(validateTransition(consultationTransitions, 'rescheduled', 'in_progress').valid).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(validateTransition(consultationTransitions, 'in_progress', 'completed').valid).toBe(true)
  })

  it('rejects completed → scheduled (terminal)', () => {
    expect(validateTransition(consultationTransitions, 'completed', 'scheduled').valid).toBe(false)
  })
})

describe('photoSessionTransitions', () => {
  it('allows scheduled → in_progress', () => {
    expect(validateTransition(photoSessionTransitions, 'scheduled', 'in_progress').valid).toBe(true)
  })

  it('allows scheduled → no_show', () => {
    expect(validateTransition(photoSessionTransitions, 'scheduled', 'no_show').valid).toBe(true)
  })

  it('allows in_progress → completed', () => {
    expect(validateTransition(photoSessionTransitions, 'in_progress', 'completed').valid).toBe(true)
  })

  it('rejects no_show → scheduled (terminal)', () => {
    expect(validateTransition(photoSessionTransitions, 'no_show', 'scheduled').valid).toBe(false)
  })
})

describe('classBookingTransitions', () => {
  it('allows booked → attended', () => {
    expect(validateTransition(classBookingTransitions, 'booked', 'attended').valid).toBe(true)
  })

  it('allows booked → cancelled', () => {
    expect(validateTransition(classBookingTransitions, 'booked', 'cancelled').valid).toBe(true)
  })

  it('allows booked → no_show', () => {
    expect(validateTransition(classBookingTransitions, 'booked', 'no_show').valid).toBe(true)
  })

  it('rejects attended → booked (terminal)', () => {
    expect(validateTransition(classBookingTransitions, 'attended', 'booked').valid).toBe(false)
  })
})

describe('deskBookingTransitions', () => {
  it('allows confirmed → checked_in', () => {
    expect(validateTransition(deskBookingTransitions, 'confirmed', 'checked_in').valid).toBe(true)
  })

  it('allows checked_in → completed', () => {
    expect(validateTransition(deskBookingTransitions, 'checked_in', 'completed').valid).toBe(true)
  })

  it('allows confirmed → cancelled', () => {
    expect(validateTransition(deskBookingTransitions, 'confirmed', 'cancelled').valid).toBe(true)
  })

  it('rejects completed → confirmed (terminal)', () => {
    expect(validateTransition(deskBookingTransitions, 'completed', 'confirmed').valid).toBe(false)
  })
})

describe('enrollmentTransitions', () => {
  it('allows active → completed', () => {
    expect(validateTransition(enrollmentTransitions, 'active', 'completed').valid).toBe(true)
  })

  it('allows active → withdrawn', () => {
    expect(validateTransition(enrollmentTransitions, 'active', 'withdrawn').valid).toBe(true)
  })

  it('allows active → suspended', () => {
    expect(validateTransition(enrollmentTransitions, 'active', 'suspended').valid).toBe(true)
  })

  it('allows suspended → active (reinstate)', () => {
    expect(validateTransition(enrollmentTransitions, 'suspended', 'active').valid).toBe(true)
  })

  it('rejects completed → active (terminal)', () => {
    expect(validateTransition(enrollmentTransitions, 'completed', 'active').valid).toBe(false)
  })
})
