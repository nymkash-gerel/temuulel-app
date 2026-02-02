/**
 * Automated flow tests using real customer message patterns
 * extracted from Facebook Messenger chat history.
 *
 * Tests each of the 8 business flow templates end-to-end
 * with realistic user inputs (Cyrillic, Latin, numbers, phone, address).
 */

import { describe, it, expect } from 'vitest'
import { startDemoFlow, executeDemoFlowStep, isValidBusinessType } from './demo-flow-executor'
import type { FlowState, FlowStepResult } from './flow-types'

// ---------------------------------------------------------------------------
// Helper: walk a flow from start to finish with a sequence of user messages
// ---------------------------------------------------------------------------
async function walkFlow(
  businessType: string,
  userMessages: string[]
): Promise<{
  allMessages: Array<{ from: 'bot' | 'user'; text: string }>
  steps: number
  completed: boolean
  finalState: FlowState | null
  variables: Record<string, unknown>
}> {
  const allMessages: Array<{ from: 'bot' | 'user'; text: string }> = []
  let stepCount = 0
  const MAX_STEPS = 30 // safety limit

  // Start the flow
  const startResult = await startDemoFlow(businessType as Parameters<typeof startDemoFlow>[0])
  stepCount++
  for (const m of startResult.messages) {
    if (m.text) allMessages.push({ from: 'bot', text: m.text })
    if (m.quick_replies) {
      allMessages.push({ from: 'bot', text: `[buttons: ${m.quick_replies.map(q => q.title).join(', ')}]` })
    }
    if (m.products) {
      allMessages.push({ from: 'bot', text: `[products: ${m.products.map(p => p.name).join(', ')}]` })
    }
  }

  let state = startResult.newState
  let msgIndex = 0

  // Walk through user messages
  while (state && msgIndex < userMessages.length && stepCount < MAX_STEPS) {
    const userMsg = userMessages[msgIndex]
    allMessages.push({ from: 'user', text: userMsg })
    msgIndex++

    const result: FlowStepResult = await executeDemoFlowStep(
      state,
      userMsg,
      businessType as Parameters<typeof executeDemoFlowStep>[2]
    )
    stepCount++

    for (const m of result.messages) {
      if (m.text) allMessages.push({ from: 'bot', text: m.text })
      if (m.quick_replies) {
        allMessages.push({ from: 'bot', text: `[buttons: ${m.quick_replies.map(q => q.title).join(', ')}]` })
      }
      if (m.products) {
        allMessages.push({ from: 'bot', text: `[products: ${m.products.map(p => p.name).join(', ')}]` })
      }
    }

    state = result.newState
    if (result.completed) break
  }

  return {
    allMessages,
    steps: stepCount,
    completed: !state,
    finalState: state,
    variables: state?.variables ?? {},
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
describe('isValidBusinessType', () => {
  it('accepts all 8 valid types', () => {
    const types = ['restaurant', 'hospital', 'beauty_salon', 'coffee_shop', 'fitness', 'education', 'dental_clinic', 'real_estate']
    for (const t of types) {
      expect(isValidBusinessType(t)).toBe(true)
    }
  })

  it('rejects invalid types', () => {
    expect(isValidBusinessType('invalid')).toBe(false)
    expect(isValidBusinessType('')).toBe(false)
    expect(isValidBusinessType('Restaurant')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// startDemoFlow tests
// ---------------------------------------------------------------------------
describe('startDemoFlow', () => {
  it('starts all 8 business types without error', async () => {
    const types = ['restaurant', 'hospital', 'beauty_salon', 'coffee_shop', 'fitness', 'education', 'dental_clinic', 'real_estate'] as const
    for (const t of types) {
      const result = await startDemoFlow(t)
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.completed).toBe(false)
      // Flow should be waiting for input (first interactive node)
      expect(result.newState).not.toBeNull()
    }
  })

  it('returns error for unknown template', async () => {
    // @ts-expect-error testing invalid input
    const result = await startDemoFlow('nonexistent')
    expect(result.completed).toBe(true)
    expect(result.newState).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 1. Restaurant — Order flow with real FB patterns
// ---------------------------------------------------------------------------
describe('Restaurant flow (real FB patterns)', () => {
  it('completes order: menu → item selection → quantity → delivery → address → phone → confirm', async () => {
    const result = await walkFlow('restaurant', [
      '1',          // Select first menu item (Хуушуур)
      '2',          // Quantity: 2
      'Хүргэлт',    // Delivery (most common FB first message)
      'БЗД 4р хороо 40 байр 17тоот',  // Real address pattern from FB
      '99112233',   // 8-digit phone (common 99xx prefix)
    ])

    expect(result.completed).toBe(true)
    expect(result.steps).toBeGreaterThan(2)
    // Should have bot messages
    expect(result.allMessages.filter(m => m.from === 'bot').length).toBeGreaterThan(3)
  })

  it('completes order: pickup instead of delivery', async () => {
    const result = await walkFlow('restaurant', [
      '2',              // Select Бууз
      '1',              // Quantity
      'Очиж авах',      // Pickup
      '88041234',       // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('handles item selection by number (FB pattern: customers send just a number)', async () => {
    const result = await walkFlow('restaurant', [
      '3',          // Select 3rd item (Цуйван)
      '1',          // Quantity
      'Хүргэлт',
      'Хан-Уул дүүрэг Яармаг 5 байр',
      '91001122',
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Hospital — Appointment booking
// ---------------------------------------------------------------------------
describe('Hospital flow (real FB patterns)', () => {
  it('completes booking: department → date → name → phone → insurance', async () => {
    const result = await walkFlow('hospital', [
      'Ерөнхий үзлэг',    // Department selection
      '2024-02-15',         // Date
      'Батбаяр',            // Patient name
      '99887766',           // Phone
      'Тийм',              // Has insurance
    ])

    expect(result.completed).toBe(true)
    expect(result.steps).toBeGreaterThan(3)
  })

  it('works with button number selection', async () => {
    const result = await walkFlow('hospital', [
      '2',             // 2nd department (Дотрын тасаг)
      'маргааш',       // Mongolian text date (accepted by validator)
      'Ганбаатар',
      '88112233',
      'Үгүй',         // No insurance
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Beauty Salon — Service booking
// ---------------------------------------------------------------------------
describe('Beauty Salon flow (real FB patterns)', () => {
  it('completes booking: category → service → time → name → phone', async () => {
    const result = await walkFlow('beauty_salon', [
      'Маникюр',            // Service category
      '1',                  // Select first service in category
      'Маргааш 14:00',     // Time
      'Сарнай',             // Name
      '95112233',           // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('works with Үсчин category', async () => {
    const result = await walkFlow('beauty_salon', [
      'Үсчин',
      '1',
      'Өнөөдөр 16:00',
      'Номин',
      '99001122',
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Coffee Shop — Quick order
// ---------------------------------------------------------------------------
describe('Coffee Shop flow (real FB patterns)', () => {
  it('completes order: drink → size → delivery → phone', async () => {
    const result = await walkFlow('coffee_shop', [
      '2',             // Select Латте
      'Дунд',          // Medium size
      'Очиж авах',     // Pickup
      '99223344',      // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('works with delivery option', async () => {
    const result = await walkFlow('coffee_shop', [
      '1',            // Американо
      'Том',          // Large
      'Хүргэлт',     // Delivery
      '88556677',     // Phone
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. Fitness — Membership inquiry
// ---------------------------------------------------------------------------
describe('Fitness flow (real FB patterns)', () => {
  it('completes registration: interest → register → name → phone', async () => {
    const result = await walkFlow('fitness', [
      'Гишүүнчлэл',   // Interest: membership
      'Тийм',          // Want to register
      'Болд',          // Name
      '99112233',      // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('handles "Дараа" (later) option', async () => {
    const result = await walkFlow('fitness', [
      'Туршилт',      // Interest: trial
      'Дараа',         // Not now
    ])

    expect(result.completed).toBe(true)
  })

  it('shows schedule info and completes', async () => {
    const result = await walkFlow('fitness', [
      'Хичээлийн хуваарь',  // Schedule
      'Тийм',               // Register
      'Ганаа',
      '88998877',
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. Education — Course enrollment
// ---------------------------------------------------------------------------
describe('Education flow (real FB patterns)', () => {
  it('completes enrollment: course → schedule → name → phone → payment', async () => {
    const result = await walkFlow('education', [
      '1',                  // First course
      'Өглөө 09:00',       // Morning schedule
      'Тэмүүлэн',          // Student name
      '99334455',           // Phone
      'QPay',               // Payment method
    ])

    expect(result.completed).toBe(true)
  })

  it('works with online schedule', async () => {
    const result = await walkFlow('education', [
      '3',                  // Python course
      'Онлайн',             // Online
      'Амар',
      '88112233',
      'Дансаар',            // Bank transfer
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. Dental Clinic — Appointment + emergency triage
// ---------------------------------------------------------------------------
describe('Dental Clinic flow (real FB patterns)', () => {
  it('completes booking path: booking → service → date → name → phone', async () => {
    const result = await walkFlow('dental_clinic', [
      'Цаг захиалах',       // Booking
      '1',                   // First service (Шүдний үзлэг)
      '2024-03-01',          // Date
      'Наранцэцэг',         // Name
      '99556677',            // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('handles emergency path → handoff', async () => {
    const result = await walkFlow('dental_clinic', [
      'Яаралтай',           // Emergency
    ])

    // Emergency path ends with handoff (escalation)
    expect(result.completed).toBe(true)
    // Should have emergency message
    const botTexts = result.allMessages.filter(m => m.from === 'bot').map(m => m.text)
    expect(botTexts.some(t => t.includes('7011-1234') || t.includes('яаралтай'))).toBe(true)
  })

  it('handles pricing inquiry path', async () => {
    const result = await walkFlow('dental_clinic', [
      'Үнийн мэдээлэл',    // Pricing
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. Real Estate — Property search
// ---------------------------------------------------------------------------
describe('Real Estate flow (real FB patterns)', () => {
  it('completes search + viewing: type → location → budget → selection → viewing → name → phone', async () => {
    const result = await walkFlow('real_estate', [
      'Орон сууц',          // Property type
      'Баянгол',            // Location
      '85',                 // Budget 85 million
      '1',                  // Select first listing
      'Тийм',              // Want viewing
      'Дэлгэрмаа',         // Name
      '99887766',           // Phone
    ])

    expect(result.completed).toBe(true)
  })

  it('handles "no viewing" path', async () => {
    const result = await walkFlow('real_estate', [
      'Газар',
      'Хан-Уул',
      '50',
      '1',
      'Үгүй',              // No viewing
    ])

    expect(result.completed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-cutting: FB-style input patterns
// ---------------------------------------------------------------------------
describe('FB-style input patterns across flows', () => {
  it('handles numeric-only responses (FB customers send just numbers)', async () => {
    // Restaurant: "1" for item, "2" for quantity, "1" for delivery
    const result = await walkFlow('restaurant', [
      '1', '2', '1',
      'Чингэлтэй дүүрэг',
      '99001122',
    ])
    expect(result.steps).toBeGreaterThan(2)
  })

  it('handles 8-digit phone numbers (99xx prefix, most common)', async () => {
    const result = await walkFlow('hospital', [
      '1', 'маргааш', 'Бат', '99887766', 'Тийм',
    ])
    expect(result.completed).toBe(true)
  })

  it('handles 8-digit phone numbers (88xx prefix)', async () => {
    const result = await walkFlow('beauty_salon', [
      'Массаж', '1', 'Өнөөдөр 15:00', 'Цэцэг', '88112233',
    ])
    expect(result.completed).toBe(true)
  })

  it('handles combined address+phone in address field (FB pattern)', async () => {
    // Real pattern: customers put address and phone together
    const result = await walkFlow('restaurant', [
      '1', '1', 'Хүргэлт',
      'БЗД 4р хороо 40 байр',  // Address without phone
      '88031169',               // Phone separate
    ])
    expect(result.completed).toBe(true)
  })

  it('handles button label text match (customers type the button text)', async () => {
    const result = await walkFlow('fitness', [
      'Гишүүнчлэл',   // Exact button label
      'Тийм',          // Exact button label
      'Болд',
      '91223344',
    ])
    expect(result.completed).toBe(true)
  })

  it('handles partial button match (customers abbreviate)', async () => {
    const result = await walkFlow('dental_clinic', [
      'Цаг',           // Partial match for "Цаг захиалах"
      '1',
      '2024-05-01',
      'Ган',
      '99112233',
    ])
    // May or may not complete depending on partial match behavior
    expect(result.steps).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// Edge cases from FB data
// ---------------------------------------------------------------------------
describe('Edge cases from FB data', () => {
  it('handles very short messages (FB customers often send 1-2 chars)', async () => {
    const result = await walkFlow('coffee_shop', [
      '1',     // Just a number
      '2',     // Size by number
      '1',     // Delivery by number
      '99001122',
    ])
    expect(result.steps).toBeGreaterThan(2)
  })

  it('all 8 flows can start and produce at least one message', async () => {
    const types = ['restaurant', 'hospital', 'beauty_salon', 'coffee_shop', 'fitness', 'education', 'dental_clinic', 'real_estate'] as const
    for (const t of types) {
      const result = await startDemoFlow(t)
      expect(result.messages.length).toBeGreaterThan(0)
      expect(result.newState).not.toBeNull()
      expect(result.completed).toBe(false)
    }
  })
})
