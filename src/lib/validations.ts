import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Centralized Zod validation schemas for all API endpoints.
 * Used by route handlers to validate request bodies.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse and validate a request body against a Zod schema.
 * Returns { data } on success or { error: NextResponse } on failure.
 */
export async function validateBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    return { error: NextResponse.json({ error: issues }, { status: 400 }) }
  }

  return { data: result.data }
}

// ---------------------------------------------------------------------------
// Common primitives
// ---------------------------------------------------------------------------

const uuid = z.string().uuid()
const trimmedString = z.string().trim().min(1, 'Cannot be empty')
const optionalString = z.string().nullish()
const optionalNumber = z.number().nullish()

// ---------------------------------------------------------------------------
// Chat schemas
// ---------------------------------------------------------------------------

export const chatMessageSchema = z.object({
  sender_id: trimmedString,
  store_id: uuid,
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const chatWidgetSchema = z.object({
  store_id: uuid,
  customer_message: z.string().min(1, 'Message cannot be empty').max(2000),
  sender_id: z.string().optional(),
  conversation_id: z.string().optional(),
})

export const chatAiSchema = z.object({
  conversation_id: z.string().optional(),
  customer_message: z.string().min(1).max(2000),
  store_id: z.string().optional(),
  is_comment: z.boolean().optional(),
  context: z.string().optional(),
  product_id: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Orders schemas
// ---------------------------------------------------------------------------

const orderItemSchema = z.object({
  product_id: z.string().nullish(),
  variant_id: z.string().nullish(),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().min(0),
  variant_label: z.string().nullish(),
})

export const createOrderSchema = z.object({
  store_id: uuid,
  customer_id: z.string().nullish(),
  items: z.array(orderItemSchema).min(1, 'At least one item required'),
  shipping_zone: z.string().optional(),
  shipping_address: z.string().nullish(),
  notes: z.string().nullish(),
})

export const updateOrderStatusSchema = z.object({
  order_id: uuid,
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  tracking_number: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Payments schemas
// ---------------------------------------------------------------------------

export const createPaymentSchema = z.object({
  order_id: uuid,
  payment_method: z.enum(['qpay', 'bank', 'cash']),
})

export const checkPaymentSchema = z.object({
  order_id: uuid,
})

export const updatePaymentStatusSchema = z.object({
  order_id: uuid,
  payment_status: z.enum(['paid', 'pending', 'refunded']),
})

// ---------------------------------------------------------------------------
// Customers schemas
// ---------------------------------------------------------------------------

export const createCustomerSchema = z.object({
  name: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  channel: z.string().default('manual'),
  address: z.string().nullish(),
  notes: z.string().nullish(),
})

export const updateCustomerSchema = z.object({
  name: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  channel: z.string().optional(),
  address: z.string().nullish(),
  notes: z.string().nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Staff schemas
// ---------------------------------------------------------------------------

export const createStaffSchema = z.object({
  name: trimmedString,
  phone: optionalString,
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  specialties: z.array(z.string()).nullish(),
  working_hours: z.any().default({}),
  telegram_chat_id: optionalString,
  messenger_psid: optionalString,
  status: z.enum(['active', 'inactive']).default('active'),
})

export const updateStaffSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: optionalString,
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  avatar_url: optionalString,
  specialties: z.array(z.string()).nullish(),
  working_hours: z.any().optional(),
  telegram_chat_id: optionalString,
  messenger_psid: optionalString,
  status: z.enum(['active', 'inactive']).optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Services schemas
// ---------------------------------------------------------------------------

export const createServiceSchema = z.object({
  name: trimmedString,
  description: optionalString,
  category: optionalString,
  duration_minutes: z.number().int().min(1).default(30),
  base_price: z.number().min(0).default(0),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  ai_context: optionalString,
})

export const updateServiceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalString,
  category: optionalString,
  duration_minutes: z.number().int().min(1).optional(),
  base_price: z.number().min(0).optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  ai_context: optionalString,
  images: z.any().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Appointments schemas
// ---------------------------------------------------------------------------

export const createAppointmentSchema = z.object({
  customer_id: z.string().nullish(),
  staff_id: z.string().nullish(),
  service_id: z.string().nullish(),
  variation_id: z.string().nullish(),
  resource_id: z.string().nullish(),
  scheduled_at: z.string().min(1, 'scheduled_at is required'),
  duration_minutes: z.number().int().min(1).default(30),
  total_amount: z.number().min(0).default(0),
  payment_method: z.enum(['qpay', 'bank', 'cash', 'card']).nullish(),
  customer_name: optionalString,
  customer_phone: optionalString,
  notes: optionalString,
  source: z.enum(['manual', 'chat', 'messenger', 'instagram', 'website']).default('manual'),
  check_in_date: optionalString,
  check_out_date: optionalString,
  party_size: optionalNumber,
})

export const updateAppointmentSchema = z.object({
  staff_id: z.string().nullish(),
  service_id: z.string().nullish(),
  variation_id: z.string().nullish(),
  resource_id: z.string().nullish(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(1).optional(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  total_amount: z.number().min(0).optional(),
  payment_status: z.enum(['paid', 'pending', 'refunded', 'partial']).optional(),
  payment_method: z.enum(['qpay', 'bank', 'cash', 'card']).nullish(),
  customer_name: optionalString,
  customer_phone: optionalString,
  notes: optionalString,
  internal_notes: optionalString,
  check_in_date: optionalString,
  check_out_date: optionalString,
  party_size: optionalNumber,
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Bookable Resources schemas
// ---------------------------------------------------------------------------

export const createBookableResourceSchema = z.object({
  type: z.enum(['table', 'room', 'tent_site', 'rv_site', 'ger', 'cabin']),
  name: trimmedString,
  description: optionalString,
  capacity: z.number().int().min(1).default(2),
  price_per_unit: z.number().min(0).default(0),
  features: z.record(z.string(), z.unknown()).default({}),
  images: z.array(z.string()).default([]),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).default('available'),
  sort_order: z.number().int().default(0),
})

export const updateBookableResourceSchema = z.object({
  type: z.enum(['table', 'room', 'tent_site', 'rv_site', 'ger', 'cabin']).optional(),
  name: z.string().trim().min(1).optional(),
  description: optionalString,
  capacity: z.number().int().min(1).optional(),
  price_per_unit: z.number().min(0).optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'reserved']).optional(),
  sort_order: z.number().int().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Flows schemas
// ---------------------------------------------------------------------------

export const createFlowSchema = z.object({
  name: trimmedString,
  description: optionalString,
  trigger_type: z.enum(['keyword', 'new_conversation', 'button_click', 'intent_match']).default('keyword'),
  trigger_config: z.record(z.string(), z.unknown()).default({}),
  nodes: z.array(z.record(z.string(), z.unknown())).default([]),
  edges: z.array(z.record(z.string(), z.unknown())).default([]),
})

export const updateFlowSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalString,
  status: z.enum(['draft', 'active', 'archived']).optional(),
  trigger_type: z.enum(['keyword', 'new_conversation', 'button_click', 'intent_match']).optional(),
  trigger_config: z.record(z.string(), z.unknown()).optional(),
  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
  edges: z.array(z.record(z.string(), z.unknown())).optional(),
  viewport: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Comment rules schemas
// ---------------------------------------------------------------------------

export const createCommentRuleSchema = z.object({
  name: trimmedString,
  enabled: z.boolean().default(true),
  trigger_type: z.enum(['keyword', 'any', 'first_comment', 'contains_question']).default('keyword'),
  keywords: z.array(z.string()).default([]),
  match_mode: z.enum(['any', 'all']).default('any'),
  reply_comment: z.boolean().default(true),
  reply_dm: z.boolean().default(false),
  comment_template: z.string().default(''),
  dm_template: z.string().default(''),
  delay_seconds: z.number().int().min(0).default(0),
  platforms: z.array(z.string()).default(['facebook', 'instagram']),
  use_ai: z.boolean().default(false),
  ai_context: z.string().default(''),
})

export const updateCommentRuleSchema = z.object({
  name: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  trigger_type: z.enum(['keyword', 'any', 'first_comment', 'contains_question']).optional(),
  keywords: z.array(z.string()).nullish(),
  match_mode: z.enum(['any', 'all']).optional(),
  reply_comment: z.boolean().optional(),
  reply_dm: z.boolean().optional(),
  comment_template: z.string().nullish(),
  dm_template: z.string().nullish(),
  delay_seconds: z.number().int().min(0).optional(),
  platforms: z.array(z.string()).optional(),
  use_ai: z.boolean().optional(),
  ai_context: z.string().nullish(),
})

// ---------------------------------------------------------------------------
// Notifications schemas
// ---------------------------------------------------------------------------

export const markNotificationsSchema = z.object({
  ids: z.array(uuid).optional(),
  mark_all: z.boolean().optional(),
}).refine(obj => obj.ids || obj.mark_all, {
  message: 'Either ids array or mark_all must be provided',
})

// ---------------------------------------------------------------------------
// Team schemas
// ---------------------------------------------------------------------------

export const teamInviteSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  role: z.enum(['admin', 'staff']),
})

export const teamRemoveSchema = z.object({
  user_id: uuid,
})

// ---------------------------------------------------------------------------
// Push subscription schemas
// ---------------------------------------------------------------------------

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

// ---------------------------------------------------------------------------
// Analytics schemas
// ---------------------------------------------------------------------------

export const analyticsInsightsSchema = z.object({
  period: z.string().min(1),
  revenue: z.number(),
  orderCount: z.number(),
  revenueChange: z.number().default(0),
  avgOrderValue: z.number().default(0),
  newCustomers: z.number().default(0),
  totalCustomers: z.number().default(0),
  topProducts: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    revenue: z.number(),
  })).default([]),
  aiResponseRate: z.number().default(0),
  totalMessages: z.number().default(0),
  pendingOrders: z.number().default(0),
  cancelledOrders: z.number().default(0),
})

// ---------------------------------------------------------------------------
// Product enrichment schemas
// ---------------------------------------------------------------------------

export const productEnrichSchema = z.object({
  product_ids: z.array(uuid).min(1, 'At least one product_id required').max(20),
})

// ---------------------------------------------------------------------------
// Templates schemas
// ---------------------------------------------------------------------------

export const applyTemplateSchema = z.object({
  template_id: z.string().min(1, 'template_id required'),
})

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

interface PaginationOptions {
  defaultLimit?: number
  maxLimit?: number
}

interface PaginationResult {
  limit: number
  offset: number
}

/**
 * Parse and clamp pagination params from URL search params.
 * Provides consistent defaults: limit=20, max=100 (overridable).
 */
export function parsePagination(
  searchParams: URLSearchParams,
  options?: PaginationOptions
): PaginationResult {
  const defaultLimit = options?.defaultLimit ?? 20
  const maxLimit = options?.maxLimit ?? 100
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || String(defaultLimit)) || defaultLimit, 1), maxLimit)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)
  return { limit, offset }
}

// --- Return schemas ---

export const createReturnSchema = z.object({
  order_id: z.string().uuid(),
  return_type: z.enum(['full', 'partial']),
  reason: z.string().max(2000).optional(),
  refund_amount: z.number().min(0).optional(),
  refund_method: z.enum(['qpay', 'bank', 'cash', 'original']).optional(),
  admin_notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    order_item_id: z.string().uuid(),
    product_id: z.string().uuid().optional().nullable(),
    variant_id: z.string().uuid().optional().nullable(),
    quantity: z.number().int().min(1),
    unit_price: z.number().min(0),
    reason: z.string().max(1000).optional(),
  })).optional(),
})

