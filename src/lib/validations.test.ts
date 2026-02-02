/**
 * Tests for Zod validation schemas in validations.ts.
 * Covers staff, services, appointments, comment-rules, and other schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  createStaffSchema,
  updateStaffSchema,
  createServiceSchema,
  updateServiceSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  createCommentRuleSchema,
  updateCommentRuleSchema,
  chatMessageSchema,
  chatWidgetSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createPaymentSchema,
  createCustomerSchema,
  updateCustomerSchema,
  teamInviteSchema,
  createFlowSchema,
  updateFlowSchema,
  markNotificationsSchema,
  productEnrichSchema,
  rateDriverSchema,
  calculateFeeSchema,
  generatePayoutSchema,
  driverChatMessageSchema,
  assignDriverToStoreSchema,
  deliveryTimeSlotsSchema,
  createDeliverySchema,
} from './validations'

// ---------------------------------------------------------------------------
// Staff schemas
// ---------------------------------------------------------------------------
describe('createStaffSchema', () => {
  it('validates a minimal valid staff member', () => {
    const result = createStaffSchema.safeParse({ name: 'Батбаяр' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Батбаяр')
      expect(result.data.status).toBe('active')
    }
  })

  it('validates a full staff member', () => {
    const result = createStaffSchema.safeParse({
      name: 'Батбаяр',
      phone: '+97699001122',
      email: 'bat@example.com',
      specialties: ['haircut', 'color'],
      working_hours: { mon: '09:00-18:00' },
      status: 'inactive',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createStaffSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createStaffSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = createStaffSchema.safeParse({ name: 'Test', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('transforms empty email to null', () => {
    const result = createStaffSchema.safeParse({ name: 'Test', email: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })

  it('rejects invalid status', () => {
    const result = createStaffSchema.safeParse({ name: 'Test', status: 'fired' })
    expect(result.success).toBe(false)
  })
})

describe('updateStaffSchema', () => {
  it('validates partial update', () => {
    const result = updateStaffSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('validates status update', () => {
    const result = updateStaffSchema.safeParse({ status: 'inactive' })
    expect(result.success).toBe(true)
  })

  it('rejects empty object (no valid fields)', () => {
    const result = updateStaffSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Services schemas
// ---------------------------------------------------------------------------
describe('createServiceSchema', () => {
  it('validates a minimal service', () => {
    const result = createServiceSchema.safeParse({ name: 'Haircut' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration_minutes).toBe(30)
      expect(result.data.base_price).toBe(0)
      expect(result.data.status).toBe('active')
    }
  })

  it('validates a full service', () => {
    const result = createServiceSchema.safeParse({
      name: 'Premium Haircut',
      description: 'Luxury haircut experience',
      category: 'hair',
      duration_minutes: 60,
      base_price: 50000,
      status: 'draft',
      ai_context: 'Premium service for loyal customers',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createServiceSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = createServiceSchema.safeParse({ name: 'Test', base_price: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects zero duration', () => {
    const result = createServiceSchema.safeParse({ name: 'Test', duration_minutes: 0 })
    expect(result.success).toBe(false)
  })
})

describe('updateServiceSchema', () => {
  it('validates partial update', () => {
    const result = updateServiceSchema.safeParse({ base_price: 30000 })
    expect(result.success).toBe(true)
  })

  it('validates status change to archived', () => {
    const result = updateServiceSchema.safeParse({ status: 'archived' })
    expect(result.success).toBe(true)
  })

  it('rejects empty object', () => {
    const result = updateServiceSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Appointments schemas
// ---------------------------------------------------------------------------
describe('createAppointmentSchema', () => {
  it('validates a minimal appointment', () => {
    const result = createAppointmentSchema.safeParse({
      scheduled_at: '2026-02-01T10:00:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.duration_minutes).toBe(30)
      expect(result.data.source).toBe('manual')
    }
  })

  it('validates a full appointment', () => {
    const result = createAppointmentSchema.safeParse({
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      staff_id: '550e8400-e29b-41d4-a716-446655440001',
      service_id: '550e8400-e29b-41d4-a716-446655440002',
      scheduled_at: '2026-02-01T10:00:00Z',
      duration_minutes: 60,
      total_amount: 50000,
      payment_method: 'qpay',
      customer_name: 'Батбаяр',
      customer_phone: '+97699001122',
      notes: 'First visit',
      source: 'chat',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing scheduled_at', () => {
    const result = createAppointmentSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty scheduled_at', () => {
    const result = createAppointmentSchema.safeParse({ scheduled_at: '' })
    expect(result.success).toBe(false)
  })

  it('rejects negative total_amount', () => {
    const result = createAppointmentSchema.safeParse({
      scheduled_at: '2026-02-01T10:00:00Z',
      total_amount: -1000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid source', () => {
    const result = createAppointmentSchema.safeParse({
      scheduled_at: '2026-02-01T10:00:00Z',
      source: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid payment_method', () => {
    const result = createAppointmentSchema.safeParse({
      scheduled_at: '2026-02-01T10:00:00Z',
      payment_method: 'bitcoin',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateAppointmentSchema', () => {
  it('validates status update', () => {
    const result = updateAppointmentSchema.safeParse({ status: 'confirmed' })
    expect(result.success).toBe(true)
  })

  it('validates payment status update', () => {
    const result = updateAppointmentSchema.safeParse({ payment_status: 'paid' })
    expect(result.success).toBe(true)
  })

  it('validates rescheduling', () => {
    const result = updateAppointmentSchema.safeParse({
      scheduled_at: '2026-02-02T14:00:00Z',
      duration_minutes: 45,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty object', () => {
    const result = updateAppointmentSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = updateAppointmentSchema.safeParse({ status: 'done' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Comment rules schemas
// ---------------------------------------------------------------------------
describe('createCommentRuleSchema', () => {
  it('validates a minimal rule', () => {
    const result = createCommentRuleSchema.safeParse({ name: 'Welcome rule' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enabled).toBe(true)
      expect(result.data.trigger_type).toBe('keyword')
      expect(result.data.match_mode).toBe('any')
      expect(result.data.reply_comment).toBe(true)
      expect(result.data.platforms).toEqual(['facebook', 'instagram'])
    }
  })

  it('validates a full rule', () => {
    const result = createCommentRuleSchema.safeParse({
      name: 'Promo reply',
      enabled: false,
      trigger_type: 'contains_question',
      keywords: ['үнэ', 'хэд вэ'],
      match_mode: 'all',
      reply_comment: true,
      reply_dm: true,
      comment_template: 'Баярлалаа! DM илгээлээ.',
      dm_template: 'Сайн байна уу! Үнийн мэдээллийг илгээлээ.',
      delay_seconds: 5,
      platforms: ['instagram'],
      use_ai: true,
      ai_context: 'Reply about pricing',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createCommentRuleSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid trigger_type', () => {
    const result = createCommentRuleSchema.safeParse({ name: 'Test', trigger_type: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('rejects negative delay', () => {
    const result = createCommentRuleSchema.safeParse({ name: 'Test', delay_seconds: -1 })
    expect(result.success).toBe(false)
  })
})

describe('updateCommentRuleSchema', () => {
  it('validates enabling/disabling', () => {
    const result = updateCommentRuleSchema.safeParse({ enabled: false })
    expect(result.success).toBe(true)
  })

  it('validates keyword update', () => {
    const result = updateCommentRuleSchema.safeParse({
      keywords: ['new', 'keywords'],
      match_mode: 'all',
    })
    expect(result.success).toBe(true)
  })

  it('validates AI toggle', () => {
    const result = updateCommentRuleSchema.safeParse({
      use_ai: true,
      ai_context: 'Respond about promotions',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Chat schemas
// ---------------------------------------------------------------------------
describe('chatMessageSchema', () => {
  it('validates a valid message', () => {
    const result = chatMessageSchema.safeParse({
      sender_id: 'user123',
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user',
      content: 'Hello!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty content', () => {
    const result = chatMessageSchema.safeParse({
      sender_id: 'user123',
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user',
      content: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects content over 2000 chars', () => {
    const result = chatMessageSchema.safeParse({
      sender_id: 'user123',
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user',
      content: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = chatMessageSchema.safeParse({
      sender_id: 'user123',
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'system',
      content: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid store_id UUID', () => {
    const result = chatMessageSchema.safeParse({
      sender_id: 'user123',
      store_id: 'not-a-uuid',
      role: 'user',
      content: 'Hello',
    })
    expect(result.success).toBe(false)
  })
})

describe('chatWidgetSchema', () => {
  it('validates a valid widget message', () => {
    const result = chatWidgetSchema.safeParse({
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      customer_message: 'Hi there!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty message', () => {
    const result = chatWidgetSchema.safeParse({
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      customer_message: '',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Orders schemas
// ---------------------------------------------------------------------------
describe('createOrderSchema', () => {
  it('validates a valid order', () => {
    const result = createOrderSchema.safeParse({
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ unit_price: 10000 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = createOrderSchema.safeParse({
      store_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('updateOrderStatusSchema', () => {
  it('validates a valid status update', () => {
    const result = updateOrderStatusSchema.safeParse({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'shipped',
      tracking_number: 'MN123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = updateOrderStatusSchema.safeParse({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'dispatched',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Payments schema
// ---------------------------------------------------------------------------
describe('createPaymentSchema', () => {
  it('validates qpay payment', () => {
    const result = createPaymentSchema.safeParse({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'qpay',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid payment method', () => {
    const result = createPaymentSchema.safeParse({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      payment_method: 'crypto',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Customers schemas
// ---------------------------------------------------------------------------
describe('createCustomerSchema', () => {
  it('validates a minimal customer', () => {
    const result = createCustomerSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.channel).toBe('manual')
  })

  it('validates a full customer', () => {
    const result = createCustomerSchema.safeParse({
      name: 'Батбаяр',
      phone: '+97699001122',
      email: 'bat@example.com',
      channel: 'messenger',
      address: 'UB, Mongolia',
      notes: 'VIP customer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = createCustomerSchema.safeParse({ email: 'bad-email' })
    expect(result.success).toBe(false)
  })

  it('transforms empty email to null', () => {
    const result = createCustomerSchema.safeParse({ email: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })
})

describe('updateCustomerSchema', () => {
  it('validates name update', () => {
    const result = updateCustomerSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('rejects empty object', () => {
    const result = updateCustomerSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Team schemas
// ---------------------------------------------------------------------------
describe('teamInviteSchema', () => {
  it('validates a valid invite', () => {
    const result = teamInviteSchema.safeParse({ email: 'team@example.com', role: 'staff' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role', () => {
    const result = teamInviteSchema.safeParse({ email: 'team@example.com', role: 'owner' })
    expect(result.success).toBe(false)
  })

  it('trims email whitespace', () => {
    const result = teamInviteSchema.safeParse({ email: ' team@example.com ', role: 'admin' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('team@example.com')
  })
})

// ---------------------------------------------------------------------------
// Flows schemas
// ---------------------------------------------------------------------------
describe('createFlowSchema', () => {
  it('validates a minimal flow', () => {
    const result = createFlowSchema.safeParse({ name: 'Order Flow' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.trigger_type).toBe('keyword')
      expect(result.data.nodes).toEqual([])
      expect(result.data.edges).toEqual([])
    }
  })

  it('rejects empty name', () => {
    const result = createFlowSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('updateFlowSchema', () => {
  it('validates status change', () => {
    const result = updateFlowSchema.safeParse({ status: 'active' })
    expect(result.success).toBe(true)
  })

  it('rejects empty object', () => {
    const result = updateFlowSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Notifications schema
// ---------------------------------------------------------------------------
describe('markNotificationsSchema', () => {
  it('validates mark_all', () => {
    const result = markNotificationsSchema.safeParse({ mark_all: true })
    expect(result.success).toBe(true)
  })

  it('validates ids array', () => {
    const result = markNotificationsSchema.safeParse({
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty object (neither ids nor mark_all)', () => {
    const result = markNotificationsSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Product enrichment schema
// ---------------------------------------------------------------------------
describe('productEnrichSchema', () => {
  it('validates with one product ID', () => {
    const result = productEnrichSchema.safeParse({
      product_ids: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty array', () => {
    const result = productEnrichSchema.safeParse({ product_ids: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 20 IDs', () => {
    const ids = Array.from({ length: 21 }, (_, i) =>
      `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`
    )
    const result = productEnrichSchema.safeParse({ product_ids: ids })
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUIDs', () => {
    const result = productEnrichSchema.safeParse({ product_ids: ['not-a-uuid'] })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Driver rating schemas
// ---------------------------------------------------------------------------
describe('rateDriverSchema', () => {
  it('validates a valid rating', () => {
    const result = rateDriverSchema.safeParse({ rating: 5 })
    expect(result.success).toBe(true)
  })

  it('validates rating with comment and name', () => {
    const result = rateDriverSchema.safeParse({
      rating: 4,
      comment: 'Маш сайн хүргэсэн',
      customer_name: 'Болд',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rating).toBe(4)
      expect(result.data.comment).toBe('Маш сайн хүргэсэн')
    }
  })

  it('rejects rating below 1', () => {
    const result = rateDriverSchema.safeParse({ rating: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects rating above 5', () => {
    const result = rateDriverSchema.safeParse({ rating: 6 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer rating', () => {
    const result = rateDriverSchema.safeParse({ rating: 3.5 })
    expect(result.success).toBe(false)
  })

  it('rejects missing rating', () => {
    const result = rateDriverSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Fee calculator schemas
// ---------------------------------------------------------------------------
describe('calculateFeeSchema', () => {
  it('validates a valid address', () => {
    const result = calculateFeeSchema.safeParse({ address: 'Сүхбаатар дүүрэг' })
    expect(result.success).toBe(true)
  })

  it('rejects address shorter than 3 chars', () => {
    const result = calculateFeeSchema.safeParse({ address: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects missing address', () => {
    const result = calculateFeeSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bulk payout generation schemas
// ---------------------------------------------------------------------------
describe('generatePayoutSchema', () => {
  it('validates valid date range', () => {
    const result = generatePayoutSchema.safeParse({
      period_start: '2025-01-01',
      period_end: '2025-01-31',
    })
    expect(result.success).toBe(true)
  })

  it('validates with optional driver_id', () => {
    const result = generatePayoutSchema.safeParse({
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      driver_id: 'd429c46f-bfc0-44be-ba51-4473f763ac5d',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid date format', () => {
    const result = generatePayoutSchema.safeParse({
      period_start: '01/01/2025',
      period_end: '01/31/2025',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid driver_id', () => {
    const result = generatePayoutSchema.safeParse({
      period_start: '2025-01-01',
      period_end: '2025-01-31',
      driver_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing period_start', () => {
    const result = generatePayoutSchema.safeParse({
      period_end: '2025-01-31',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Driver chat message schema
// ---------------------------------------------------------------------------
describe('driverChatMessageSchema', () => {
  it('validates a valid message', () => {
    const result = driverChatMessageSchema.safeParse({ message: 'Сайн байна уу' })
    expect(result.success).toBe(true)
  })

  it('rejects empty message', () => {
    const result = driverChatMessageSchema.safeParse({ message: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing message', () => {
    const result = driverChatMessageSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects message over 2000 chars', () => {
    const result = driverChatMessageSchema.safeParse({ message: 'x'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('accepts message at exactly 2000 chars', () => {
    const result = driverChatMessageSchema.safeParse({ message: 'x'.repeat(2000) })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Driver-store assignment schema
// ---------------------------------------------------------------------------
describe('assignDriverToStoreSchema', () => {
  it('validates with driver_id', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('validates with driver_phone', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_phone: '99001122',
    })
    expect(result.success).toBe(true)
  })

  it('validates with both driver_id and driver_phone', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_id: '550e8400-e29b-41d4-a716-446655440000',
      driver_phone: '99001122',
    })
    expect(result.success).toBe(true)
  })

  it('rejects when neither driver_id nor driver_phone provided', () => {
    const result = assignDriverToStoreSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid driver_id UUID', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects phone shorter than 8 chars', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_phone: '1234567',
    })
    expect(result.success).toBe(false)
  })

  it('rejects phone longer than 8 chars', () => {
    const result = assignDriverToStoreSchema.safeParse({
      driver_phone: '123456789',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Delivery time slots schema
// ---------------------------------------------------------------------------
describe('deliveryTimeSlotsSchema', () => {
  it('validates valid time slots', () => {
    const result = deliveryTimeSlotsSchema.safeParse({
      time_slots: ['09:00-11:00', '11:00-13:00', '13:00-15:00'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty time_slots array', () => {
    const result = deliveryTimeSlotsSchema.safeParse({ time_slots: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing time_slots', () => {
    const result = deliveryTimeSlotsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects empty string in time_slots', () => {
    const result = deliveryTimeSlotsSchema.safeParse({ time_slots: [''] })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Delivery scheduling fields in createDeliverySchema
// ---------------------------------------------------------------------------
describe('createDeliverySchema scheduling fields', () => {
  const baseDelivery = { delivery_address: '123 Main St' }

  it('validates delivery with scheduling fields', () => {
    const result = createDeliverySchema.safeParse({
      ...baseDelivery,
      scheduled_date: '2026-02-15',
      scheduled_time_slot: '09:00-11:00',
    })
    expect(result.success).toBe(true)
  })

  it('validates delivery without scheduling fields', () => {
    const result = createDeliverySchema.safeParse(baseDelivery)
    expect(result.success).toBe(true)
  })

  it('rejects invalid scheduled_date format', () => {
    const result = createDeliverySchema.safeParse({
      ...baseDelivery,
      scheduled_date: '02/15/2026',
    })
    expect(result.success).toBe(false)
  })

  it('accepts scheduled_date in YYYY-MM-DD format', () => {
    const result = createDeliverySchema.safeParse({
      ...baseDelivery,
      scheduled_date: '2026-12-31',
    })
    expect(result.success).toBe(true)
  })
})
