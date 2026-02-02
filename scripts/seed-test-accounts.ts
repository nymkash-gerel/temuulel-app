/**
 * Seed script: Creates 23 test business accounts matching test-scenarios data.
 *
 * Each account gets:
 * - A Supabase auth user (email/password)
 * - A public.users record
 * - A store with business_type, description, chatbot settings
 *
 * Products, services, staff, etc. are entered manually using the
 * test-scenarios/*.md files as reference.
 *
 * Usage: npx tsx scripts/seed-test-accounts.ts
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

// ============================================================================
// Test account definitions (matching test-scenarios/00-MASTER-CREDENTIALS.md)
// ============================================================================

interface TestAccount {
  username: string
  email: string
  password: string
  slug: string
  storeName: string
  businessType: string
  description: string
  phone: string
  chatbotSettings: Record<string, unknown>
}

const TEST_ACCOUNTS: TestAccount[] = [
  // 1. Commerce (Online Shop)
  {
    username: 'commerce_test',
    email: 'test@commerce.temuulel.mn',
    password: 'Test123456!',
    slug: 'commerce-test',
    storeName: 'Urban Style Boutique',
    businessType: 'ecommerce',
    description: 'Trendy clothing and accessories for modern urbanites',
    phone: '+976 9999 1001',
    chatbotSettings: {
      welcome_message: 'Welcome to Urban Style Boutique! How can I help you today?',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 2. Dry Cleaning
  {
    username: 'laundry_test',
    email: 'test@laundry.temuulel.mn',
    password: 'Test123456!',
    slug: 'laundry-test',
    storeName: 'Premium Dry Cleaners',
    businessType: 'laundry',
    description: 'Professional dry cleaning and laundry services with pickup and delivery',
    phone: '+976 9999 1002',
    chatbotSettings: {
      welcome_message: 'Welcome to Premium Dry Cleaners! Ask about our services, pricing, or schedule a pickup.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 3. Beauty Salon
  {
    username: 'beauty_test',
    email: 'test@beauty.temuulel.mn',
    password: 'Test123456!',
    slug: 'beauty-test',
    storeName: 'Glamour Beauty Salon',
    businessType: 'beauty_salon',
    description: 'Full-service beauty salon: hair, nails, spa, and makeup',
    phone: '+976 9999 1003',
    chatbotSettings: {
      welcome_message: 'Welcome to Glamour Beauty Salon! Book appointments, check services, or ask about availability.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 4. Pet Services
  {
    username: 'pet_test',
    email: 'test@pet.temuulel.mn',
    password: 'Test123456!',
    slug: 'pet-test',
    storeName: 'Happy Paws Pet Center',
    businessType: 'pet_services',
    description: 'Complete pet care: grooming, boarding, daycare, and veterinary referrals',
    phone: '+976 9999 1004',
    chatbotSettings: {
      welcome_message: 'Welcome to Happy Paws! How can we help you and your furry friend?',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 5. Car Wash
  {
    username: 'carwash_test',
    email: 'test@carwash.temuulel.mn',
    password: 'Test123456!',
    slug: 'carwash-test',
    storeName: 'Shine Auto Spa',
    businessType: 'car_wash',
    description: 'Professional car wash and auto detailing services',
    phone: '+976 9999 1005',
    chatbotSettings: {
      welcome_message: 'Welcome to Shine Auto Spa! Check our wash packages and detailing services.',
      tone: 'casual',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 6. Wellness / Fitness
  {
    username: 'wellness_test',
    email: 'test@wellness.temuulel.mn',
    password: 'Test123456!',
    slug: 'wellness-test',
    storeName: 'Zen Wellness Studio',
    businessType: 'wellness',
    description: 'Yoga, pilates, personal training, and wellness programs',
    phone: '+976 9999 1006',
    chatbotSettings: {
      welcome_message: 'Welcome to Zen Wellness Studio! Explore classes, packages, and private sessions.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 7. Retail Store
  {
    username: 'retail_test',
    email: 'test@retail.temuulel.mn',
    password: 'Test123456!',
    slug: 'retail-test',
    storeName: 'Urban Mart',
    businessType: 'retail',
    description: 'General retail store with POS, loyalty program, and multi-location inventory',
    phone: '+976 9999 1007',
    chatbotSettings: {
      welcome_message: 'Welcome to Urban Mart! Ask about products, stock, loyalty points, or returns.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 8. Photography Studio
  {
    username: 'photo_test',
    email: 'test@photo.temuulel.mn',
    password: 'Test123456!',
    slug: 'photo-test',
    storeName: 'Moments Photography Studio',
    businessType: 'photography',
    description: 'Professional photography for weddings, portraits, corporate events, and families',
    phone: '+976 9900 8001',
    chatbotSettings: {
      welcome_message: 'Welcome to Moments Photography! Book sessions, check packages, or view our work.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 9. Event Venue
  {
    username: 'venue_test',
    email: 'test@venue.temuulel.mn',
    password: 'Test123456!',
    slug: 'venue-test',
    storeName: 'Grand Hall Events',
    businessType: 'venue',
    description: 'Premium event venue for weddings, corporate events, and celebrations',
    phone: '+976 7700 9001',
    chatbotSettings: {
      welcome_message: 'Welcome to Grand Hall Events! Check availability, packages, and event planning services.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 10. Coworking Space
  {
    username: 'cowork_test',
    email: 'test@cowork.temuulel.mn',
    password: 'Test123456!',
    slug: 'cowork-test',
    storeName: 'WorkHub Coworking',
    businessType: 'coworking',
    description: 'Modern coworking space with hot desks, private offices, and meeting rooms',
    phone: '+976 7700 1001',
    chatbotSettings: {
      welcome_message: 'Welcome to WorkHub! Explore membership plans, desk booking, and meeting room availability.',
      tone: 'casual',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 11. Legal Services
  {
    username: 'legal_test',
    email: 'test@legal.temuulel.mn',
    password: 'Test123456!',
    slug: 'legal-test',
    storeName: 'Bataar & Associates Law Firm',
    businessType: 'legal',
    description: 'Full-service law firm specializing in corporate, family, and property law',
    phone: '+976 7700 1101',
    chatbotSettings: {
      welcome_message: 'Welcome to Bataar & Associates. Schedule a consultation or inquire about our legal services.',
      tone: 'professional',
      language: 'english',
      show_product_prices: false,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 12. Construction
  {
    username: 'construction_test',
    email: 'test@construction.temuulel.mn',
    password: 'Test123456!',
    slug: 'construction-test',
    storeName: 'BuildRight Construction',
    businessType: 'construction',
    description: 'Full-service construction and contracting. Residential and commercial projects.',
    phone: '+976 9900 1201',
    chatbotSettings: {
      welcome_message: 'Welcome to BuildRight Construction! Ask about estimates, project timelines, or our services.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 13. Subscription Box
  {
    username: 'subscription_test',
    email: 'test@subscription.temuulel.mn',
    password: 'Test123456!',
    slug: 'subscription-test',
    storeName: 'MN Box Monthly',
    businessType: 'subscription',
    description: 'Curated monthly subscription boxes featuring Mongolian artisan products',
    phone: '+976 9900 1301',
    chatbotSettings: {
      welcome_message: 'Welcome to MN Box Monthly! Explore our subscription plans, check your box status, or gift a subscription.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 14. Coffee Shop (QSR)
  {
    username: 'qsr_test',
    email: 'test@qsr.temuulel.mn',
    password: 'Test123456!',
    slug: 'qsr-test',
    storeName: 'Nomad Coffee Co.',
    businessType: 'coffee_shop',
    description: 'Specialty coffee shop and bakery with house-roasted beans and pastries',
    phone: '+976 7700 1401',
    chatbotSettings: {
      welcome_message: 'Welcome to Nomad Coffee Co.! Check our menu, order for pickup, or ask about our specials.',
      tone: 'casual',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 15. Restaurant
  {
    username: 'restaurant_test',
    email: 'test@restaurant.temuulel.mn',
    password: 'Test123456!',
    slug: 'restaurant-test',
    storeName: 'Silk Road Restaurant',
    businessType: 'restaurant',
    description: 'Upscale Mongolian and Central Asian fusion restaurant with private dining and catering',
    phone: '+976 7700 1501',
    chatbotSettings: {
      welcome_message: 'Welcome to Silk Road Restaurant! Make a reservation, browse our menu, or ask about catering.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 16. Hotel (Stay)
  {
    username: 'stay_test',
    email: 'test@stay.temuulel.mn',
    password: 'Test123456!',
    slug: 'stay-test',
    storeName: 'Steppe Inn Hotel',
    businessType: 'hotel',
    description: 'Comfortable boutique hotel in central Ulaanbaatar with modern amenities',
    phone: '+976 7011 6001',
    chatbotSettings: {
      welcome_message: 'Welcome to Steppe Inn Hotel! Check availability, make a reservation, or ask about our amenities.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 17. Education
  {
    username: 'education_test',
    email: 'test@education.temuulel.mn',
    password: 'Test123456!',
    slug: 'education-test',
    storeName: 'Smart Learning Center',
    businessType: 'education',
    description: 'Educational courses and professional training programs',
    phone: '+976 7700 1701',
    chatbotSettings: {
      welcome_message: 'Welcome to Smart Learning Center! Explore our courses, enrollment, and schedules.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 18. Sports Center
  {
    username: 'sports_test',
    email: 'test@sports.temuulel.mn',
    password: 'Test123456!',
    slug: 'sports-test',
    storeName: 'Active Life Sports Complex',
    businessType: 'gym',
    description: 'Multi-sport facility with courts, pool, gym, and fitness classes',
    phone: '+976 7700 1801',
    chatbotSettings: {
      welcome_message: 'Welcome to Active Life Sports Complex! Check facilities, book courts, or explore memberships.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 19. Medical Clinic
  {
    username: 'medical_test',
    email: 'test@medical.temuulel.mn',
    password: 'Test123456!',
    slug: 'medical-test',
    storeName: 'HealthFirst Clinic',
    businessType: 'hospital',
    description: 'Multi-specialty medical clinic with lab, pharmacy, and specialist consultations',
    phone: '+976 7700 1901',
    chatbotSettings: {
      welcome_message: 'Welcome to HealthFirst Clinic. Schedule appointments, check lab results, or ask about our services.',
      tone: 'professional',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 20. Consulting / Pro Services
  {
    username: 'proservices_test',
    email: 'test@proservices.temuulel.mn',
    password: 'Test123456!',
    slug: 'proservices-test',
    storeName: 'Elite Consulting Group',
    businessType: 'consulting',
    description: 'Full-service management consulting for startups, SMEs, and corporations',
    phone: '+976 9999 2001',
    chatbotSettings: {
      welcome_message: 'Welcome to Elite Consulting Group. Schedule a consultation or inquire about our services.',
      tone: 'professional',
      language: 'english',
      show_product_prices: false,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 21. Auto Repair
  {
    username: 'repair_test',
    email: 'test@repair.temuulel.mn',
    password: 'Test123456!',
    slug: 'repair-test',
    storeName: 'QuickFix Auto Repair',
    businessType: 'repair_shop',
    description: 'Auto repair and maintenance. Diagnostics, engine, brakes, and more.',
    phone: '+976 9999 2101',
    chatbotSettings: {
      welcome_message: 'Welcome to QuickFix Auto Repair! Ask about services, get a quote, or check repair status.',
      tone: 'casual',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 22. Home Services (Cleaning)
  {
    username: 'homeservices_test',
    email: 'test@homeservices.temuulel.mn',
    password: 'Test123456!',
    slug: 'homeservices-test',
    storeName: 'Sparkle Home Services',
    businessType: 'home_services',
    description: 'Professional home cleaning, maintenance, and handyman services',
    phone: '+976 9999 2201',
    chatbotSettings: {
      welcome_message: 'Welcome to Sparkle Home Services! Book a cleaning, schedule maintenance, or get a quote.',
      tone: 'friendly',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
  // 23. Logistics (Courier)
  {
    username: 'logistics_test',
    email: 'test@logistics.temuulel.mn',
    password: 'Test123456!',
    slug: 'logistics-test',
    storeName: 'Swift Delivery Service',
    businessType: 'logistics',
    description: 'Same-day and scheduled delivery service across Ulaanbaatar',
    phone: '+976 9999 2301',
    chatbotSettings: {
      welcome_message: 'Welcome to Swift Delivery! Request a pickup, track your delivery, or get a price quote.',
      tone: 'casual',
      language: 'english',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
    },
  },
]

// ============================================================================
// Seed functions
// ============================================================================

async function createUser(email: string, password: string): Promise<string> {
   
  const { data: existing } = await supabase.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = existing?.users?.find((u: any) => u.email === email)
  if (found) {
    console.log(`  ~ User ${email} already exists (${found.id})`)
    await ensurePublicUser(found.id, email)
    return found.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`)
  console.log(`  + User created: ${email} (${data.user.id})`)

  await ensurePublicUser(data.user.id, email)
  return data.user.id
}

async function ensurePublicUser(userId: string, email: string): Promise<void> {
  const { data: existingPublic } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existingPublic) return

  const { error } = await supabase.from('users').insert({
    id: userId,
    email,
    role: 'owner',
    is_verified: true,
    email_verified: true,
  })
  if (error) throw new Error(`Failed to create public user ${email}: ${error.message}`)
  console.log(`  + Public user record created`)
}

async function createStore(userId: string, account: TestAccount): Promise<string> {
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', account.slug)
    .single()

  if (existing) {
    await supabase
      .from('stores')
      .update({
        name: account.storeName,
        business_type: account.businessType,
        description: account.description,
        phone: account.phone,
        chatbot_settings: account.chatbotSettings,
        ai_auto_reply: true,
      })
      .eq('id', existing.id)
    console.log(`  ~ Store updated: ${account.storeName} (${existing.id})`)
    return existing.id
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      owner_id: userId,
      name: account.storeName,
      slug: account.slug,
      business_type: account.businessType,
      description: account.description,
      phone: account.phone,
      chatbot_settings: account.chatbotSettings,
      ai_auto_reply: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create store ${account.storeName}: ${error.message}`)
  console.log(`  + Store created: ${account.storeName} (${data.id})`)
  return data.id
}

async function createStoreMember(storeId: string, userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', storeId)
    .eq('user_id', userId)
    .single()

  if (existing) return

  const { error } = await supabase.from('store_members').insert({
    store_id: storeId,
    user_id: userId,
    role: 'owner',
  })
  if (error && !error.message.includes('duplicate')) {
    console.warn(`  ! Warning: store_members insert: ${error.message}`)
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Seeding 23 Test Business Accounts ===\n')
  console.log(`Supabase URL: ${SUPABASE_URL}\n`)

  let success = 0
  let failed = 0

  for (let i = 0; i < TEST_ACCOUNTS.length; i++) {
    const account = TEST_ACCOUNTS[i]
    console.log(`[${i + 1}/23] ${account.storeName} (${account.businessType})`)

    try {
      const userId = await createUser(account.email, account.password)
      const storeId = await createStore(userId, account)
      await createStoreMember(storeId, userId)
      success++
      console.log(`  OK\n`)
    } catch (err) {
      failed++
      console.error(`  FAIL: ${(err as Error).message}\n`)
    }
  }

  console.log('=== Summary ===')
  console.log(`Success: ${success}/23`)
  if (failed > 0) console.log(`Failed: ${failed}/23`)

  console.log('\n=== Test Account Credentials ===\n')
  console.log('Password for all accounts: Test123456!\n')
  console.log('| # | Type | Store | Email |')
  console.log('|---|------|-------|-------|')
  TEST_ACCOUNTS.forEach((a, i) => {
    console.log(`| ${i + 1} | ${a.businessType} | ${a.storeName} | ${a.email} |`)
  })

  console.log('\nNext steps:')
  console.log('1. Log in with any account above')
  console.log('2. Use test-scenarios/*.md files to manually enter detailed data')
  console.log('3. Test customer chat scenarios from TEST-SCENARIOS-SUMMARY.md')
}

main().catch(console.error)
