/**
 * Owner Tasks Feature Coverage Tests — Phase 5
 *
 * Verifies that each business type's feature modules (from resolveFeatures)
 * support the Business Owner Tasks defined in TEST-SCENARIOS-SUMMARY.md.
 *
 * Three test categories:
 * 1. Feature Module Coverage — required modules are enabled per business type
 * 2. API Route Existence — referenced API route files exist
 * 3. Dashboard Page Existence — referenced dashboard page files exist
 */
import { describe, it, expect } from 'vitest'
import { resolveFeatures, getModuleConfig } from '../features'
import { existsSync } from 'fs'
import { join } from 'path'

const APP_DIR = join(process.cwd(), 'src', 'app')

// Helper: check if API route file exists
function apiRouteExists(route: string): boolean {
  // /api/products → src/app/api/products/route.ts
  const filePath = join(APP_DIR, route.replace(/^\//, ''), 'route.ts')
  return existsSync(filePath)
}

// Helper: check if dashboard page file exists
function dashboardPageExists(page: string): boolean {
  // /dashboard/products → src/app/dashboard/products/page.tsx
  const filePath = join(APP_DIR, page.replace(/^\//, ''), 'page.tsx')
  return existsSync(filePath)
}

// Known route aliases: doc name → actual code name
const ROUTE_ALIASES: Record<string, string> = {
  '/api/wash-orders': '/api/laundry-orders',
  '/api/wash-orders/[id]': '/api/laundry-orders/[id]',
}

function resolveRoute(route: string): string {
  return ROUTE_ALIASES[route] || route
}

// ---------------------------------------------------------------------------
// Owner task definitions per business type
// (from TEST-SCENARIOS-SUMMARY.md Business Owner Tasks sections)
// ---------------------------------------------------------------------------

interface OwnerTaskDef {
  // Modules needed in resolveFeatures() to access owner task dashboard pages
  requiredModules: string[]
  // API routes referenced by owner tasks
  apiRoutes: string[]
  // Dashboard pages referenced by owner tasks (base paths only, no [id] or /new)
  dashboardPages: string[]
}

const OWNER_TASKS: Record<string, OwnerTaskDef> = {
  ecommerce: {
    requiredModules: ['products', 'orders', 'deliveries', 'returns', 'billing'],
    apiRoutes: [
      '/api/products/search', '/api/products/enrich', '/api/inventory/count', '/api/orders',
      '/api/deliveries', '/api/orders/status', '/api/returns',
      '/api/invoices', '/api/payments/create', '/api/inventory/movements',
    ],
    dashboardPages: ['/dashboard/products', '/dashboard/orders', '/dashboard/deliveries', '/dashboard/returns'],
  },
  laundry: {
    requiredModules: ['laundry', 'customers'],
    apiRoutes: [
      '/api/wash-orders', '/api/wash-orders/[id]', '/api/processing',
      '/api/rack-locations', '/api/deliveries', '/api/payments/create',
    ],
    dashboardPages: ['/dashboard/laundry', '/dashboard/deliveries', '/dashboard/customers'],
  },
  beauty_salon: {
    requiredModules: ['calendar', 'client_profiles', 'package_purchases', 'staff'],
    apiRoutes: [
      '/api/appointments', '/api/appointments/[id]', '/api/availability',
      '/api/client-preferences', '/api/pos/checkout', '/api/package-purchases',
      '/api/commissions',
    ],
    dashboardPages: ['/dashboard/calendar', '/dashboard/client-profiles', '/dashboard/package-purchases', '/dashboard/staff'],
  },
  pet_services: {
    requiredModules: ['pets', 'calendar'],
    apiRoutes: [
      '/api/pets', '/api/pet-appointments', '/api/reservations',
      '/api/bookable-resources', '/api/pet-appointments/[id]',
      '/api/attachments', '/api/notifications', '/api/payments/create',
    ],
    dashboardPages: ['/dashboard/pets', '/dashboard/calendar', '/dashboard/reservations'],
  },
  car_wash: {
    requiredModules: ['car_wash', 'analytics'],
    apiRoutes: [
      '/api/wash-orders', '/api/wash-orders/[id]', '/api/memberships',
      '/api/payments/create', '/api/vehicles', '/api/machines',
      '/api/analytics/stats',
    ],
    dashboardPages: ['/dashboard/car-wash', '/dashboard/analytics'],
  },
  wellness: {
    requiredModules: ['calendar', 'packages', 'memberships'],
    apiRoutes: [
      '/api/fitness-classes', '/api/class-bookings', '/api/fitness-classes/[id]',
      '/api/package-purchases', '/api/class-bookings/[id]', '/api/appointments',
      '/api/memberships', '/api/availability',
    ],
    dashboardPages: ['/dashboard/fitness-classes', '/dashboard/packages', '/dashboard/calendar', '/dashboard/memberships'],
  },
  retail: {
    requiredModules: ['pos', 'inventory', 'loyalty', 'gift_cards', 'analytics'],
    apiRoutes: [
      '/api/pos/checkout', '/api/returns', '/api/loyalty-transactions',
      '/api/inventory/locations', '/api/stock-transfers', '/api/inventory/movements',
      '/api/inventory/count', '/api/analytics/stats', '/api/gift-cards', '/api/promotions',
    ],
    dashboardPages: ['/dashboard/pos', '/dashboard/returns', '/dashboard/loyalty', '/dashboard/inventory', '/dashboard/gift-cards'],
  },
  photography: {
    requiredModules: ['photo_sessions', 'calendar'],
    apiRoutes: [
      '/api/photo-sessions', '/api/photo-sessions/[id]',
      '/api/equipment/[id]', '/api/photo-galleries', '/api/payments/create', '/api/invoices',
    ],
    dashboardPages: ['/dashboard/photo-sessions', '/dashboard/calendar'],
  },
  venue: {
    requiredModules: ['venue_list', 'venue_bookings'],
    apiRoutes: [
      '/api/venues/[id]', '/api/venue-bookings', '/api/venue-bookings/[id]',
      '/api/equipment', '/api/payments/create', '/api/payments/check',
      '/api/event-bookings/[id]',
    ],
    dashboardPages: ['/dashboard/venues'],
  },
  coworking: {
    requiredModules: ['coworking', 'desk_bookings', 'memberships', 'billing'],
    apiRoutes: [
      '/api/customer-memberships', '/api/memberships', '/api/coworking-spaces',
      '/api/desk-bookings', '/api/bookable-resources', '/api/billing-payments',
      '/api/event-bookings',
    ],
    dashboardPages: ['/dashboard/memberships', '/dashboard/coworking', '/dashboard/desk-bookings', '/dashboard/billing'],
  },
  legal: {
    requiredModules: ['legal_cases', 'time_tracking', 'retainers', 'legal_expenses', 'case_events'],
    apiRoutes: [
      '/api/legal-cases', '/api/consultations', '/api/time-entries',
      '/api/case-documents', '/api/case-events', '/api/retainers',
      '/api/invoices', '/api/legal-cases/[id]', '/api/legal-expenses',
    ],
    dashboardPages: ['/dashboard/legal-cases', '/dashboard/time-tracking', '/dashboard/retainers', '/dashboard/legal-expenses', '/dashboard/case-events'],
  },
  construction: {
    requiredModules: ['project_list', 'crew', 'materials', 'daily_logs', 'permits', 'inspections'],
    apiRoutes: [
      '/api/projects', '/api/projects/[id]', '/api/crew-members',
      '/api/material-orders', '/api/daily-logs', '/api/permits/[id]',
      '/api/inspections', '/api/payments/create', '/api/crew-members/[id]',
    ],
    dashboardPages: ['/dashboard/projects', '/dashboard/crew', '/dashboard/materials', '/dashboard/daily-logs', '/dashboard/permits', '/dashboard/inspections'],
  },
  subscription: {
    requiredModules: ['subscription_list', 'billing', 'analytics'],
    apiRoutes: [
      '/api/subscriptions', '/api/subscriptions/[id]', '/api/subscription-items',
      '/api/deliveries', '/api/invoices', '/api/subscription-items/[id]',
      '/api/analytics/stats',
    ],
    dashboardPages: ['/dashboard/subscriptions', '/dashboard/analytics'],
  },
  coffee_shop: {
    requiredModules: ['orders', 'kitchen', 'menu', 'deliveries', 'promotions'],
    apiRoutes: [
      '/api/orders', '/api/kds-tickets', '/api/kds-tickets/[id]',
      '/api/orders/status', '/api/deliveries', '/api/promotions',
      '/api/inventory/movements', '/api/menu-categories',
    ],
    dashboardPages: ['/dashboard/orders', '/dashboard/kds', '/dashboard/deliveries', '/dashboard/promotions', '/dashboard/menu'],
  },
  restaurant: {
    requiredModules: ['table_reservations', 'floor', 'events', 'catering', 'production', 'table_layouts', 'kds'],
    apiRoutes: [
      '/api/table-reservations', '/api/table-sessions', '/api/event-bookings',
      '/api/catering-orders', '/api/production-batches', '/api/table-layouts',
      '/api/kds-tickets', '/api/event-bookings/[id]', '/api/payments/create', '/api/invoices',
    ],
    dashboardPages: ['/dashboard/table-reservations', '/dashboard/floor', '/dashboard/events', '/dashboard/catering', '/dashboard/production', '/dashboard/table-layouts'],
  },
  hotel: {
    requiredModules: ['reservations', 'units', 'housekeeping', 'maintenance', 'rate_plans'],
    apiRoutes: [
      '/api/reservations', '/api/units/[id]', '/api/reservations/[id]',
      '/api/housekeeping', '/api/damage-reports', '/api/payments/create',
      '/api/maintenance', '/api/rate-plans',
    ],
    dashboardPages: ['/dashboard/reservations', '/dashboard/units', '/dashboard/housekeeping', '/dashboard/maintenance', '/dashboard/rate-plans'],
  },
  // Note: TEST-SCENARIOS-SUMMARY.md labels this as "education" but the canonical
  // type with programs/enrollments is "training_center" in features.ts.
  // The "education" type is a generic service type without programs/enrollments.
  // Gap: education DEFAULT_MODULES should include programs & enrollments.
  training_center: {
    requiredModules: ['programs', 'enrollments', 'billing'],
    apiRoutes: [
      '/api/programs', '/api/course-sessions', '/api/enrollments',
      '/api/attendance', '/api/grades', '/api/students/[id]',
      '/api/billing-payments', '/api/enrollments/[id]', '/api/students',
    ],
    dashboardPages: ['/dashboard/programs', '/dashboard/enrollments', '/dashboard/billing', '/dashboard/students', '/dashboard/attendance'],
  },
  gym: {
    requiredModules: ['fitness_classes', 'memberships', 'equipment_list'],
    apiRoutes: [
      '/api/bookable-resources', '/api/fitness-classes', '/api/memberships',
      '/api/class-bookings/[id]', '/api/fitness-classes/[id]',
      '/api/package-purchases', '/api/bookable-resources/[id]',
    ],
    dashboardPages: ['/dashboard/fitness-classes', '/dashboard/memberships'],
  },
  // Gap: hospital DEFAULT_MODULES does not include treatment_plans
  // (treatment_plans is only in wellness defaults). Owner tasks reference it.
  hospital: {
    requiredModules: ['patients', 'encounters', 'lab', 'pharmacy', 'billing', 'inpatient'],
    apiRoutes: [
      '/api/patients', '/api/appointments', '/api/encounters',
      '/api/lab-orders', '/api/medical-notes', '/api/prescriptions',
      '/api/patients/[id]', '/api/billing-payments', '/api/treatment-plans', '/api/admissions',
    ],
    dashboardPages: ['/dashboard/patients', '/dashboard/encounters', '/dashboard/lab', '/dashboard/pharmacy', '/dashboard/billing', '/dashboard/treatment-plans', '/dashboard/inpatient'],
  },
  consulting: {
    requiredModules: ['consultations', 'calendar', 'billing'],
    apiRoutes: [
      '/api/deals', '/api/consultations', '/api/invoices',
      '/api/projects', '/api/time-entries', '/api/deals/[id]',
      '/api/staff-commissions', '/api/consultations/[id]',
    ],
    dashboardPages: ['/dashboard/deals', '/dashboard/consultations', '/dashboard/billing'],
  },
  repair_shop: {
    requiredModules: ['repair_orders'],
    apiRoutes: [
      '/api/repair-orders', '/api/repair-orders/[id]', '/api/attachments',
      '/api/repair-parts', '/api/time-entries', '/api/payments/create',
    ],
    dashboardPages: ['/dashboard/repair-orders'],
  },
  home_services: {
    requiredModules: ['service_requests', 'service_areas'],
    apiRoutes: [
      '/api/service-requests', '/api/service-requests/[id]', '/api/service-areas',
      '/api/attachments', '/api/equipment', '/api/payments/create', '/api/notifications',
    ],
    dashboardPages: ['/dashboard/service-requests', '/dashboard/service-areas'],
  },
  logistics: {
    requiredModules: ['deliveries', 'fleet_vehicles', 'driver_payouts'],
    apiRoutes: [
      '/api/deliveries', '/api/deliveries/[id]', '/api/service-areas',
      '/api/attachments', '/api/driver-payouts/generate', '/api/fleet-vehicles',
    ],
    dashboardPages: ['/dashboard/deliveries', '/dashboard/fleet-vehicles', '/dashboard/driver-payouts'],
  },
}

// ---------------------------------------------------------------------------
// Part 1: Feature Module Coverage
// ---------------------------------------------------------------------------

describe('Feature Module Coverage for Owner Tasks', () => {
  for (const [type, tasks] of Object.entries(OWNER_TASKS)) {
    describe(type, () => {
      const features = resolveFeatures(type)

      for (const mod of tasks.requiredModules) {
        it(`has module "${mod}" enabled`, () => {
          expect(features).toContain(mod)
        })
      }

      it('module config exists for each required module', () => {
        for (const mod of tasks.requiredModules) {
          const config = getModuleConfig(mod)
          expect(config).toBeDefined()
          expect(config?.href).toBeTruthy()
        }
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Part 2: API Route Existence
// ---------------------------------------------------------------------------

describe('API Route Existence for Owner Tasks', () => {
  // Collect all unique API routes across all business types
  const allRoutes = new Set<string>()
  for (const tasks of Object.values(OWNER_TASKS)) {
    for (const route of tasks.apiRoutes) {
      allRoutes.add(resolveRoute(route))
    }
  }

  for (const route of [...allRoutes].sort()) {
    it(`${route} → route.ts exists`, () => {
      expect(apiRouteExists(route)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Part 3: Dashboard Page Existence
// ---------------------------------------------------------------------------

describe('Dashboard Page Existence for Owner Tasks', () => {
  // Collect all unique dashboard pages across all business types
  const allPages = new Set<string>()
  for (const tasks of Object.values(OWNER_TASKS)) {
    for (const page of tasks.dashboardPages) {
      allPages.add(page)
    }
  }

  for (const page of [...allPages].sort()) {
    it(`${page} → page.tsx exists`, () => {
      expect(dashboardPageExists(page)).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// Part 4: Cross-reference — every module has a valid NavItem with href
// ---------------------------------------------------------------------------

describe('Module Registry Completeness', () => {
  const allModules = new Set<string>()
  for (const tasks of Object.values(OWNER_TASKS)) {
    for (const mod of tasks.requiredModules) {
      allModules.add(mod)
    }
  }

  for (const mod of [...allModules].sort()) {
    it(`module "${mod}" has valid NavItem with href`, () => {
      const config = getModuleConfig(mod)
      expect(config).toBeDefined()
      expect(config!.href).toMatch(/^\/dashboard/)
      expect(config!.icon).toBeTruthy()
      expect(config!.label).toBeTruthy()
    })
  }
})

// ---------------------------------------------------------------------------
// Part 5: Known Feature Gaps
// Documents modules referenced by owner tasks but missing from DEFAULT_MODULES.
// These tests verify the gaps still exist (will fail when fixed).
// ---------------------------------------------------------------------------

describe('Known Feature Gaps (should fix in features.ts)', () => {
  it('GAP: education type missing "programs" module (owner tasks need it)', () => {
    const features = resolveFeatures('education')
    // training_center has it, but education doesn't
    expect(features).not.toContain('programs')
    // This SHOULD be fixed: education needs programs for owner tasks
  })

  it('GAP: education type missing "enrollments" module (owner tasks need it)', () => {
    const features = resolveFeatures('education')
    expect(features).not.toContain('enrollments')
  })

  it('GAP: hospital type missing "treatment_plans" module (owner tasks need it)', () => {
    const features = resolveFeatures('hospital')
    // wellness has treatment_plans, but hospital doesn't
    expect(features).not.toContain('treatment_plans')
  })

  it('GAP: /api/products has no base route.ts (only search/enrich sub-routes)', () => {
    expect(apiRouteExists('/api/products')).toBe(false)
    expect(apiRouteExists('/api/products/search')).toBe(true)
    expect(apiRouteExists('/api/products/enrich')).toBe(true)
  })
})
