import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody, driverRegisterSchema } from '@/lib/validations'
import { phoneToDriverEmail } from '@/lib/driver-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/driver/auth/register
 *
 * Register a driver account. The driver must already exist in delivery_drivers
 * (created by the store owner). This endpoint:
 * 1. Finds the driver record by (store_id, phone) where user_id IS NULL
 * 2. Creates a Supabase auth user with synthetic email
 * 3. Inserts into the users table
 * 4. Links user_id on the delivery_drivers record
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 5, windowSeconds: 300 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Хэт олон оролдлого. Түр хүлээнэ үү.' }, { status: 429 })
  }

  const { data: body, error: validationError } = await validateBody(request, driverRegisterSchema)
  if (validationError) return validationError

  const { phone, password, name, store_id } = body
  const adminClient = createAdminClient()

  // 1. Find unlinked driver record by store + phone
  const { data: driver } = await adminClient
    .from('delivery_drivers')
    .select('id, name, user_id')
    .eq('store_id', store_id)
    .eq('phone', phone)
    .single()

  if (!driver) {
    return NextResponse.json({
      error: 'Жолоочийн бүртгэл олдсонгүй. Дэлгүүрийн эзэнтэй холбогдоно уу.',
    }, { status: 404 })
  }

  if (driver.user_id) {
    return NextResponse.json({
      error: 'Энэ жолооч аль хэдийн бүртгэгдсэн байна.',
    }, { status: 409 })
  }

  // 2. Create auth user with synthetic email
  const email = phoneToDriverEmail(phone)

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'driver', driver_name: name, store_id },
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return NextResponse.json({ error: 'Энэ утасны дугаар бүртгэгдсэн байна.' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const userId = authData.user.id

  // 3. Insert into users table
  await adminClient.from('users').insert({
    id: userId,
    email,
    phone,
    full_name: name,
    role: 'driver',
    is_verified: true,
    email_verified: true,
  })

  // 4. Link user_id on delivery_drivers
  await adminClient
    .from('delivery_drivers')
    .update({ user_id: userId })
    .eq('id', driver.id)

  return NextResponse.json({
    success: true,
    driver_id: driver.id,
    message: 'Бүртгэл амжилттай. Нэвтэрнэ үү.',
  })
}