export const updateReturnSchema = z.object({
  status: z.enum(['approved', 'rejected', 'completed']),
  handled_by: z.string().max(200).optional(),
  refund_amount: z.number().min(0).optional(),
  refund_method: z.enum(['qpay', 'bank', 'cash', 'original']).optional(),
  admin_notes: z.string().max(2000).optional(),
})

// --- Compensation policy schemas ---

export const upsertCompensationPolicySchema = z.object({
  complaint_category: z.enum([
    'food_quality', 'wrong_item', 'delivery_delay', 'service_quality',
    'damaged_item', 'pricing_error', 'staff_behavior', 'other',
  ]),
  name: z.string().min(1).max(200),
  compensation_type: z.enum(['percent_discount', 'fixed_discount', 'free_shipping', 'free_item']),
  compensation_value: z.number().min(0),
  max_discount_amount: z.number().min(0).optional().nullable(),
  valid_days: z.number().int().min(1).max(365).optional(),
  auto_approve: z.boolean().optional(),
  requires_confirmation: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

// --- Voucher schemas ---

export const updateVoucherSchema = z.object({
  status: z.enum(['approved', 'rejected', 'redeemed']),
  approved_by: z.string().max(200).optional(),
  admin_notes: z.string().max(2000).optional(),
  redeemed_order_id: z.string().uuid().optional(),
})

// --- Delivery driver schemas ---

export const createDriverSchema = z.object({
  name: trimmedString,
  phone: trimmedString,
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  vehicle_type: z.enum(['motorcycle', 'car', 'bicycle', 'on_foot']).nullish(),
  vehicle_number: optionalString,
  status: z.enum(['active', 'inactive']).default('active'),
})

export const updateDriverSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  email: z.string().email().nullish().or(z.literal('')).transform(v => v === '' ? null : v),
  vehicle_type: z.enum(['motorcycle', 'car', 'bicycle', 'on_foot']).nullish(),
  vehicle_number: optionalString,
  status: z.enum(['active', 'inactive', 'on_delivery']).optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// --- Delivery schemas ---

export const createDeliverySchema = z.object({
  order_id: z.string().uuid().optional(),
  driver_id: z.string().uuid().optional(),
  delivery_type: z.enum(['own_driver', 'external_provider']).default('own_driver'),
  provider_name: z.string().max(200).optional(),
  provider_tracking_id: z.string().max(200).optional(),
  pickup_address: z.string().max(1000).optional(),
  delivery_address: z.string().min(1, 'Delivery address is required').max(1000),
  customer_name: optionalString,
  customer_phone: optionalString,
  estimated_delivery_time: z.string().optional(),
  delivery_fee: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduled_time_slot: z.string().max(20).optional(),
})

export const updateDeliverySchema = z.object({
  driver_id: z.string().uuid().nullish(),
  status: z.enum(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled', 'delayed']).optional(),
  provider_name: z.string().max(200).optional(),
  provider_tracking_id: z.string().max(200).optional(),
  delivery_address: z.string().max(500).optional(),
  customer_name: z.string().max(200).nullish(),
  customer_phone: z.string().max(50).nullish(),
  estimated_delivery_time: z.string().nullish(),
  actual_delivery_time: z.string().nullish(),
  delivery_fee: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  failure_reason: z.string().max(1000).optional(),
  proof_photo_url: z.string().url().nullish(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  scheduled_time_slot: z.string().max(20).nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Driver portal schemas
// ---------------------------------------------------------------------------

export const driverRegisterSchema = z.object({
  phone: z.string().trim().min(8, 'Утасны дугаар буруу байна').max(8, 'Утасны дугаар буруу байна'),
  password: z.string().min(8, 'Нууц үг хамгийн багадаа 8 тэмдэгт'),
  name: z.string().trim().min(1, 'Нэр оруулна уу'),
  store_id: z.string().uuid('Дэлгүүрийн ID буруу байна'),
})

export const driverUpdateStatusSchema = z.object({
  status: z.enum(['picked_up', 'in_transit', 'delivered', 'failed', 'delayed']),
  notes: z.string().max(2000).optional(),
  failure_reason: z.string().max(1000).optional(),
  proof_photo_url: z.string().url().nullish(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
})

export const driverUpdateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  vehicle_type: z.enum(['motorcycle', 'car', 'bicycle', 'on_foot']).optional(),
  vehicle_number: z.string().nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'Шинэчлэх талбар сонгоно уу',
})

// ---------------------------------------------------------------------------
// Delivery settings schemas (store-level AI assignment config)
// ---------------------------------------------------------------------------

export const deliverySettingsSchema = z.object({
  assignment_mode: z.enum(['auto', 'suggest', 'manual']).default('manual'),
  priority_rules: z.array(z.enum([
    'closest_driver', 'least_loaded', 'vehicle_match', 'round_robin', 'rating_first',
  ])).default(['least_loaded', 'closest_driver']),
  max_concurrent_deliveries: z.number().int().min(1).max(20).default(3),
  assignment_radius_km: z.number().min(1).max(100).default(10),
  auto_assign_on_shipped: z.boolean().default(true),
  working_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
    end: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
  }).optional(),
})

export const triggerAssignmentSchema = z.object({
  delivery_id: z.string().uuid(),
})

export const driverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export const createPayoutSchema = z.object({
  driver_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_amount: z.number().min(0),
  delivery_count: z.number().int().min(0),
  notes: z.string().max(1000).optional(),
})

export const updatePayoutSchema = z.object({
  status: z.enum(['approved', 'paid', 'cancelled']),
  notes: z.string().max(1000).optional(),
})

// ---------------------------------------------------------------------------
// Driver rating schemas
// ---------------------------------------------------------------------------

export const rateDriverSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  customer_name: z.string().max(200).optional(),
})

// ---------------------------------------------------------------------------
// Fee calculator schemas
// ---------------------------------------------------------------------------

export const calculateFeeSchema = z.object({
  address: z.string().min(3, 'Хаяг хамгийн багадаа 3 тэмдэгт'),
})

// ---------------------------------------------------------------------------
// Bulk payout generation schemas
// ---------------------------------------------------------------------------

export const generatePayoutSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driver_id: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Driver chat schemas
// ---------------------------------------------------------------------------

export const driverChatMessageSchema = z.object({
  message: z.string().min(1, 'Мессеж хоосон байж болохгүй').max(2000),
})

// ---------------------------------------------------------------------------
// Driver-store assignment schemas
// ---------------------------------------------------------------------------

export const assignDriverToStoreSchema = z.object({
  driver_id: z.string().uuid().optional(),
  driver_phone: z.string().min(8).max(8).optional(),
}).refine(obj => obj.driver_id || obj.driver_phone, {
  message: 'driver_id эсвэл driver_phone шаардлагатай',
})

// ---------------------------------------------------------------------------
// Delivery time slots schemas
// ---------------------------------------------------------------------------

export const deliveryTimeSlotsSchema = z.object({
  time_slots: z.array(z.string().min(1)).min(1, 'Хамгийн багадаа 1 цагийн мужтай байх ёстой'),
})

// ---------------------------------------------------------------------------
// Deal schemas (Real Estate)
// ---------------------------------------------------------------------------

export const createDealSchema = z.object({
  property_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  agent_id: z.string().uuid().nullish(),
  deal_type: z.enum(['sale', 'rent', 'lease']).default('sale'),
  asking_price: z.number().min(0).nullish(),
  commission_rate: z.number().min(0).max(100).default(5),
  agent_share_rate: z.number().min(0).max(100).default(50),
  notes: z.string().max(5000).nullish(),
})

export const updateDealSchema = z.object({
  property_id: z.string().uuid().nullish(),
  customer_id: z.string().uuid().nullish(),
  agent_id: z.string().uuid().nullish(),
  status: z.enum(['lead', 'viewing', 'offer', 'contract', 'closed', 'withdrawn', 'lost']).optional(),
  deal_type: z.enum(['sale', 'rent', 'lease']).optional(),
  asking_price: z.number().min(0).nullish(),
  offer_price: z.number().min(0).nullish(),
  final_price: z.number().min(0).nullish(),
  commission_rate: z.number().min(0).max(100).optional(),
  agent_share_rate: z.number().min(0).max(100).optional(),
  viewing_date: z.string().nullish(),
  offer_date: z.string().nullish(),
  contract_date: z.string().nullish(),
  notes: z.string().max(5000).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Agent Commission schemas (Real Estate)
// ---------------------------------------------------------------------------

export const createCommissionSchema = z.object({
  deal_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  commission_amount: z.number().min(0),
  agent_share: z.number().min(0),
  company_share: z.number().min(0),
  notes: z.string().max(2000).nullish(),
})

export const updateCommissionSchema = z.object({
  status: z.enum(['approved', 'paid', 'cancelled']),
  notes: z.string().max(2000).optional(),
})

export const generateCommissionsSchema = z.object({
  deal_ids: z.array(z.string().uuid()).optional(),
})

// ---------------------------------------------------------------------------
// Block schemas (Core Foundation)
// ---------------------------------------------------------------------------

export const createBlockSchema = z.object({
  staff_id: z.string().uuid().nullish(),
  resource_id: z.string().uuid().nullish(),
  start_at: z.string().min(1, 'start_at is required'),
  end_at: z.string().min(1, 'end_at is required'),
  reason: z.string().max(1000).nullish(),
  block_type: z.enum(['manual', 'break', 'holiday', 'maintenance']).default('manual'),
  recurring: z.record(z.string(), z.unknown()).nullish(),
}).refine(obj => obj.staff_id || obj.resource_id, {
  message: 'Either staff_id or resource_id is required',
})

export const updateBlockSchema = z.object({
  staff_id: z.string().uuid().nullish(),
  resource_id: z.string().uuid().nullish(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  reason: z.string().max(1000).nullish(),
  block_type: z.enum(['manual', 'break', 'holiday', 'maintenance']).optional(),
  recurring: z.record(z.string(), z.unknown()).nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Attachment schemas (Core Foundation)
// ---------------------------------------------------------------------------

export const createAttachmentSchema = z.object({
  entity_type: trimmedString,
  entity_id: z.string().uuid(),
  file_name: trimmedString,
  file_url: z.string().url(),
  file_type: z.string().nullish(),
  file_size: z.number().int().min(0).nullish(),
})

// ---------------------------------------------------------------------------
// Booking Item schemas (Core Foundation)
// ---------------------------------------------------------------------------

export const createBookingItemSchema = z.object({
  appointment_id: z.string().uuid(),
  service_id: z.string().uuid().nullish(),
  variation_id: z.string().uuid().nullish(),
  staff_id: z.string().uuid().nullish(),
  resource_id: z.string().uuid().nullish(),
  start_at: z.string().min(1, 'start_at is required'),
  end_at: z.string().min(1, 'end_at is required'),
  price: z.number().min(0).default(0),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).default('pending'),
  notes: z.string().max(2000).nullish(),
})

export const updateBookingItemSchema = z.object({
  service_id: z.string().uuid().nullish(),
  variation_id: z.string().uuid().nullish(),
  staff_id: z.string().uuid().nullish(),
  resource_id: z.string().uuid().nullish(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  price: z.number().min(0).optional(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().max(2000).nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Audit Log query schema (Core Foundation)
// ---------------------------------------------------------------------------

export const auditLogQuerySchema = z.object({
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  action: z.enum(['create', 'update', 'delete', 'status_change']).optional(),
  actor_id: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Invoice schemas (Universal Billing)
// ---------------------------------------------------------------------------

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description required'),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0),
  discount: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(100).default(0),
  item_type: z.enum(['product', 'service', 'fee', 'discount', 'tax', 'custom']).default('custom'),
  item_id: z.string().uuid().nullish(),
})

export const createInvoiceSchema = z.object({
  party_type: z.enum(['customer', 'supplier', 'staff', 'driver']),
  party_id: z.string().uuid().nullish(),
  source_type: z.enum(['order', 'appointment', 'reservation', 'manual', 'subscription']).default('manual'),
  source_id: z.string().uuid().nullish(),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item required'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(5000).nullish(),
  tax_rate: z.number().min(0).max(100).nullish(),
  discount_amount: z.number().min(0).nullish(),
})

export const updateInvoiceSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  notes: z.string().max(5000).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Payment schemas (Universal Billing)
// ---------------------------------------------------------------------------

export const recordBillingPaymentSchema = z.object({
  invoice_id: z.string().uuid().nullish(),
  amount: z.number().min(0.01, 'Amount must be positive'),
  method: z.enum(['cash', 'bank', 'qpay', 'card', 'online', 'credit']),
  gateway_ref: z.string().max(500).nullish(),
  notes: z.string().max(2000).nullish(),
})

export const updateBillingPaymentSchema = z.object({
  status: z.enum(['refunded', 'cancelled']),
  notes: z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// Menu Category schemas (QSR / Food)
// ---------------------------------------------------------------------------

export const createMenuCategorySchema = z.object({
  name: trimmedString,
  description: optionalString,
  image_url: z.string().url().nullish(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  available_from: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  available_until: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
})

export const updateMenuCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalString,
  image_url: z.string().url().nullish(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  available_from: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  available_until: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Modifier Group schemas (QSR / Food)
// ---------------------------------------------------------------------------

const modifierSchema = z.object({
  name: z.string().min(1),
  price_adjustment: z.number().default(0),
  is_default: z.boolean().default(false),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().default(0),
})

export const createModifierGroupSchema = z.object({
  name: trimmedString,
  selection_type: z.enum(['single', 'multiple']).default('single'),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(1),
  is_required: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  modifiers: z.array(modifierSchema).optional(),
})

export const updateModifierGroupSchema = z.object({
  name: z.string().trim().min(1).optional(),
  selection_type: z.enum(['single', 'multiple']).optional(),
  min_selections: z.number().int().min(0).optional(),
  max_selections: z.number().int().min(1).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// KDS Station schemas (QSR / Food)
// ---------------------------------------------------------------------------

export const createKdsStationSchema = z.object({
  name: trimmedString,
  station_type: z.enum(['kitchen', 'bar', 'prep', 'expo', 'packaging']).default('kitchen'),
  display_categories: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
})

export const updateKdsStationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  station_type: z.enum(['kitchen', 'bar', 'prep', 'expo', 'packaging']).optional(),
  display_categories: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Promotion schemas (QSR / Food)
// ---------------------------------------------------------------------------

export const createPromotionSchema = z.object({
  name: trimmedString,
  description: optionalString,
  promo_type: z.enum(['item_discount', 'order_discount', 'bogo', 'combo', 'free_item', 'loyalty']),
  discount_type: z.enum(['percent', 'fixed', 'free']).nullish(),
  discount_value: z.number().min(0).default(0),
  conditions: z.record(z.string(), z.unknown()).default({}),
  min_order_amount: z.number().min(0).nullish(),
  max_discount_amount: z.number().min(0).nullish(),
  applicable_products: z.array(z.string().uuid()).nullish(),
  applicable_categories: z.array(z.string()).nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  is_active: z.boolean().default(true),
  max_usage: z.number().int().min(1).nullish(),
})

export const updatePromotionSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: optionalString,
  promo_type: z.enum(['item_discount', 'order_discount', 'bogo', 'combo', 'free_item', 'loyalty']).optional(),
  discount_type: z.enum(['percent', 'fixed', 'free']).nullish(),
  discount_value: z.number().min(0).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  min_order_amount: z.number().min(0).nullish(),
  max_discount_amount: z.number().min(0).nullish(),
  applicable_products: z.array(z.string().uuid()).nullish(),
  applicable_categories: z.array(z.string()).nullish(),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  is_active: z.boolean().optional(),
  max_usage: z.number().int().min(1).nullish(),
}).refine(obj => Object.values(obj).some(v => v !== undefined), {
  message: 'No valid fields to update',
})

// ---------------------------------------------------------------------------
// Beauty / Wellness validations (Phase 4)
// ---------------------------------------------------------------------------

export const createServicePackageSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  original_price: z.number().positive().optional(),
  is_active: z.boolean().optional(),
  valid_days: z.number().int().positive().optional(),
  services: z.array(z.object({
    service_id: z.string().uuid(),
    quantity: z.number().int().positive().optional(),
  })).optional(),
})

export const updateServicePackageSchema = createServicePackageSchema.partial()

export const createMembershipSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  billing_period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  benefits: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

export const updateMembershipSchema = createMembershipSchema.partial()

export const createCustomerMembershipSchema = z.object({
  customer_id: z.string().uuid(),
  membership_id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'cancelled', 'expired']).optional(),
  expires_at: z.string().optional(),
})

export const updateCustomerMembershipSchema = z.object({
  status: z.enum(['active', 'paused', 'cancelled', 'expired']).optional(),
  expires_at: z.string().optional(),
  services_used: z.number().int().min(0).optional(),
})

export const createClientPreferencesSchema = z.object({
  customer_id: z.string().uuid(),
  skin_type: z.enum(['normal', 'dry', 'oily', 'combination', 'sensitive']).optional(),
  hair_type: z.enum(['straight', 'wavy', 'curly', 'coily', 'fine', 'thick']).optional(),
  allergies: z.array(z.string()).optional(),
  preferred_staff_id: z.string().uuid().optional(),
  color_history: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateClientPreferencesSchema = createClientPreferencesSchema.omit({ customer_id: true })

export const createStaffCommissionSchema = z.object({
  staff_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  sale_type: z.enum(['service', 'product', 'package', 'membership']).optional(),
  sale_amount: z.number().positive(),
  commission_rate: z.number().min(0).max(100),
  commission_amount: z.number().min(0),
})

export const updateStaffCommissionSchema = z.object({
  status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional(),
  paid_at: z.string().optional(),
})

export const generateStaffCommissionsSchema = z.object({
  staff_id: z.string().uuid().optional(),
  date_from: z.string(),
  date_to: z.string(),
  commission_rate: z.number().min(0).max(100),
})

// ---------------------------------------------------------------------------
// Stay / Hospitality (Phase 5)
// ---------------------------------------------------------------------------

// Units
export const createUnitSchema = z.object({
  unit_number: z.string().min(1).max(50),
  unit_type: z.enum(['standard', 'deluxe', 'suite', 'penthouse', 'dormitory', 'cabin', 'apartment']).optional(),
  resource_id: z.string().uuid().optional(),
  floor: z.string().max(20).optional(),
  max_occupancy: z.number().int().min(1).max(100).optional(),
  base_rate: z.number().positive(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(['available', 'occupied', 'maintenance', 'blocked']).optional(),
})

export const updateUnitSchema = createUnitSchema.partial()

// Guests
export const createGuestSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  customer_id: z.string().uuid().optional(),
  document_type: z.enum(['passport', 'national_id', 'driving_license']).optional(),
  document_number: z.string().max(50).optional(),
  nationality: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  vip_level: z.enum(['regular', 'silver', 'gold', 'platinum']).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateGuestSchema = createGuestSchema.partial()

// Reservations
export const createReservationSchema = z.object({
  unit_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  check_in: z.string(), // DATE format
  check_out: z.string(), // DATE format
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  rate_per_night: z.number().positive(),
  total_amount: z.number().min(0),
  deposit_amount: z.number().min(0).optional(),
  source: z.enum(['direct', 'website', 'booking_com', 'airbnb', 'expedia', 'other']).optional(),
  special_requests: z.string().max(2000).optional(),
})

export const updateReservationSchema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']).optional(),
  actual_check_in: z.string().optional(),
  actual_check_out: z.string().optional(),
  deposit_status: z.enum(['pending', 'paid', 'refunded']).optional(),
  special_requests: z.string().max(2000).optional(),
})

// Housekeeping Tasks
export const createHousekeepingTaskSchema = z.object({
  unit_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional(),
  task_type: z.enum(['cleaning', 'deep_cleaning', 'turnover', 'inspection', 'restocking']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  scheduled_at: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateHousekeepingTaskSchema = z.object({
  assigned_to: z.string().uuid().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  completed_at: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

// Maintenance Requests
export const createMaintenanceRequestSchema = z.object({
  unit_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  category: z.enum(['plumbing', 'electrical', 'hvac', 'furniture', 'appliance', 'general']).optional(),
  description: z.string().min(1).max(5000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  estimated_cost: z.number().min(0).optional(),
})

export const updateMaintenanceRequestSchema = z.object({
  assigned_to: z.string().uuid().optional(),
  status: z.enum(['reported', 'assigned', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  actual_cost: z.number().min(0).optional(),
})

// Damage Reports
export const createDamageReportSchema = z.object({
  reservation_id: z.string().uuid().optional(),
  unit_id: z.string().uuid(),
  guest_id: z.string().uuid().optional(),
  description: z.string().min(1).max(5000),
  damage_type: z.enum(['minor', 'moderate', 'major']).optional(),
  estimated_cost: z.number().min(0).optional(),
  photos: z.array(z.string()).optional(),
})

export const updateDamageReportSchema = z.object({
  status: z.enum(['reported', 'assessed', 'charged', 'resolved', 'waived']).optional(),
  charged_amount: z.number().min(0).optional(),
  estimated_cost: z.number().min(0).optional(),
})

// ---------------------------------------------------------------------------
// Retail / POS (Phase 6)
// ---------------------------------------------------------------------------

// Inventory Locations
export const createInventoryLocationSchema = z.object({
  name: z.string().min(1).max(200),
  location_type: z.enum(['warehouse', 'shelf', 'bin', 'display', 'backroom']).optional(),
  parent_id: z.string().uuid().optional(),
  barcode: z.string().max(100).optional(),
})

export const updateInventoryLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  location_type: z.enum(['warehouse', 'shelf', 'bin', 'display', 'backroom']).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  barcode: z.string().max(100).nullable().optional(),
  is_active: z.boolean().optional(),
})

// Inventory Movements
export const createInventoryMovementSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  movement_type: z.enum(['received', 'sold', 'returned', 'adjusted', 'transferred', 'damaged', 'expired']),
  quantity: z.number().int(),
  reference_type: z.enum(['purchase_order', 'order', 'manual', 'count']).optional(),
  reference_id: z.string().uuid().optional(),
  unit_cost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
})

// Suppliers
export const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  payment_terms: z.enum(['cod', 'net_15', 'net_30', 'net_60', 'prepaid']).optional(),
})

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  is_active: z.boolean().optional(),
})

// Purchase Orders
export const createPurchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  po_number: z.string().min(1).max(50),
  expected_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional(),
    quantity_ordered: z.number().int().min(1),
    unit_cost: z.number().min(0),
  })).min(1),
})

export const updatePurchaseOrderSchema = z.object({
  status: z.enum(['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled']).optional(),
  expected_date: z.string().optional(),
  received_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const receivePurchaseOrderItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity_received: z.number().int().min(1),
})

// POS Sessions
export const openPosSessionSchema = z.object({
  register_name: z.string().max(100).optional(),
  opening_cash: z.number().min(0).optional(),
})

export const closePosSessionSchema = z.object({
  closing_cash: z.number().min(0),
})

// ----- Laundry (Phase 7a) -----

export const createLaundryOrderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  order_number: z.string().min(1).max(50),
  rush_order: z.boolean().optional(),
  pickup_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    item_type: z.string().min(1).max(100),
    service_type: z.enum(['wash_fold', 'dry_clean', 'press_only', 'stain_removal', 'alterations']).optional(),
    quantity: z.number().int().min(1).optional(),
    unit_price: z.number().min(0),
    notes: z.string().max(500).optional(),
  })).min(1),
})

