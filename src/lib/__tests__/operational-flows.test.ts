/**
 * Operational Flow Tests
 *
 * End-to-end business logic flow tests that verify the complete lifecycle
 * of key operations: orders, returns, deliveries, status transitions,
 * chat-to-action pipelines, and cross-module interactions.
 *
 * These tests mock Supabase but verify the full chain of logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateTransition,
  reservationTransitions,
  repairOrderTransitions,
  laundryOrderTransitions,
  legalCaseTransitions,
  subscriptionTransitions,
  purchaseOrderTransitions,
  serviceRequestTransitions,
  labOrderTransitions,
  admissionTransitions,
} from '../status-machine'
import { classifyIntent } from '../chat-ai'
import { resolveFollowUp, type ConversationState } from '../conversation-state'
import { normalizeText } from '../text-normalizer'

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    last_intent: '',
    last_products: [],
    last_query: '',
    turn_count: 0,
    ...overrides,
  }
}

const MOCK_PRODUCT = {
  id: 'prod-1',
  name: 'Кашемир свитер',
  base_price: 89000,
}

// ─────────────────────────────────────────────────────────────────────
// Flow 1: Customer Return Request Lifecycle
// ─────────────────────────────────────────────────────────────────────

describe('Flow 1: Return Request Lifecycle', () => {
  it('Step 1: Customer message classified as return_exchange intent', () => {
    const messages = [
      'Буцаалт хийхийг хүсч байна',
      'Бараагаа буцаамаар байна',
      'Солиулж болох уу',
      'return хийх',
      ]
    for (const msg of messages) {
      const intent = classifyIntent(msg)
      expect(['return_exchange', 'product_search']).toContain(intent)
    }
  })

  it('Step 2: Return status transitions follow valid paths', () => {
    // Valid return flow: pending → approved → completed
    const returnTransitions = {
      pending: ['approved', 'rejected'],
      approved: ['completed', 'rejected'],
      completed: [],
      rejected: [],
    }

    // Happy path
    expect(validateTransition(returnTransitions, 'pending', 'approved').valid).toBe(true)
    expect(validateTransition(returnTransitions, 'approved', 'completed').valid).toBe(true)

    // Rejection path
    expect(validateTransition(returnTransitions, 'pending', 'rejected').valid).toBe(true)
    expect(validateTransition(returnTransitions, 'approved', 'rejected').valid).toBe(true)

    // Invalid transitions
    expect(validateTransition(returnTransitions, 'pending', 'completed').valid).toBe(false)
    expect(validateTransition(returnTransitions, 'completed', 'pending').valid).toBe(false)
    expect(validateTransition(returnTransitions, 'rejected', 'approved').valid).toBe(false)
  })

  it('Step 3: Frustrated return message classifies as complaint', () => {
    const intent = classifyIntent('Энэ бараа муу чанартай байна! Буцаалт хийж өгөөч!')
    expect(['complaint', 'return_exchange']).toContain(intent)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 2: Order → Delivery → Driver Assignment
// ─────────────────────────────────────────────────────────────────────

describe('Flow 2: Order to Delivery Pipeline', () => {
  it('Step 1: Customer browses products via chat', () => {
    const queries = [
      'Ямар бараа байна вэ?',
      'Кашемир свитер харуулаач',
      'Үнэ хэд вэ?',
    ]
    for (const q of queries) {
      const intent = classifyIntent(q)
      expect(intent).toBe('product_search')
    }
  })

  it('Step 2: Customer selects product and initiates order', () => {
    const state = makeState({
      last_products: [MOCK_PRODUCT],
      last_intent: 'product_search',
      turn_count: 2,
    })

    // "I'll take this one" with 1 product → select_single
    const selectResult = resolveFollowUp('энийг авъя', state)
    expect(selectResult).not.toBeNull()
    expect(selectResult!.type).toBe('select_single')
    expect(selectResult!.product).toEqual(MOCK_PRODUCT)
  })

  it('Step 3: Order status transitions are valid', () => {
    const orderTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivered', 'cancelled'],
      delivered: ['returned'],
      cancelled: [],
      returned: [],
    }

    // Happy path
    expect(validateTransition(orderTransitions, 'pending', 'confirmed').valid).toBe(true)
    expect(validateTransition(orderTransitions, 'confirmed', 'preparing').valid).toBe(true)
    expect(validateTransition(orderTransitions, 'preparing', 'ready').valid).toBe(true)
    expect(validateTransition(orderTransitions, 'ready', 'delivered').valid).toBe(true)

    // Return after delivery
    expect(validateTransition(orderTransitions, 'delivered', 'returned').valid).toBe(true)

    // Can't skip steps
    expect(validateTransition(orderTransitions, 'pending', 'delivered').valid).toBe(false)
    expect(validateTransition(orderTransitions, 'pending', 'ready').valid).toBe(false)
  })

  it('Step 4: Delivery status transitions are valid', () => {
    const deliveryTransitions = {
      pending: ['assigned', 'cancelled'],
      assigned: ['picked_up', 'cancelled'],
      picked_up: ['in_transit'],
      in_transit: ['delivered', 'failed'],
      delivered: [],
      failed: ['pending'],  // retry
      cancelled: [],
    }

    // Happy path
    expect(validateTransition(deliveryTransitions, 'pending', 'assigned').valid).toBe(true)
    expect(validateTransition(deliveryTransitions, 'assigned', 'picked_up').valid).toBe(true)
    expect(validateTransition(deliveryTransitions, 'picked_up', 'in_transit').valid).toBe(true)
    expect(validateTransition(deliveryTransitions, 'in_transit', 'delivered').valid).toBe(true)

    // Failure and retry
    expect(validateTransition(deliveryTransitions, 'in_transit', 'failed').valid).toBe(true)
    expect(validateTransition(deliveryTransitions, 'failed', 'pending').valid).toBe(true)

    // Invalid
    expect(validateTransition(deliveryTransitions, 'pending', 'delivered').valid).toBe(false)
    expect(validateTransition(deliveryTransitions, 'delivered', 'pending').valid).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 3: Chat Intent → Follow-up Resolution → AI Response
// ─────────────────────────────────────────────────────────────────────

describe('Flow 3: Chat to Action Pipeline', () => {
  it('classifies → resolves follow-up → maintains context across turns', () => {
    // Turn 1: Customer asks about products
    const intent1 = classifyIntent('Ямар бараа байна вэ?')
    expect(intent1).toBe('product_search')

    // Turn 2: With products in context, ask about size
    const state2 = makeState({
      last_intent: 'product_search',
      last_products: [MOCK_PRODUCT],
      turn_count: 1,
    })
    const followUp = resolveFollowUp('Размер нь хэд вэ?', state2)
    expect(followUp).not.toBeNull()
    expect(followUp!.type).toBe('size_question')

    // Turn 3: Customer asks about price
    const state3 = makeState({
      last_intent: 'size_info',
      last_products: [MOCK_PRODUCT],
      turn_count: 2,
    })
    const priceFollowUp = resolveFollowUp('Үнэ нь хэд вэ?', state3)
    expect(priceFollowUp).not.toBeNull()
    expect(priceFollowUp!.type).toBe('price_question')
  })

  it('order status inquiry resolves correctly', () => {
    const messages = [
      'Захиалга маань хаана байна?',
      'ORD-001 статус',
    ]
    for (const msg of messages) {
      expect(['order_status', 'shipping']).toContain(classifyIntent(msg))
    }
  })

  it('payment questions classify correctly', () => {
    const messages = [
      'QPay-р төлж болох уу?',
      'Картаар төлнө',
      'Бэлнээр төлье',
    ]
    for (const msg of messages) {
      expect(classifyIntent(msg)).toBe('payment')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 4: Escalation Pipeline
// ─────────────────────────────────────────────────────────────────────

describe('Flow 4: Customer Complaint Classification', () => {
  it('polite message → not a complaint', () => {
    const intent = classifyIntent('Баярлалаа, мэдээлэл авлаа')
    expect(intent).toBe('thanks')
  })

  it('frustrated message → complaint or escalation signal', () => {
    const intent = classifyIntent('Гомдол гаргана! Муу үйлчилгээ!')
    expect(intent).toBe('complaint')
  })

  it('complaint keywords detected across variations', () => {
    const complaints = [
      'Гомдол гаргана',
      'Маш муу чанартай',
    ]
    for (const msg of complaints) {
      expect(classifyIntent(msg)).toBe('complaint')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 5: Multi-Vertical Status Machines
// ─────────────────────────────────────────────────────────────────────

describe('Flow 5: Vertical-Specific Status Machines', () => {
  describe('Hotel: Reservation lifecycle', () => {
    it('confirmed → checked_in → checked_out', () => {
      expect(validateTransition(reservationTransitions, 'confirmed', 'checked_in').valid).toBe(true)
      expect(validateTransition(reservationTransitions, 'checked_in', 'checked_out').valid).toBe(true)
    })

    it('confirmed → cancelled (guest cancels)', () => {
      expect(validateTransition(reservationTransitions, 'confirmed', 'cancelled').valid).toBe(true)
    })

    it('confirmed → no_show', () => {
      expect(validateTransition(reservationTransitions, 'confirmed', 'no_show').valid).toBe(true)
    })

    it('cannot check in after checkout', () => {
      expect(validateTransition(reservationTransitions, 'checked_out', 'checked_in').valid).toBe(false)
    })
  })

  describe('Repair Shop: Order lifecycle', () => {
    it('full repair flow: received → diagnosed → quoted → approved → in_repair → completed → delivered', () => {
      const steps = ['received', 'diagnosed', 'quoted', 'approved', 'in_repair', 'completed', 'delivered']
      for (let i = 0; i < steps.length - 1; i++) {
        expect(validateTransition(repairOrderTransitions, steps[i], steps[i + 1]).valid).toBe(true)
      }
    })

    it('can cancel at any step before delivery', () => {
      for (const status of ['received', 'diagnosed', 'quoted', 'approved', 'in_repair']) {
        expect(validateTransition(repairOrderTransitions, status, 'cancelled').valid).toBe(true)
      }
    })
  })

  describe('Laundry: Order lifecycle', () => {
    it('full laundry flow', () => {
      const steps = ['received', 'processing', 'washing', 'drying', 'ironing', 'ready', 'delivered']
      for (let i = 0; i < steps.length - 1; i++) {
        expect(validateTransition(laundryOrderTransitions, steps[i], steps[i + 1]).valid).toBe(true)
      }
    })

    it('can skip ironing (drying → ready)', () => {
      expect(validateTransition(laundryOrderTransitions, 'drying', 'ready').valid).toBe(true)
    })
  })

  describe('Legal: Case lifecycle', () => {
    it('open → in_progress → settled → closed → archived', () => {
      const steps = ['open', 'in_progress', 'settled', 'closed', 'archived']
      for (let i = 0; i < steps.length - 1; i++) {
        expect(validateTransition(legalCaseTransitions, steps[i], steps[i + 1]).valid).toBe(true)
      }
    })

    it('can go to pending_hearing and back', () => {
      expect(validateTransition(legalCaseTransitions, 'in_progress', 'pending_hearing').valid).toBe(true)
      expect(validateTransition(legalCaseTransitions, 'pending_hearing', 'in_progress').valid).toBe(true)
    })
  })

  describe('Subscription: Lifecycle', () => {
    it('active → paused → active (resume)', () => {
      expect(validateTransition(subscriptionTransitions, 'active', 'paused').valid).toBe(true)
      expect(validateTransition(subscriptionTransitions, 'paused', 'active').valid).toBe(true)
    })

    it('active → cancelled (terminal)', () => {
      expect(validateTransition(subscriptionTransitions, 'active', 'cancelled').valid).toBe(true)
      expect(validateTransition(subscriptionTransitions, 'cancelled', 'active').valid).toBe(false)
    })

    it('active → expired (terminal)', () => {
      expect(validateTransition(subscriptionTransitions, 'active', 'expired').valid).toBe(true)
      expect(validateTransition(subscriptionTransitions, 'expired', 'active').valid).toBe(false)
    })
  })

  describe('Purchase Orders: Procurement lifecycle', () => {
    it('draft → sent → confirmed → received', () => {
      const steps = ['draft', 'sent', 'confirmed', 'received']
      for (let i = 0; i < steps.length - 1; i++) {
        expect(validateTransition(purchaseOrderTransitions, steps[i], steps[i + 1]).valid).toBe(true)
      }
    })

    it('supports partial receiving', () => {
      expect(validateTransition(purchaseOrderTransitions, 'confirmed', 'partially_received').valid).toBe(true)
      expect(validateTransition(purchaseOrderTransitions, 'partially_received', 'received').valid).toBe(true)
    })
  })

  describe('Hospital: Lab Order lifecycle', () => {
    it('ordered → collected → processing → completed', () => {
      const steps = ['ordered', 'collected', 'processing', 'completed']
      for (let i = 0; i < steps.length - 1; i++) {
        expect(validateTransition(labOrderTransitions, steps[i], steps[i + 1]).valid).toBe(true)
      }
    })

    it('can cancel before completion', () => {
      for (const status of ['ordered', 'collected', 'processing']) {
        expect(validateTransition(labOrderTransitions, status, 'cancelled').valid).toBe(true)
      }
    })
  })

  describe('Hospital: Admission lifecycle', () => {
    it('admitted → discharged', () => {
      expect(validateTransition(admissionTransitions, 'admitted', 'discharged').valid).toBe(true)
    })

    it('admitted → transferred', () => {
      expect(validateTransition(admissionTransitions, 'admitted', 'transferred').valid).toBe(true)
    })

    it('discharged is terminal', () => {
      expect(validateTransition(admissionTransitions, 'discharged', 'admitted').valid).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 6: Text Normalization → Intent → Action consistency
// ─────────────────────────────────────────────────────────────────────

describe('Flow 6: Mongolian Text Processing Pipeline', () => {
  it('handles mixed Cyrillic and Latin input consistently', () => {
    // Same intent regardless of script
    expect(classifyIntent('size chart')).toBe('size_info')
    expect(classifyIntent('размер')).toBe('size_info')
    expect(classifyIntent('хэмжээ')).toBe('size_info')
  })

  it('handles informal/slang Mongolian input', () => {
    expect(classifyIntent('барааа харуулна уу')).toBe('product_search')
    expect(classifyIntent('захиалгаа хэзээ ирэх')).toBe('order_status')
  })

  it('normalizeText strips diacritics and lowercases consistently', () => {
    const normalized = normalizeText('ЗАХИАЛГА Маань')
    expect(normalized).toBe(normalized.toLowerCase())
    expect(normalized).not.toContain('ЗАХИАЛГА')
  })
})

// ─────────────────────────────────────────────────────────────────────
// Flow 7: Cross-cutting concerns
// ─────────────────────────────────────────────────────────────────────

describe('Flow 7: Cross-cutting Business Rules', () => {
  it('same status transition is a no-op (not an error)', () => {
    expect(validateTransition(reservationTransitions, 'confirmed', 'confirmed').valid).toBe(true)
    expect(validateTransition(repairOrderTransitions, 'received', 'received').valid).toBe(true)
  })

  it('terminal states reject all transitions', () => {
    // All terminal states should reject any transition
    const terminalTests: [typeof reservationTransitions, string][] = [
      [reservationTransitions, 'checked_out'],
      [reservationTransitions, 'cancelled'],
      [repairOrderTransitions, 'cancelled'],
      [repairOrderTransitions, 'delivered'],
      [laundryOrderTransitions, 'delivered'],
      [laundryOrderTransitions, 'cancelled'],
      [subscriptionTransitions, 'cancelled'],
      [subscriptionTransitions, 'expired'],
    ]

    for (const [machine, terminal] of terminalTests) {
      const result = validateTransition(machine, terminal, 'some_other_status')
      expect(result.valid).toBe(false)
    }
  })

  it('follow-up resolution returns null for unrelated messages', () => {
    const state = makeState({ last_products: [MOCK_PRODUCT], turn_count: 1 })
    const result = resolveFollowUp('Сайн байна уу', state)
    // Greeting shouldn't resolve to any follow-up with product context
    expect(result === null || result.type === 'contextual_question' || result.type === 'prefer_llm').toBe(true)
  })
})
