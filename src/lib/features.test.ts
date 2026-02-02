import { describe, it, expect } from 'vitest'
import { resolveFeatures, getNavItems, getModuleConfig, resolveBusinessType } from './features'

describe('resolveFeatures', () => {
  const ecommerceDefaults = [
    'overview', 'products', 'orders', 'deliveries', 'driver_payouts',
    'returns', 'vouchers', 'gift_cards', 'loyalty',
    'customers', 'chat', 'driver_chat',
    'billing', 'analytics', 'settings',
  ]

  it('returns ecommerce defaults when no business type provided', () => {
    const result = resolveFeatures('')
    expect(result).toEqual(ecommerceDefaults)
  })

  it('returns ecommerce defaults when null business type', () => {
    const result = resolveFeatures(null)
    expect(result).toEqual(ecommerceDefaults)
  })

  it('returns ecommerce defaults when undefined business type', () => {
    const result = resolveFeatures(undefined)
    expect(result).toEqual(ecommerceDefaults)
  })

  it('returns correct defaults for ecommerce', () => {
    const result = resolveFeatures('ecommerce')
    expect(result).toEqual(ecommerceDefaults)
  })

  it('returns correct defaults for restaurant', () => {
    const result = resolveFeatures('restaurant')
    expect(result).toEqual([
      'overview', 'floor', 'table_reservations', 'events', 'catering',
      'menu', 'kds', 'production', 'orders', 'table_layouts',
      'deliveries', 'driver_payouts', 'promotions', 'returns', 'vouchers',
      'customers', 'chat', 'driver_chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for coffee_shop', () => {
    const result = resolveFeatures('coffee_shop')
    expect(result).toEqual([
      'overview', 'menu', 'orders', 'kitchen', 'deliveries', 'driver_payouts',
      'promotions', 'returns', 'vouchers', 'customers', 'chat', 'driver_chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for cafe', () => {
    const result = resolveFeatures('cafe')
    expect(result).toEqual([
      'overview', 'menu', 'orders', 'kitchen', 'deliveries', 'driver_payouts',
      'promotions', 'returns', 'vouchers', 'customers', 'chat', 'driver_chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for beauty_salon', () => {
    const result = resolveFeatures('beauty_salon')
    expect(result).toEqual([
      'overview', 'calendar', 'services', 'staff', 'resources',
      'packages', 'memberships', 'client_profiles', 'staff_commissions',
      'loyalty', 'package_purchases',
      'returns', 'vouchers', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for fitness', () => {
    const result = resolveFeatures('fitness')
    expect(result).toEqual([
      'overview', 'calendar', 'services', 'staff', 'resources',
      'memberships', 'returns', 'vouchers', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for education', () => {
    const result = resolveFeatures('education')
    expect(result).toEqual([
      'overview', 'calendar', 'services', 'staff', 'resources',
      'returns', 'vouchers', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for services', () => {
    const result = resolveFeatures('services')
    expect(result).toEqual([
      'overview', 'calendar', 'services', 'staff', 'resources',
      'returns', 'vouchers', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for hospital', () => {
    const result = resolveFeatures('hospital')
    expect(result).toEqual([
      'overview', 'patients', 'encounters', 'lab', 'pharmacy', 'inpatient',
      'complaints_qa', 'calendar', 'services', 'staff', 'resources',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for dental_clinic', () => {
    const result = resolveFeatures('dental_clinic')
    expect(result).toEqual([
      'overview', 'patients', 'encounters', 'lab', 'pharmacy',
      'complaints_qa', 'calendar', 'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for camping_guesthouse', () => {
    const result = resolveFeatures('camping_guesthouse')
    expect(result).toEqual([
      'overview', 'calendar', 'units', 'reservations', 'guests',
      'housekeeping', 'maintenance', 'rate_plans', 'leases',
      'services', 'staff', 'resources',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for hotel', () => {
    const result = resolveFeatures('hotel')
    expect(result).toEqual([
      'overview', 'calendar', 'units', 'reservations', 'guests',
      'housekeeping', 'maintenance', 'rate_plans', 'leases',
      'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for guesthouse', () => {
    const result = resolveFeatures('guesthouse')
    expect(result).toEqual([
      'overview', 'calendar', 'units', 'reservations', 'guests',
      'housekeeping', 'maintenance', 'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for real_estate', () => {
    const result = resolveFeatures('real_estate')
    expect(result).toEqual([
      'overview', 'properties', 'calendar', 'agents', 'deals', 'commissions',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for retail', () => {
    const result = resolveFeatures('retail')
    expect(result).toEqual([
      'overview', 'products', 'orders', 'pos', 'inventory',
      'suppliers', 'purchase_orders', 'stock_transfers',
      'gift_cards', 'loyalty', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for legal', () => {
    const result = resolveFeatures('legal')
    expect(result).toEqual([
      'overview', 'legal_cases', 'case_documents', 'time_tracking',
      'case_events', 'legal_expenses', 'retainers', 'calendar',
      'staff', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for construction', () => {
    const result = resolveFeatures('construction')
    expect(result).toEqual([
      'overview', 'project_list', 'project_tasks', 'materials',
      'inspections', 'permits', 'crew', 'daily_logs',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for laundry', () => {
    const result = resolveFeatures('laundry')
    expect(result).toEqual([
      'overview', 'laundry', 'orders', 'staff',
      'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for clinic (distinct from hospital)', () => {
    const result = resolveFeatures('clinic')
    expect(result).toEqual([
      'overview', 'patients', 'encounters', 'lab', 'pharmacy',
      'complaints_qa', 'calendar', 'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
    // Clinic should NOT include inpatient or resources (unlike hospital)
    expect(result).not.toContain('inpatient')
    expect(result).not.toContain('resources')
  })

  it('returns correct defaults for training_center', () => {
    const result = resolveFeatures('training_center')
    expect(result).toEqual([
      'overview', 'programs', 'enrollments', 'calendar', 'services',
      'staff', 'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for pet_services', () => {
    const result = resolveFeatures('pet_services')
    expect(result).toEqual([
      'overview', 'pets', 'calendar', 'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for car_wash', () => {
    const result = resolveFeatures('car_wash')
    expect(result).toEqual([
      'overview', 'car_wash', 'services', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for wellness', () => {
    const result = resolveFeatures('wellness')
    expect(result).toEqual([
      'overview', 'calendar', 'services', 'staff', 'resources',
      'treatment_plans', 'packages', 'memberships',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for photography', () => {
    const result = resolveFeatures('photography')
    expect(result).toEqual([
      'overview', 'photo_sessions', 'photo_galleries', 'calendar',
      'services', 'staff', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for venue', () => {
    const result = resolveFeatures('venue')
    expect(result).toEqual([
      'overview', 'venue_list', 'venue_bookings', 'calendar',
      'services', 'staff', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for coworking', () => {
    const result = resolveFeatures('coworking')
    expect(result).toEqual([
      'overview', 'coworking', 'desk_bookings', 'calendar',
      'memberships', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for subscription', () => {
    const result = resolveFeatures('subscription')
    expect(result).toEqual([
      'overview', 'subscription_list', 'products', 'services',
      'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for gym', () => {
    const result = resolveFeatures('gym')
    expect(result).toEqual([
      'overview', 'fitness_classes', 'equipment_list', 'calendar',
      'memberships', 'staff', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for repair_shop', () => {
    const result = resolveFeatures('repair_shop')
    expect(result).toEqual([
      'overview', 'repair_orders', 'customers', 'staff',
      'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for consulting', () => {
    const result = resolveFeatures('consulting')
    expect(result).toEqual([
      'overview', 'consultations', 'calendar', 'staff',
      'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for home_services', () => {
    const result = resolveFeatures('home_services')
    expect(result).toEqual([
      'overview', 'service_requests', 'service_areas', 'calendar',
      'staff', 'customers', 'chat', 'billing', 'analytics', 'settings',
    ])
  })

  it('returns correct defaults for logistics', () => {
    const result = resolveFeatures('logistics')
    expect(result).toEqual([
      'overview', 'fleet_vehicles', 'trip_logs', 'deliveries',
      'driver_payouts', 'staff', 'customers', 'chat',
      'billing', 'analytics', 'settings',
    ])
  })

  it('falls back to ecommerce for unknown business types', () => {
    const result = resolveFeatures('unknown_type')
    expect(result).toEqual(ecommerceDefaults)
  })

  it('applies module overrides: enables a disabled module', () => {
    // 'pos' is not in ecommerce defaults; enabling it should add it
    const result = resolveFeatures('ecommerce', { pos: true })
    expect(result).toContain('pos')
    // All original defaults should still be present
    for (const mod of ecommerceDefaults) {
      expect(result).toContain(mod)
    }
  })

  it('applies module overrides: disables an enabled module', () => {
    // 'billing' is in ecommerce defaults; disabling it should remove it
    const result = resolveFeatures('ecommerce', { billing: false })
    expect(result).not.toContain('billing')
    // Other defaults should still be present
    for (const mod of ecommerceDefaults.filter(m => m !== 'billing')) {
      expect(result).toContain(mod)
    }
  })

  it('returns defaults when enabledModules is null', () => {
    const result = resolveFeatures('ecommerce', null)
    expect(result).toEqual(ecommerceDefaults)
  })

  it('handles empty overrides object', () => {
    const result = resolveFeatures('ecommerce', {})
    expect(result).toEqual(ecommerceDefaults)
  })
})

describe('getNavItems', () => {
  it('returns correct nav items for a list of feature strings', () => {
    const result = getNavItems(['overview', 'products', 'chat'])
    expect(result).toEqual([
      { href: '/dashboard', icon: '📊', label: 'Тойм' },
      { href: '/dashboard/products', icon: '📦', label: 'Бүтээгдэхүүн' },
      { href: '/dashboard/chat', icon: '💬', label: 'Чат' },
    ])
  })

  it('returns empty array for empty features', () => {
    const result = getNavItems([])
    expect(result).toEqual([])
  })

  it('skips unknown feature strings', () => {
    const result = getNavItems(['overview', 'nonexistent_module', 'chat'])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ href: '/dashboard', icon: '📊', label: 'Тойм' })
    expect(result[1]).toEqual({ href: '/dashboard/chat', icon: '💬', label: 'Чат' })
  })

  it('each returned item has href, icon, and label properties', () => {
    const features = resolveFeatures('ecommerce')
    const items = getNavItems(features)
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item).toHaveProperty('href')
      expect(item).toHaveProperty('icon')
      expect(item).toHaveProperty('label')
      expect(typeof item.href).toBe('string')
      expect(typeof item.icon).toBe('string')
      expect(typeof item.label).toBe('string')
    }
  })
})

describe('getModuleConfig', () => {
  it('returns config for known modules', () => {
    const config = getModuleConfig('overview')
    expect(config).toEqual({ href: '/dashboard', icon: '📊', label: 'Тойм' })

    const chatConfig = getModuleConfig('chat')
    expect(chatConfig).toEqual({ href: '/dashboard/chat', icon: '💬', label: 'Чат' })

    const posConfig = getModuleConfig('pos')
    expect(posConfig).toEqual({ href: '/dashboard/pos', icon: '💳', label: 'POS' })
  })

  it('returns undefined for unknown modules', () => {
    const config = getModuleConfig('nonexistent_module')
    expect(config).toBeUndefined()
  })
})

describe('resolveBusinessType', () => {
  it('resolves commerce to ecommerce', () => {
    expect(resolveBusinessType('commerce')).toBe('ecommerce')
  })

  it('resolves shop to ecommerce', () => {
    expect(resolveBusinessType('shop')).toBe('ecommerce')
  })

  it('resolves beauty to beauty_salon', () => {
    expect(resolveBusinessType('beauty')).toBe('beauty_salon')
  })

  it('resolves pet to pet_services', () => {
    expect(resolveBusinessType('pet')).toBe('pet_services')
  })

  it('resolves veterinary to pet_services', () => {
    expect(resolveBusinessType('veterinary')).toBe('pet_services')
  })

  it('resolves carwash to car_wash', () => {
    expect(resolveBusinessType('carwash')).toBe('car_wash')
  })

  it('resolves qsr to coffee_shop', () => {
    expect(resolveBusinessType('qsr')).toBe('coffee_shop')
  })

  it('resolves stay to hotel', () => {
    expect(resolveBusinessType('stay')).toBe('hotel')
  })

  it('resolves camping to camping_guesthouse', () => {
    expect(resolveBusinessType('camping')).toBe('camping_guesthouse')
  })

  it('resolves sports to gym', () => {
    expect(resolveBusinessType('sports')).toBe('gym')
  })

  it('resolves medical to hospital', () => {
    expect(resolveBusinessType('medical')).toBe('hospital')
  })

  it('resolves proservices to consulting', () => {
    expect(resolveBusinessType('proservices')).toBe('consulting')
  })

  it('resolves realtor to real_estate', () => {
    expect(resolveBusinessType('realtor')).toBe('real_estate')
  })

  it('resolves repair to repair_shop', () => {
    expect(resolveBusinessType('repair')).toBe('repair_shop')
  })

  it('resolves electronics_repair to repair_shop', () => {
    expect(resolveBusinessType('electronics_repair')).toBe('repair_shop')
  })

  it('resolves homeservices to home_services', () => {
    expect(resolveBusinessType('homeservices')).toBe('home_services')
  })

  it('resolves moving to home_services', () => {
    expect(resolveBusinessType('moving')).toBe('home_services')
  })

  it('resolves courier to logistics', () => {
    expect(resolveBusinessType('courier')).toBe('logistics')
  })

  it('resolves fleet to logistics', () => {
    expect(resolveBusinessType('fleet')).toBe('logistics')
  })

  it('resolves dry_cleaning to laundry', () => {
    expect(resolveBusinessType('dry_cleaning')).toBe('laundry')
  })

  it('resolves laundry_service to laundry', () => {
    expect(resolveBusinessType('laundry_service')).toBe('laundry')
  })

  it('resolves event_venue to venue', () => {
    expect(resolveBusinessType('event_venue')).toBe('venue')
  })

  it('resolves coworking_space to coworking', () => {
    expect(resolveBusinessType('coworking_space')).toBe('coworking')
  })

  it('resolves subscription_box to subscription', () => {
    expect(resolveBusinessType('subscription_box')).toBe('subscription')
  })

  it('resolves photography_studio to photography', () => {
    expect(resolveBusinessType('photography_studio')).toBe('photography')
  })

  it('resolves general_contractor to construction', () => {
    expect(resolveBusinessType('general_contractor')).toBe('construction')
  })

  it('resolves yoga to wellness', () => {
    expect(resolveBusinessType('yoga')).toBe('wellness')
  })

  it('returns canonical types unchanged', () => {
    expect(resolveBusinessType('ecommerce')).toBe('ecommerce')
    expect(resolveBusinessType('restaurant')).toBe('restaurant')
    expect(resolveBusinessType('hotel')).toBe('hotel')
    expect(resolveBusinessType('legal')).toBe('legal')
    expect(resolveBusinessType('clinic')).toBe('clinic')
  })

  it('returns unknown types unchanged', () => {
    expect(resolveBusinessType('some_new_type')).toBe('some_new_type')
  })
})

describe('resolveFeatures with aliases', () => {
  it('commerce resolves to ecommerce features', () => {
    expect(resolveFeatures('commerce')).toEqual(resolveFeatures('ecommerce'))
  })

  it('shop resolves to ecommerce features', () => {
    expect(resolveFeatures('shop')).toEqual(resolveFeatures('ecommerce'))
  })

  it('beauty resolves to beauty_salon features', () => {
    expect(resolveFeatures('beauty')).toEqual(resolveFeatures('beauty_salon'))
  })

  it('medical resolves to hospital features', () => {
    expect(resolveFeatures('medical')).toEqual(resolveFeatures('hospital'))
  })

  it('qsr resolves to coffee_shop features', () => {
    expect(resolveFeatures('qsr')).toEqual(resolveFeatures('coffee_shop'))
  })

  it('stay resolves to hotel features', () => {
    expect(resolveFeatures('stay')).toEqual(resolveFeatures('hotel'))
  })

  it('camping resolves to camping_guesthouse features', () => {
    expect(resolveFeatures('camping')).toEqual(resolveFeatures('camping_guesthouse'))
  })

  it('sports resolves to gym features', () => {
    expect(resolveFeatures('sports')).toEqual(resolveFeatures('gym'))
  })

  it('pet resolves to pet_services features', () => {
    expect(resolveFeatures('pet')).toEqual(resolveFeatures('pet_services'))
  })

  it('carwash resolves to car_wash features', () => {
    expect(resolveFeatures('carwash')).toEqual(resolveFeatures('car_wash'))
  })

  it('repair resolves to repair_shop features', () => {
    expect(resolveFeatures('repair')).toEqual(resolveFeatures('repair_shop'))
  })

  it('proservices resolves to consulting features', () => {
    expect(resolveFeatures('proservices')).toEqual(resolveFeatures('consulting'))
  })

  it('realtor resolves to real_estate features', () => {
    expect(resolveFeatures('realtor')).toEqual(resolveFeatures('real_estate'))
  })

  it('homeservices resolves to home_services features', () => {
    expect(resolveFeatures('homeservices')).toEqual(resolveFeatures('home_services'))
  })

  it('courier resolves to logistics features', () => {
    expect(resolveFeatures('courier')).toEqual(resolveFeatures('logistics'))
  })

  it('fleet resolves to logistics features', () => {
    expect(resolveFeatures('fleet')).toEqual(resolveFeatures('logistics'))
  })

  it('dry_cleaning resolves to laundry features', () => {
    expect(resolveFeatures('dry_cleaning')).toEqual(resolveFeatures('laundry'))
  })

  it('event_venue resolves to venue features', () => {
    expect(resolveFeatures('event_venue')).toEqual(resolveFeatures('venue'))
  })

  it('coworking_space resolves to coworking features', () => {
    expect(resolveFeatures('coworking_space')).toEqual(resolveFeatures('coworking'))
  })

  it('subscription_box resolves to subscription features', () => {
    expect(resolveFeatures('subscription_box')).toEqual(resolveFeatures('subscription'))
  })

  it('photography_studio resolves to photography features', () => {
    expect(resolveFeatures('photography_studio')).toEqual(resolveFeatures('photography'))
  })

  it('general_contractor resolves to construction features', () => {
    expect(resolveFeatures('general_contractor')).toEqual(resolveFeatures('construction'))
  })

  it('yoga resolves to wellness features', () => {
    expect(resolveFeatures('yoga')).toEqual(resolveFeatures('wellness'))
  })

  it('law_firm resolves to legal features', () => {
    expect(resolveFeatures('law_firm')).toEqual(resolveFeatures('legal'))
  })

  it('clinic is its own canonical type (not aliased to hospital)', () => {
    const clinicFeatures = resolveFeatures('clinic')
    const hospitalFeatures = resolveFeatures('hospital')
    expect(clinicFeatures).not.toEqual(hospitalFeatures)
    // Clinic should not include inpatient
    expect(clinicFeatures).not.toContain('inpatient')
    expect(hospitalFeatures).toContain('inpatient')
  })
})