export const updateLaundryOrderSchema = z.object({
  status: z.enum(['received', 'processing', 'washing', 'drying', 'ironing', 'ready', 'delivered', 'cancelled']).optional(),
  paid_amount: z.number().min(0).optional(),
  pickup_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const createMachineSchema = z.object({
  name: z.string().min(1).max(100),
  machine_type: z.enum(['washer', 'dryer', 'iron_press', 'steam']).optional(),
  capacity_kg: z.number().positive().optional(),
})

export const updateMachineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  machine_type: z.enum(['washer', 'dryer', 'iron_press', 'steam']).optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'out_of_order']).optional(),
  capacity_kg: z.number().positive().optional(),
})

// ----- Medical (Phase 7b) -----

export const createPatientSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  customer_id: z.string().uuid().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  emergency_contact: z.record(z.string(), z.unknown()).optional(),
  allergies: z.array(z.string()).optional(),
  insurance_info: z.record(z.string(), z.unknown()).optional(),
})

export const updatePatientSchema = createPatientSchema.partial()

export const createEncounterSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid().optional(),
  encounter_type: z.enum(['consultation', 'follow_up', 'emergency', 'procedure', 'lab_visit']).optional(),
  chief_complaint: z.string().max(2000).optional(),
  encounter_date: z.string().optional(),
})

