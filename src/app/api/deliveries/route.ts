import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createDeliverySchema, parsePagination } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'
import { calculateDeliveryFee } from '@/lib/delivery-fee-calculator'
import type { Database } from '@/lib/database.types'

function generateDeliveryNumber(): string {
  return `DEL-${Date.now()}`
}

/**
 * GET /api/deliveries
 *
 * List deliveries for the authenticated user's store.
 * Supports filtering by status, driver_id, delivery_type.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const driverId = searchParams.get('driver_id')
  const deliveryType = searchParams.get('delivery_type')
  const search = searchParams.get('search')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('deliveries')
    .select(`
      id, delivery_number, status, delivery_type, provider_name,
      delivery_address, customer_name, customer_phone,
      estimated_delivery_time, actual_delivery_time,
      delivery_fee, notes, failure_reason, created_at, updated_at,
      orders(id, order_number, total_amount),
      delivery_drivers(id, name, phone, vehicle_type)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status as Database['public']['Tables']['deliveries']['Row']['status'])
  }
  if (driverId) {
    query = query.eq('driver_id', driverId)
  }
  if (deliveryType) {
    query = query.eq('delivery_type', deliveryType as Database['public']['Tables']['deliveries']['Row']['delivery_type'])
  }
  if (search) {
    query = query.or(`delivery_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
  }

  const { data: deliveries, error, count } = await query.range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deliveries: deliveries ?? [], count: count ?? 0, limit, offset })
}

/**
 * POST /api/deliveries
 *
 * Create a new delivery. Can be linked to an order or standalone.
 * If driver_id is provided, status starts as 'assigned', otherwise 'pending'.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, createDeliverySchema)
  if (validationError) return validationError

  const {
    order_id, driver_id, delivery_type, provider_name, provider_tracking_id,
    pickup_address, delivery_address, customer_name, customer_phone,
    estimated_delivery_time, delivery_fee, notes,
    scheduled_date, scheduled_time_slot,
  } = body

  // Verify order belongs to store if provided
  let orderNumber = ''
  if (order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('id', order_id)
      .eq('store_id', store.id)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    orderNumber = order.order_number || ''
  }

  // Verify driver belongs to store if provided
  let driverName = ''
  if (driver_id) {
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('id, name')
      .eq('id', driver_id)
      .eq('store_id', store.id)
      .single()

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    }
    driverName = driver.name
  }

  // Auto-calculate delivery fee if not provided
  const calculatedFee = (!delivery_fee && delivery_fee !== 0)
    ? calculateDeliveryFee(delivery_address).fee
    : delivery_fee

  const initialStatus = driver_id ? 'assigned' : 'pending'
  const deliveryNumber = generateDeliveryNumber()

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .insert({
      store_id: store.id,
      order_id: order_id || null,
      driver_id: driver_id || null,
      delivery_number: deliveryNumber,
      status: initialStatus,
      delivery_type: delivery_type || 'own_driver',
      provider_name: provider_name || null,
      provider_tracking_id: provider_tracking_id || null,
      pickup_address: pickup_address || null,
      delivery_address,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      estimated_delivery_time: estimated_delivery_time || null,
      delivery_fee: calculatedFee ?? null,
      notes: notes || null,
      scheduled_date: scheduled_date || null,
      scheduled_time_slot: scheduled_time_slot || null,
    } as Database['public']['Tables']['deliveries']['Insert'])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log initial status
  await supabase.from('delivery_status_log').insert({
    delivery_id: delivery.id,
    status: initialStatus,
    changed_by: 'system',
    notes: 'Delivery created',
  })

  // Update driver status if assigned
  if (driver_id) {
    await supabase
      .from('delivery_drivers')
      .update({ status: 'on_delivery', updated_at: new Date().toISOString() })
      .eq('id', driver_id)

    // Dispatch notification
    dispatchNotification(store.id, 'delivery_assigned', {
      delivery_id: delivery.id,
      delivery_number: deliveryNumber,
      driver_name: driverName,
      order_number: orderNumber,
    })
  }

  return NextResponse.json({ delivery }, { status: 201 })
}
