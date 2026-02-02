/**
 * Seed script: Creates auth accounts for test delivery drivers.
 *
 * Links user_id in delivery_drivers table so drivers can log in
 * through the driver portal at /driver/login.
 *
 * Also seeds delivery_settings for test stores.
 *
 * Usage: npx tsx scripts/seed-driver-accounts.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DRIVER_EMAIL_DOMAIN = 'driver.temuulel.mn'

function phoneToDriverEmail(phone: string): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^976/, '')
  return `${cleaned}@${DRIVER_EMAIL_DOMAIN}`
}

// Test drivers from seed-deliveries.sql
const TEST_DRIVERS = [
  { id: 'd1000000-0000-0000-0000-000000000001', name: 'Болд', phone: '99112233', storeId: '5ff9f468-5066-4716-9496-bae77ea1bb80' },
  { id: 'd1000000-0000-0000-0000-000000000002', name: 'Тэмүүлэн', phone: '99223344', storeId: '5ff9f468-5066-4716-9496-bae77ea1bb80' },
  { id: 'd1000000-0000-0000-0000-000000000003', name: 'Сүхбат', phone: '99334455', storeId: '5ff9f468-5066-4716-9496-bae77ea1bb80' },
  { id: 'd1000000-0000-0000-0000-000000000004', name: 'Ганзориг', phone: '99445566', storeId: '5ff9f468-5066-4716-9496-bae77ea1bb80' },
  { id: 'd2000000-0000-0000-0000-000000000001', name: 'Батбаяр', phone: '88112233', storeId: 'e90252aa-68ee-497e-b93b-dfecae929b13' },
  { id: 'd2000000-0000-0000-0000-000000000002', name: 'Мөнхбат', phone: '88223344', storeId: 'e90252aa-68ee-497e-b93b-dfecae929b13' },
]

const DELIVERY_SETTINGS = [
  {
    storeId: '5ff9f468-5066-4716-9496-bae77ea1bb80',
    settings: {
      assignment_mode: 'auto',
      priority_rules: ['least_loaded', 'closest_driver', 'vehicle_match'],
      max_concurrent_deliveries: 3,
      assignment_radius_km: 10,
      auto_assign_on_shipped: true,
      working_hours: { start: '09:00', end: '22:00' },
    },
  },
  {
    storeId: 'e90252aa-68ee-497e-b93b-dfecae929b13',
    settings: {
      assignment_mode: 'suggest',
      priority_rules: ['least_loaded', 'rating_first'],
      max_concurrent_deliveries: 2,
      assignment_radius_km: 5,
      auto_assign_on_shipped: true,
      working_hours: { start: '08:00', end: '20:00' },
    },
  },
]

const PASSWORD = 'driver1234'

async function main() {
  console.log('🚚 Seeding driver accounts...\n')

  for (const driver of TEST_DRIVERS) {
    const email = phoneToDriverEmail(driver.phone)
    console.log(`  ${driver.name} (${driver.phone}) → ${email}`)

    // Check if driver already has user_id
    const { data: existing } = await supabase
      .from('delivery_drivers')
      .select('user_id')
      .eq('id', driver.id)
      .single()

    if (existing?.user_id) {
      console.log(`    ✓ Already linked (user_id: ${existing.user_id})`)
      continue
    }

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      console.log(`    ↳ Auth user exists (${userId})`)

      // Ensure users table row exists
      await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: driver.name,
        role: 'driver',
        is_verified: true,
        email_verified: true,
      }, { onConflict: 'id' })
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: driver.name, role: 'driver' },
      })

      if (authError) {
        console.error(`    ✗ Failed to create auth user: ${authError.message}`)
        continue
      }

      userId = authData.user.id
      console.log(`    ↳ Created auth user (${userId})`)

      // Insert into users table (must exist before FK reference)
      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: driver.name,
        role: 'driver',
        is_verified: true,
        email_verified: true,
      }, { onConflict: 'id' })

      if (userError) {
        console.error(`    ✗ Failed to insert user row: ${userError.message}`)
        continue
      }
    }

    // Link user_id to driver
    const { error: linkError } = await supabase
      .from('delivery_drivers')
      .update({ user_id: userId })
      .eq('id', driver.id)

    if (linkError) {
      console.error(`    ✗ Failed to link: ${linkError.message}`)
    } else {
      console.log(`    ✓ Linked user_id`)
    }
  }

  // Seed delivery settings
  console.log('\n⚙️  Seeding delivery settings...\n')

  for (const { storeId, settings } of DELIVERY_SETTINGS) {
    const { error } = await supabase
      .from('stores')
      .update({ delivery_settings: settings })
      .eq('id', storeId)

    if (error) {
      console.error(`  ✗ Store ${storeId}: ${error.message}`)
    } else {
      console.log(`  ✓ Store ${storeId}: ${settings.assignment_mode} mode`)
    }
  }

  console.log('\n✅ Done! Drivers can now log in at /driver/login')
  console.log('   Password for all drivers: driver1234')
  console.log('   Example: phone 99112233, password driver1234\n')
}

main().catch(console.error)