export const updateEncounterSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  diagnosis: z.string().max(5000).optional(),
  treatment_plan: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
})

export const createPrescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  prescribed_by: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(z.object({
    medication_name: z.string().min(1).max(200),
    dosage: z.string().min(1).max(100),
    frequency: z.string().min(1).max(100),
    duration: z.string().max(100).optional(),
    instructions: z.string().max(500).optional(),
  })).min(1),
})

export const updatePrescriptionSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'expired']).optional(),
  notes: z.string().max(2000).optional(),
})

export const createMedicalNoteSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  note_type: z.enum(['progress', 'soap', 'procedure', 'discharge', 'referral']).optional(),
  content: z.string().min(1).max(10000),
  is_private: z.boolean().optional(),
})

// ----- Medical Extended (Phase 7b+) -----

export const createLabOrderSchema = z.object({
  patient_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  ordered_by: z.string().uuid().optional(),
  order_type: z.enum(['lab', 'imaging', 'other']).optional(),
  test_name: z.string().min(1).max(300),
  test_code: z.string().max(50).optional(),
  urgency: z.enum(['routine', 'urgent', 'stat']).optional(),
  specimen_type: z.string().max(100).optional(),
  collection_time: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateLabOrderSchema = z.object({
  status: z.enum(['ordered', 'collected', 'processing', 'completed', 'cancelled']).optional(),
  specimen_type: z.string().max(100).optional(),
  collection_time: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const createLabResultSchema = z.object({
  order_id: z.string().uuid(),
  result_data: z.array(z.object({
    test_name: z.string().min(1),
    value: z.string(),
    unit: z.string().optional(),
    ref_range: z.string().optional(),
    flag: z.enum(['normal', 'low', 'high', 'critical']).optional(),
  })).optional(),
  interpretation: z.string().max(5000).optional(),
  report_url: z.string().url().max(500).optional(),
  resulted_by: z.string().max(200).optional(),
  resulted_at: z.string().optional(),
})

export const updateLabResultSchema = z.object({
  interpretation: z.string().max(5000).optional(),
  report_url: z.string().url().max(500).optional(),
  reviewed_by: z.string().uuid().optional(),
  reviewed_at: z.string().optional(),
})

export const createAdmissionSchema = z.object({
  patient_id: z.string().uuid(),
  attending_staff_id: z.string().uuid().optional(),
  admit_diagnosis: z.string().max(2000).optional(),
  admit_at: z.string().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateAdmissionSchema = z.object({
  status: z.enum(['admitted', 'discharged', 'transferred']).optional(),
  attending_staff_id: z.string().uuid().optional(),
  discharge_at: z.string().optional(),
  discharge_summary: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
})

export const createBedAssignmentSchema = z.object({
  admission_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
})

export const createMedicalComplaintSchema = z.object({
  patient_id: z.string().uuid().optional(),
  encounter_id: z.string().uuid().optional(),
  category: z.enum(['wait_time', 'treatment', 'staff_behavior', 'facility', 'billing', 'other']).optional(),
  severity: z.enum(['minor', 'moderate', 'serious']).optional(),
  description: z.string().min(1).max(5000),
})

export const updateMedicalComplaintSchema = z.object({
  status: z.enum(['open', 'assigned', 'reviewed', 'resolved', 'closed']).optional(),
  assigned_to: z.string().uuid().optional(),
  resolution: z.string().max(5000).optional(),
  severity: z.enum(['minor', 'moderate', 'serious']).optional(),
})

// ----- Education (Phase 7c) -----

export const createProgramSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  program_type: z.enum(['course', 'workshop', 'seminar', 'certification', 'tutoring']).optional(),
  duration_weeks: z.number().int().min(1).optional(),
  price: z.number().min(0).optional(),
  max_students: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
})

export const updateProgramSchema = createProgramSchema.partial()

export const createCourseSessionSchema = z.object({
  program_id: z.string().uuid(),
  instructor_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(1).optional(),
  location: z.string().max(200).optional(),
})

export const updateCourseSessionSchema = z.object({
  instructor_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(1).optional(),
  location: z.string().max(200).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
})

export const createStudentSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  customer_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  date_of_birth: z.string().optional(),
  guardian_name: z.string().max(200).optional(),
  guardian_phone: z.string().max(30).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateStudentSchema = createStudentSchema.partial()

export const createEnrollmentSchema = z.object({
  student_id: z.string().uuid(),
  program_id: z.string().uuid(),
})

export const updateEnrollmentSchema = z.object({
  status: z.enum(['active', 'completed', 'withdrawn', 'suspended']).optional(),
  grade: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
})

export const recordAttendanceSchema = z.object({
  session_id: z.string().uuid(),
  student_id: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused']).optional(),
  notes: z.string().max(500).optional(),
})

export const createGradeSchema = z.object({
  enrollment_id: z.string().uuid(),
  assessment_name: z.string().min(1).max(200),
  score: z.number().min(0).optional(),
  max_score: z.number().min(0).optional(),
  weight: z.number().min(0).max(1).optional(),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Phase 8: Pet Services + Car Wash + Wellness
// ============================================================

export const createPetSchema = z.object({
  customer_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  species: z.string().min(1).max(50).optional(),
  breed: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
  date_of_birth: z.string().optional(),
  medical_notes: z.string().max(5000).optional(),
  vaccinations: z.array(z.record(z.string(), z.unknown())).optional(),
  is_active: z.boolean().optional(),
})

export const updatePetSchema = z.object({
  customer_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100).optional(),
  species: z.string().min(1).max(50).optional(),
  breed: z.string().max(100).optional(),
  weight: z.number().min(0).optional(),
  date_of_birth: z.string().optional(),
  medical_notes: z.string().max(5000).optional(),
  vaccinations: z.array(z.record(z.string(), z.unknown())).optional(),
  is_active: z.boolean().optional(),
})

export const createPetAppointmentSchema = z.object({
  pet_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
  total_amount: z.number().min(0).optional(),
})

export const updatePetAppointmentSchema = z.object({
  service_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(1).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(2000).optional(),
  total_amount: z.number().min(0).optional(),
})

export const createVehicleSchema = z.object({
  customer_id: z.string().uuid().optional(),
  plate_number: z.string().min(1).max(20),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  vehicle_type: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle', 'bus', 'other']).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateVehicleSchema = z.object({
  customer_id: z.string().uuid().optional(),
  plate_number: z.string().min(1).max(20).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  vehicle_type: z.enum(['sedan', 'suv', 'truck', 'van', 'motorcycle', 'bus', 'other']).optional(),
  notes: z.string().max(2000).optional(),
})

export const createWashOrderSchema = z.object({
  vehicle_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  service_type: z.enum(['basic', 'standard', 'premium', 'deluxe', 'interior_only', 'exterior_only']).optional(),
  total_amount: z.number().min(0).optional(),
  bay_number: z.number().int().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateWashOrderSchema = z.object({
  service_type: z.enum(['basic', 'standard', 'premium', 'deluxe', 'interior_only', 'exterior_only']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  total_amount: z.number().min(0).optional(),
  bay_number: z.number().int().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const createTreatmentPlanSchema = z.object({
  customer_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  sessions_total: z.number().int().min(1).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const updateTreatmentPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  sessions_total: z.number().int().min(1).optional(),
  sessions_used: z.number().int().min(0).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused', 'cancelled']).optional(),
})

export const createTreatmentSessionSchema = z.object({
  treatment_plan_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  session_number: z.number().int().min(1).optional(),
  notes: z.string().max(5000).optional(),
  results: z.string().max(5000).optional(),
  performed_at: z.string().optional(),
})

export const updateTreatmentSessionSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'missed', 'cancelled']).optional(),
  notes: z.string().max(5000).optional(),
  results: z.string().max(5000).optional(),
  performed_at: z.string().optional(),
})

// ============================================================
// Phase 9: Photography + Venue + Coworking
// ============================================================

export const createPhotoSessionSchema = z.object({
  customer_id: z.string().uuid().optional(),
  photographer_id: z.string().uuid().optional(),
  session_type: z.enum(['portrait', 'wedding', 'event', 'product', 'family', 'maternity', 'newborn', 'corporate', 'other']).optional(),
  location: z.string().max(500).optional(),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  total_amount: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updatePhotoSessionSchema = z.object({
  customer_id: z.string().uuid().optional(),
  photographer_id: z.string().uuid().optional(),
  session_type: z.enum(['portrait', 'wedding', 'event', 'product', 'family', 'maternity', 'newborn', 'corporate', 'other']).optional(),
  location: z.string().max(500).optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
  total_amount: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const createPhotoGallerySchema = z.object({
  session_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  gallery_url: z.string().url().optional(),
  download_url: z.string().url().optional(),
  password: z.string().max(100).optional(),
  photo_count: z.number().int().min(0).optional(),
})

export const updatePhotoGallerySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  gallery_url: z.string().url().optional(),
  download_url: z.string().url().optional(),
  password: z.string().max(100).optional(),
  photo_count: z.number().int().min(0).optional(),
  status: z.enum(['processing', 'ready', 'delivered', 'archived']).optional(),
})

export const createVenueSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  capacity: z.number().int().min(1).optional(),
  hourly_rate: z.number().min(0).optional(),
  daily_rate: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const updateVenueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  capacity: z.number().int().min(1).optional(),
  hourly_rate: z.number().min(0).optional(),
  daily_rate: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const createVenueBookingSchema = z.object({
  venue_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  event_type: z.enum(['private', 'corporate', 'wedding', 'birthday', 'conference', 'workshop', 'exhibition', 'other']).optional(),
  start_at: z.string(),
  end_at: z.string(),
  guests_count: z.number().int().min(1).optional(),
  total_amount: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).optional(),
  special_requests: z.string().max(5000).optional(),
})

export const updateVenueBookingSchema = z.object({
  venue_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  event_type: z.enum(['private', 'corporate', 'wedding', 'birthday', 'conference', 'workshop', 'exhibition', 'other']).optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  guests_count: z.number().int().min(1).optional(),
  total_amount: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).optional(),
  status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  special_requests: z.string().max(5000).optional(),
})

export const createCoworkingSpaceSchema = z.object({
  name: z.string().min(1).max(200),
  space_type: z.enum(['hot_desk', 'dedicated_desk', 'private_office', 'meeting_room', 'event_space', 'phone_booth']).optional(),
  capacity: z.number().int().min(1).optional(),
  hourly_rate: z.number().min(0).optional(),
  daily_rate: z.number().min(0).optional(),
  monthly_rate: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const updateCoworkingSpaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  space_type: z.enum(['hot_desk', 'dedicated_desk', 'private_office', 'meeting_room', 'event_space', 'phone_booth']).optional(),
  capacity: z.number().int().min(1).optional(),
  hourly_rate: z.number().min(0).optional(),
  daily_rate: z.number().min(0).optional(),
  monthly_rate: z.number().min(0).optional(),
  amenities: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

export const createDeskBookingSchema = z.object({
  space_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  booking_date: z.string(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  total_amount: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateDeskBookingSchema = z.object({
  space_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  booking_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  total_amount: z.number().min(0).optional(),
  status: z.enum(['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Phase 10: Legal + Construction + Subscription
// ============================================================

export const createLegalCaseSchema = z.object({
  customer_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  case_number: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  case_type: z.enum(['civil', 'criminal', 'corporate', 'family', 'real_estate', 'immigration', 'tax', 'labor', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  description: z.string().max(10000).optional(),
  court_name: z.string().max(500).optional(),
  filing_date: z.string().optional(),
  next_hearing: z.string().optional(),
  total_fees: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateLegalCaseSchema = z.object({
  customer_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
  case_type: z.enum(['civil', 'criminal', 'corporate', 'family', 'real_estate', 'immigration', 'tax', 'labor', 'other']).optional(),
  status: z.enum(['open', 'in_progress', 'pending_hearing', 'settled', 'closed', 'archived']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  description: z.string().max(10000).optional(),
  court_name: z.string().max(500).optional(),
  filing_date: z.string().optional(),
  next_hearing: z.string().optional(),
  total_fees: z.number().min(0).optional(),
  amount_paid: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const createCaseDocumentSchema = z.object({
  case_id: z.string().uuid(),
  name: z.string().min(1).max(500),
  document_type: z.enum(['general', 'contract', 'court_filing', 'evidence', 'correspondence', 'invoice', 'other']).optional(),
  file_url: z.string().url().optional(),
  file_size: z.number().int().min(0).optional(),
  uploaded_by: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Legal Extended: Time Entries, Case Events, Expenses, Retainers
// ============================================================

// Time Entries
export const createTimeEntrySchema = z.object({
  case_id: z.string().uuid(),
  staff_id: z.string().uuid().optional(),
  description: z.string().min(1).max(2000),
  hours: z.number().min(0),
  billable_rate: z.number().min(0).optional(),
  is_billable: z.boolean().optional(),
  entry_date: z.string().optional(),
})

export const updateTimeEntrySchema = z.object({
  case_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(2000).optional(),
  hours: z.number().min(0).optional(),
  billable_rate: z.number().min(0).optional(),
  is_billable: z.boolean().optional(),
  entry_date: z.string().optional(),
})

// Case Events
export const createCaseEventSchema = z.object({
  case_id: z.string().uuid(),
  event_type: z.enum(['hearing', 'filing_deadline', 'consultation', 'court_date', 'deposition', 'mediation']).optional(),
  title: z.string().min(1).max(500),
  scheduled_at: z.string().min(1),
  location: z.string().max(500).optional(),
  outcome: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateCaseEventSchema = z.object({
  case_id: z.string().uuid().optional(),
  event_type: z.enum(['hearing', 'filing_deadline', 'consultation', 'court_date', 'deposition', 'mediation']).optional(),
  title: z.string().min(1).max(500).optional(),
  scheduled_at: z.string().optional(),
  location: z.string().max(500).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Legal Expenses
export const createLegalExpenseSchema = z.object({
  case_id: z.string().uuid(),
  expense_type: z.enum(['filing_fee', 'travel', 'expert_witness', 'court_reporter', 'copying', 'other']).optional(),
  description: z.string().min(1).max(2000),
  amount: z.number().min(0),
  incurred_date: z.string().optional(),
  is_billable: z.boolean().optional(),
  receipt_url: z.string().url().optional(),
})

export const updateLegalExpenseSchema = z.object({
  case_id: z.string().uuid().optional(),
  expense_type: z.enum(['filing_fee', 'travel', 'expert_witness', 'court_reporter', 'copying', 'other']).optional(),
  description: z.string().min(1).max(2000).optional(),
  amount: z.number().min(0).optional(),
  incurred_date: z.string().optional(),
  is_billable: z.boolean().optional(),
  receipt_url: z.string().url().nullable().optional(),
})

// Retainers
export const createRetainerSchema = z.object({
  case_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  initial_amount: z.number().min(0),
  current_balance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'refunded']).optional(),
})

export const updateRetainerSchema = z.object({
  case_id: z.string().uuid().optional(),
  client_id: z.string().uuid().nullable().optional(),
  initial_amount: z.number().min(0).optional(),
  current_balance: z.number().min(0).optional(),
  status: z.enum(['active', 'depleted', 'refunded']).optional(),
})

export const createProjectSchema = z.object({
  customer_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  project_type: z.enum(['construction', 'renovation', 'maintenance', 'design', 'consulting', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().min(0).optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateProjectSchema = z.object({
  customer_id: z.string().uuid().optional(),
  manager_id: z.string().uuid().optional(),
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  project_type: z.enum(['construction', 'renovation', 'maintenance', 'design', 'consulting', 'other']).optional(),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().min(0).optional(),
  actual_cost: z.number().min(0).optional(),
  completion_percentage: z.number().int().min(0).max(100).optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
})

export const createProjectTaskSchema = z.object({
  project_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  estimated_hours: z.number().min(0).optional(),
  sort_order: z.number().int().optional(),
})

export const updateProjectTaskSchema = z.object({
  assigned_to: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  due_date: z.string().optional(),
  estimated_hours: z.number().min(0).optional(),
  actual_hours: z.number().min(0).optional(),
  sort_order: z.number().int().optional(),
})

export const createSubscriptionSchema = z.object({
  customer_id: z.string().uuid(),
  plan_name: z.string().min(1).max(200),
  billing_period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  amount: z.number().min(0),
  next_billing_at: z.string().optional(),
  auto_renew: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateSubscriptionSchema = z.object({
  plan_name: z.string().min(1).max(200).optional(),
  billing_period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  amount: z.number().min(0).optional(),
  status: z.enum(['active', 'paused', 'cancelled', 'expired', 'past_due']).optional(),
  next_billing_at: z.string().optional(),
  auto_renew: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
})

export const createSubscriptionItemSchema = z.object({
  subscription_id: z.string().uuid(),
  product_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).optional(),
  unit_price: z.number().min(0),
})

// ============================================================
// Phase 11: Sports/Gym + Repair Shop + Consulting
// ============================================================

// Fitness Classes
export const createFitnessClassSchema = z.object({
  instructor_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  class_type: z.enum(['group', 'personal', 'online', 'workshop', 'camp', 'other']).optional(),
  capacity: z.number().int().min(1).optional(),
  duration_minutes: z.number().int().min(5).optional(),
  schedule: z.any().optional(),
  is_active: z.boolean().optional(),
})

export const updateFitnessClassSchema = z.object({
  instructor_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  class_type: z.enum(['group', 'personal', 'online', 'workshop', 'camp', 'other']).optional(),
  capacity: z.number().int().min(1).optional(),
  duration_minutes: z.number().int().min(5).optional(),
  schedule: z.any().optional(),
  is_active: z.boolean().optional(),
})

// Class Bookings
export const createClassBookingSchema = z.object({
  class_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  booking_date: z.string().min(1),
  status: z.enum(['booked', 'attended', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateClassBookingSchema = z.object({
  status: z.enum(['booked', 'attended', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// Equipment
export const createEquipmentSchema = z.object({
  name: z.string().min(1).max(200),
  equipment_type: z.enum(['cardio', 'strength', 'flexibility', 'functional', 'recovery', 'general', 'other']).optional(),
  serial_number: z.string().max(100).optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).optional(),
  location: z.string().max(200).optional(),
  purchase_date: z.string().optional(),
  last_maintenance: z.string().optional(),
  next_maintenance: z.string().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateEquipmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  equipment_type: z.enum(['cardio', 'strength', 'flexibility', 'functional', 'recovery', 'general', 'other']).optional(),
  serial_number: z.string().max(100).nullable().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).optional(),
  location: z.string().max(200).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  last_maintenance: z.string().nullable().optional(),
  next_maintenance: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Repair Orders
export const createRepairOrderSchema = z.object({
  customer_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  order_number: z.string().min(1).max(50),
  device_type: z.enum(['phone', 'tablet', 'laptop', 'desktop', 'tv', 'appliance', 'vehicle', 'jewelry', 'watch', 'other']).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  issue_description: z.string().min(1).max(5000),
  diagnosis: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimated_cost: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).optional(),
  estimated_completion: z.string().optional(),
  warranty_until: z.string().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateRepairOrderSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  device_type: z.enum(['phone', 'tablet', 'laptop', 'desktop', 'tv', 'appliance', 'vehicle', 'jewelry', 'watch', 'other']).optional(),
  brand: z.string().max(100).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  serial_number: z.string().max(100).nullable().optional(),
  issue_description: z.string().min(1).max(5000).optional(),
  diagnosis: z.string().max(5000).nullable().optional(),
  status: z.enum(['received', 'diagnosing', 'waiting_parts', 'in_repair', 'testing', 'completed', 'delivered', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimated_cost: z.number().min(0).nullable().optional(),
  actual_cost: z.number().min(0).nullable().optional(),
  deposit_amount: z.number().min(0).nullable().optional(),
  estimated_completion: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  warranty_until: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Repair Parts
export const createRepairPartSchema = z.object({
  repair_order_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  part_number: z.string().max(100).optional(),
  quantity: z.number().int().min(1).optional(),
  unit_cost: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
})

// Consultations
export const createConsultationSchema = z.object({
  customer_id: z.string().uuid().optional(),
  consultant_id: z.string().uuid().optional(),
  consultation_type: z.enum(['general', 'initial', 'follow_up', 'review', 'strategy', 'technical', 'financial', 'other']).optional(),
  scheduled_at: z.string().min(1),
  duration_minutes: z.number().int().min(5).optional(),
  fee: z.number().min(0).optional(),
  location: z.string().max(500).optional(),
  meeting_url: z.string().url().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  follow_up_date: z.string().optional(),
})

export const updateConsultationSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  consultant_id: z.string().uuid().nullable().optional(),
  consultation_type: z.enum(['general', 'initial', 'follow_up', 'review', 'strategy', 'technical', 'financial', 'other']).optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(5).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled']).optional(),
  fee: z.number().min(0).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  meeting_url: z.string().url().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  follow_up_date: z.string().nullable().optional(),
})

// ============================================================
// Phase 12: Home Services + Logistics/Fleet + Restaurant Extensions
// ============================================================

// Service Requests (Home Services)
export const createServiceRequestSchema = z.object({
  customer_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  request_number: z.string().min(1).max(50),
  service_type: z.enum(['cleaning', 'plumbing', 'electrical', 'painting', 'carpentry', 'hvac', 'landscaping', 'moving', 'pest_control', 'general', 'other']).optional(),
  address: z.string().max(500).optional(),
  scheduled_at: z.string().optional(),
  duration_estimate: z.number().int().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimated_cost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateServiceRequestSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  service_type: z.enum(['cleaning', 'plumbing', 'electrical', 'painting', 'carpentry', 'hvac', 'landscaping', 'moving', 'pest_control', 'general', 'other']).optional(),
  address: z.string().max(500).nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  duration_estimate: z.number().int().min(1).nullable().optional(),
  status: z.enum(['pending', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  estimated_cost: z.number().min(0).nullable().optional(),
  actual_cost: z.number().min(0).nullable().optional(),
  completed_at: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Service Areas
export const createServiceAreaSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  zip_codes: z.array(z.string().max(20)).optional(),
  is_active: z.boolean().optional(),
})

export const updateServiceAreaSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  zip_codes: z.array(z.string().max(20)).nullable().optional(),
  is_active: z.boolean().optional(),
})

// Fleet Vehicles
export const createFleetVehicleSchema = z.object({
  driver_id: z.string().uuid().optional(),
  plate_number: z.string().min(1).max(20),
  vehicle_type: z.enum(['car', 'van', 'truck', 'motorcycle', 'bicycle', 'other']).optional(),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  insurance_expiry: z.string().optional(),
  registration_expiry: z.string().optional(),
  mileage: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateFleetVehicleSchema = z.object({
  driver_id: z.string().uuid().nullable().optional(),
  plate_number: z.string().min(1).max(20).optional(),
  vehicle_type: z.enum(['car', 'van', 'truck', 'motorcycle', 'bicycle', 'other']).optional(),
  brand: z.string().max(100).nullable().optional(),
  model: z.string().max(100).nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).optional(),
  insurance_expiry: z.string().nullable().optional(),
  registration_expiry: z.string().nullable().optional(),
  mileage: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Trip Logs
export const createTripLogSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid().optional(),
  start_location: z.string().max(500).optional(),
  end_location: z.string().max(500).optional(),
  start_time: z.string().min(1),
  end_time: z.string().optional(),
  distance_km: z.number().min(0).optional(),
  fuel_cost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateTripLogSchema = z.object({
  driver_id: z.string().uuid().nullable().optional(),
  start_location: z.string().max(500).nullable().optional(),
  end_location: z.string().max(500).nullable().optional(),
  end_time: z.string().nullable().optional(),
  distance_km: z.number().min(0).nullable().optional(),
  fuel_cost: z.number().min(0).nullable().optional(),
  status: z.enum(['in_progress', 'completed', 'cancelled']).optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// Table Layouts (Restaurant)
export const createTableLayoutSchema = z.object({
  name: z.string().min(1).max(100),
  section: z.string().max(100).optional(),
  capacity: z.number().int().min(1).optional(),
  shape: z.enum(['rectangle', 'circle', 'square', 'oval']).optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  is_active: z.boolean().optional(),
})

export const updateTableLayoutSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  section: z.string().max(100).nullable().optional(),
  capacity: z.number().int().min(1).optional(),
  shape: z.enum(['rectangle', 'circle', 'square', 'oval']).optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning', 'out_of_service']).optional(),
  is_active: z.boolean().optional(),
})

// Table Reservations (Restaurant)
export const createTableReservationSchema = z.object({
  table_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  party_size: z.number().int().min(1).optional(),
  reservation_time: z.string().min(1),
  duration_minutes: z.number().int().min(15).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateTableReservationSchema = z.object({
  table_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  party_size: z.number().int().min(1).optional(),
  reservation_time: z.string().optional(),
  duration_minutes: z.number().int().min(15).optional(),
  status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// ----- Restaurant Extended (Phase 8b+) -----

export const createTableSessionSchema = z.object({
  table_id: z.string().uuid(),
  server_id: z.string().uuid().optional(),
  guest_count: z.number().int().min(1),
  notes: z.string().max(500).optional(),
})

export const updateTableSessionSchema = z.object({
  status: z.enum(['active', 'closed']).optional(),
  server_id: z.string().uuid().optional(),
  guest_count: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
})

export const createKdsTicketSchema = z.object({
  station_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  table_session_id: z.string().uuid().optional(),
  items: z.array(z.object({
    name: z.string(),
    qty: z.number().int().min(1),
    notes: z.string().optional(),
  })).optional(),
  priority: z.number().int().min(0).max(10).optional(),
})

export const updateKdsTicketSchema = z.object({
  status: z.enum(['new', 'preparing', 'ready', 'served', 'cancelled']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
})

export const createEventBookingSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(1).max(30),
  customer_email: z.string().email().optional(),
  customer_id: z.string().uuid().optional(),
  event_type: z.enum(['wedding', 'corporate', 'birthday', 'conference', 'other']).optional(),
  event_date: z.string().min(1),
  event_start_time: z.string().optional(),
  event_end_time: z.string().optional(),
  guest_count: z.number().int().min(1),
  venue_resource_id: z.string().uuid().optional(),
  budget_estimate: z.number().min(0).optional(),
  special_requirements: z.string().max(5000).optional(),
  setup_notes: z.string().max(5000).optional(),
})

export const updateEventBookingSchema = z.object({
  status: z.enum(['inquiry', 'quoted', 'deposit_paid', 'confirmed', 'in_service', 'closed', 'cancelled']).optional(),
  quoted_amount: z.number().min(0).optional(),
  final_amount: z.number().min(0).optional(),
  special_requirements: z.string().max(5000).optional(),
  menu_selection: z.record(z.string(), z.unknown()).optional(),
  setup_notes: z.string().max(5000).optional(),
  guest_count: z.number().int().min(1).optional(),
})

export const createCateringOrderSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(1).max(30),
  customer_id: z.string().uuid().optional(),
  serving_date: z.string().min(1),
  serving_time: z.string().min(1),
  location_type: z.enum(['on_site', 'customer_location']).optional(),
  address_text: z.string().max(500).optional(),
  guest_count: z.number().int().min(1),
  logistics_notes: z.string().max(5000).optional(),
})

export const updateCateringOrderSchema = z.object({
  status: z.enum(['inquiry', 'confirmed', 'preparing', 'dispatched', 'served', 'closed', 'cancelled']).optional(),
  quoted_amount: z.number().min(0).optional(),
  final_amount: z.number().min(0).optional(),
  logistics_notes: z.string().max(5000).optional(),
  address_text: z.string().max(500).optional(),
})

export const createProductionBatchSchema = z.object({
  product_id: z.string().uuid().optional(),
  production_date: z.string().min(1),
  target_qty: z.number().int().min(1),
  cost_per_unit: z.number().min(0).optional(),
  expiry_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
})

export const updateProductionBatchSchema = z.object({
  status: z.enum(['planned', 'in_progress', 'completed']).optional(),
  produced_qty: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
})

// ============================================================
// Phase 13: Construction Extended
// ============================================================

// Material Orders
export const createMaterialOrderSchema = z.object({
  project_id: z.string().uuid(),
  supplier_name: z.string().min(1).max(500),
  order_date: z.string().optional(),
  expected_delivery: z.string().optional(),
  total_cost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateMaterialOrderSchema = z.object({
  supplier_name: z.string().min(1).max(500).optional(),
  order_date: z.string().optional(),
  expected_delivery: z.string().optional(),
  status: z.enum(['ordered', 'shipped', 'delivered', 'cancelled']).optional(),
  total_cost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

// Inspections
export const createInspectionSchema = z.object({
  project_id: z.string().uuid(),
  inspection_type: z.enum(['structural', 'electrical', 'plumbing', 'fire', 'final', 'other']).optional(),
  inspector_name: z.string().min(1).max(300),
  scheduled_date: z.string().min(1),
  notes: z.string().max(5000).optional(),
})

export const updateInspectionSchema = z.object({
  inspection_type: z.enum(['structural', 'electrical', 'plumbing', 'fire', 'final', 'other']).optional(),
  inspector_name: z.string().min(1).max(300).optional(),
  scheduled_date: z.string().optional(),
  result: z.enum(['pass', 'fail', 'partial', 'pending']).optional(),
  required_corrections: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
})

// Permits
export const createPermitSchema = z.object({
  project_id: z.string().uuid(),
  permit_type: z.enum(['building', 'electrical', 'plumbing', 'demolition', 'environmental', 'other']).optional(),
  permit_number: z.string().max(200).optional(),
  issued_date: z.string().optional(),
  expiry_date: z.string().optional(),
  cost: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updatePermitSchema = z.object({
  permit_type: z.enum(['building', 'electrical', 'plumbing', 'demolition', 'environmental', 'other']).optional(),
  permit_number: z.string().max(200).optional(),
  issued_date: z.string().optional(),
  expiry_date: z.string().optional(),
  cost: z.number().min(0).optional(),
  status: z.enum(['applied', 'approved', 'expired', 'rejected']).optional(),
  notes: z.string().max(5000).optional(),
})

// Crew Members
export const createCrewMemberSchema = z.object({
  name: z.string().min(1).max(300),
  role: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  hourly_rate: z.number().min(0).optional(),
  certifications: z.array(z.string()).optional(),
})

export const updateCrewMemberSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  role: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  hourly_rate: z.number().min(0).optional(),
  certifications: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

// Daily Logs
export const createDailyLogSchema = z.object({
  project_id: z.string().uuid(),
  log_date: z.string().optional(),
  weather: z.string().max(200).optional(),
  work_completed: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  author_id: z.string().uuid().optional(),
})

export const updateDailyLogSchema = z.object({
  log_date: z.string().optional(),
  weather: z.string().max(200).optional(),
  work_completed: z.string().max(5000).optional(),
  issues: z.string().max(5000).optional(),
  author_id: z.string().uuid().optional(),
})

// ============================================================
// Phase 14: Stay Extended (rate_plans, leases)
// ============================================================

export const createRatePlanSchema = z.object({
  unit_type: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  pricing_model: z.enum(['per_night', 'per_person', 'flat']).optional(),
  base_price: z.number().min(0),
  weekend_price: z.number().min(0).optional(),
  seasonal_adjustments: z.any().optional(),
  min_stay: z.number().int().min(1).optional(),
  max_stay: z.number().int().min(1).optional(),
  is_active: z.boolean().optional(),
})

export const updateRatePlanSchema = z.object({
  unit_type: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  pricing_model: z.enum(['per_night', 'per_person', 'flat']).optional(),
  base_price: z.number().min(0).optional(),
  weekend_price: z.number().min(0).nullable().optional(),
  seasonal_adjustments: z.any().optional(),
  min_stay: z.number().int().min(1).optional(),
  max_stay: z.number().int().min(1).nullable().optional(),
  is_active: z.boolean().optional(),
})

export const createLeaseSchema = z.object({
  unit_id: z.string().uuid().optional(),
  tenant_name: z.string().min(1).max(200),
  tenant_phone: z.string().max(30).optional(),
  tenant_email: z.string().email().optional(),
  lease_start: z.string().min(1),
  lease_end: z.string().optional(),
  monthly_rent: z.number().min(0),
  deposit_amount: z.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
})

export const updateLeaseSchema = z.object({
  unit_id: z.string().uuid().nullable().optional(),
  tenant_name: z.string().min(1).max(200).optional(),
  tenant_phone: z.string().max(30).nullable().optional(),
  tenant_email: z.string().email().nullable().optional(),
  lease_start: z.string().optional(),
  lease_end: z.string().nullable().optional(),
  monthly_rent: z.number().min(0).optional(),
  deposit_amount: z.number().min(0).nullable().optional(),
  status: z.enum(['active', 'expired', 'terminated']).optional(),
  notes: z.string().max(5000).nullable().optional(),
})

// ============================================================
// Phase 15: Beauty / Retail Extended (loyalty, packages, gift cards)
// ============================================================

export const createLoyaltyTransactionSchema = z.object({
  customer_id: z.string().uuid().optional(),
  points: z.number().int(),
  transaction_type: z.enum(['earn', 'redeem', 'adjust', 'expire']),
  reference_type: z.string().max(100).optional(),
  reference_id: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
})

export const updateLoyaltyTransactionSchema = z.object({
  points: z.number().int().optional(),
  transaction_type: z.enum(['earn', 'redeem', 'adjust', 'expire']).optional(),
  description: z.string().max(2000).nullable().optional(),
})

export const createPackagePurchaseSchema = z.object({
  customer_id: z.string().uuid().optional(),
  package_id: z.string().uuid().optional(),
  purchase_date: z.string().optional(),
  sessions_total: z.number().int().min(1),
  expires_at: z.string().optional(),
  amount_paid: z.number().min(0).optional(),
})

export const updatePackagePurchaseSchema = z.object({
  sessions_used: z.number().int().min(0).optional(),
  expires_at: z.string().nullable().optional(),
  status: z.enum(['active', 'expired', 'completed', 'cancelled']).optional(),
  amount_paid: z.number().min(0).optional(),
})

export const createGiftCardSchema = z.object({
  code: z.string().min(1).max(100),
  initial_balance: z.number().min(0),
  current_balance: z.number().min(0),
  customer_id: z.string().uuid().optional(),
  expires_at: z.string().optional(),
})

export const updateGiftCardSchema = z.object({
  current_balance: z.number().min(0).optional(),
  customer_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'redeemed', 'expired', 'disabled']).optional(),
  expires_at: z.string().nullable().optional(),
})

// ============================================================
// Phase 16: Retail Extended (stock transfers)
// ============================================================

export const createStockTransferSchema = z.object({
  from_location_id: z.string().uuid().optional(),
  to_location_id: z.string().uuid().optional(),
  initiated_by: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1, 'At least one item required'),
})

export const updateStockTransferSchema = z.object({
  status: z.enum(['pending', 'in_transit', 'received', 'cancelled']).optional(),
  notes: z.string().max(5000).nullable().optional(),
})
