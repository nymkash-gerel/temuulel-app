/**
 * Feature flag system for business-type-specific module resolution.
 * Replaces hardcoded nav arrays in DashboardLayout.
 */

export interface NavItem {
  href: string
  icon: string
  label: string
}

// Module definitions: all possible modules across all verticals
const MODULE_REGISTRY: Record<string, NavItem> = {
  overview:       { href: '/dashboard',              icon: '📊', label: 'Тойм' },
  products:       { href: '/dashboard/products',     icon: '📦', label: 'Бүтээгдэхүүн' },
  menu:           { href: '/dashboard/menu',         icon: '🍽️', label: 'Меню' },
  properties:     { href: '/dashboard/products',     icon: '🏠', label: 'Зар' },
  orders:         { href: '/dashboard/orders',       icon: '🛒', label: 'Захиалга' },
  calendar:       { href: '/dashboard/calendar',     icon: '📅', label: 'Цагийн хуваарь' },
  services:       { href: '/dashboard/services',     icon: '💅', label: 'Үйлчилгээ' },
  staff:          { href: '/dashboard/staff',        icon: '👩‍💼', label: 'Ажилтан' },
  agents:         { href: '/dashboard/staff',        icon: '👩‍💼', label: 'Агентууд' },
  resources:      { href: '/dashboard/resources',    icon: '🪑', label: 'Нөөц' },
  deals:          { href: '/dashboard/deals',        icon: '📋', label: 'Хэлцэл' },
  commissions:    { href: '/dashboard/commissions',  icon: '💰', label: 'Комисс' },
  deliveries:     { href: '/dashboard/deliveries',   icon: '🚚', label: 'Хүргэлт' },
  driver_payouts: { href: '/dashboard/driver-payouts', icon: '💸', label: 'Жолоочийн төлбөр' },
  returns:        { href: '/dashboard/returns',      icon: '↩️', label: 'Буцаалт' },
  vouchers:       { href: '/dashboard/vouchers',     icon: '🎫', label: 'Ваучер' },
  customers:      { href: '/dashboard/customers',    icon: '👥', label: 'Үйлчлүүлэгч' },
  chat:           { href: '/dashboard/chat',         icon: '💬', label: 'Чат' },
  driver_chat:    { href: '/dashboard/driver-chat',  icon: '🗨️', label: 'Жолоочтой чат' },
  billing:        { href: '/dashboard/billing',      icon: '🧾', label: 'Нэхэмжлэл' },
  analytics:      { href: '/dashboard/analytics',    icon: '📈', label: 'Тайлан' },
  settings:       { href: '/dashboard/settings',     icon: '⚙️', label: 'Тохиргоо' },
  // QSR / Restaurant
  kitchen:        { href: '/dashboard/kitchen',      icon: '👨‍🍳', label: 'Гал тогоо' },
  promotions:     { href: '/dashboard/promotions',   icon: '🏷️', label: 'Урамшуулал' },
  floor:          { href: '/dashboard/floor',         icon: '🪑', label: 'Зааланд' },
  events:         { href: '/dashboard/events',        icon: '🎉', label: 'Арга хэмжээ' },
  catering:       { href: '/dashboard/catering',      icon: '🍽️', label: 'Кейтэринг' },
  kds:            { href: '/dashboard/kds',            icon: '📺', label: 'KDS' },
  production:     { href: '/dashboard/production',    icon: '🏭', label: 'Бэлтгэл' },
  // Beauty
  packages:       { href: '/dashboard/packages',     icon: '📦', label: 'Багц' },
  memberships:    { href: '/dashboard/memberships',  icon: '🎫', label: 'Гишүүнчлэл' },
  client_profiles: { href: '/dashboard/client-profiles', icon: '💇', label: 'Үйлчлүүлэгч' },
  staff_commissions: { href: '/dashboard/staff-commissions', icon: '💰', label: 'Комисс' },
  // Stay
  units:          { href: '/dashboard/units',        icon: '🏨', label: 'Өрөө' },
  guests:         { href: '/dashboard/guests',       icon: '🧳', label: 'Зочин' },
  reservations:   { href: '/dashboard/reservations', icon: '📅', label: 'Захиалга' },
  housekeeping:   { href: '/dashboard/housekeeping', icon: '🧹', label: 'Цэвэрлэгээ' },
  maintenance:    { href: '/dashboard/maintenance',  icon: '🔧', label: 'Засвар' },
  // Retail
  inventory:      { href: '/dashboard/inventory',    icon: '📊', label: 'Агуулах' },
  suppliers:      { href: '/dashboard/suppliers',    icon: '🏭', label: 'Нийлүүлэгч' },
  purchase_orders: { href: '/dashboard/purchase-orders', icon: '📝', label: 'Худалдан авалт' },
  pos:            { href: '/dashboard/pos',          icon: '💳', label: 'POS' },
  // Laundry
  laundry:        { href: '/dashboard/laundry',      icon: '🧺', label: 'Угаалга' },
  // Medical
  patients:       { href: '/dashboard/patients',     icon: '🏥', label: 'Өвчтөн' },
  encounters:     { href: '/dashboard/encounters',   icon: '📋', label: 'Үзлэг' },
  lab:            { href: '/dashboard/lab',           icon: '🔬', label: 'Лаборатори' },
  pharmacy:       { href: '/dashboard/pharmacy',      icon: '💊', label: 'Эмийн сан' },
  inpatient:      { href: '/dashboard/inpatient',     icon: '🛏️', label: 'Хэвтэн' },
  complaints_qa:  { href: '/dashboard/complaints',    icon: '📢', label: 'Гомдол' },
  // Education
  programs:       { href: '/dashboard/programs',     icon: '📚', label: 'Хөтөлбөр' },
  enrollments:    { href: '/dashboard/enrollments',  icon: '📝', label: 'Бүртгэл' },
  // Pet Services
  pets:           { href: '/dashboard/pets',         icon: '🐾', label: 'Амьтад' },
  // Car Wash
  car_wash:       { href: '/dashboard/car-wash',     icon: '🚗', label: 'Угаалга' },
  // Wellness
  treatment_plans: { href: '/dashboard/treatment-plans', icon: '💆', label: 'Эмчилгээ' },
  // Photography
  photo_sessions:  { href: '/dashboard/photo-sessions',  icon: '📸', label: 'Зураг авалт' },
  photo_galleries: { href: '/dashboard/photo-galleries', icon: '🖼️', label: 'Галерей' },
  // Venue / Event
  venue_list:      { href: '/dashboard/venues',          icon: '🏛️', label: 'Танхим' },
  venue_bookings:  { href: '/dashboard/venue-bookings',  icon: '📅', label: 'Захиалга' },
  // Coworking
  coworking:       { href: '/dashboard/coworking',       icon: '💻', label: 'Ширээ' },
  desk_bookings:   { href: '/dashboard/desk-bookings',   icon: '🪑', label: 'Захиалга' },
  // Legal
  legal_cases:     { href: '/dashboard/legal-cases',     icon: '⚖️', label: 'Хэрэг' },
  case_documents:  { href: '/dashboard/case-documents',  icon: '📄', label: 'Баримт бичиг' },
  time_tracking:   { href: '/dashboard/time-tracking',   icon: '⏱️', label: 'Цаг бүртгэл' },
  case_events:     { href: '/dashboard/case-events',     icon: '📅', label: 'Хэргийн үйл явдал' },
  legal_expenses:  { href: '/dashboard/legal-expenses',  icon: '💸', label: 'Зардал' },
  retainers:       { href: '/dashboard/retainers',       icon: '💰', label: 'Урьдчилгаа' },
  // Construction / Projects
  project_list:    { href: '/dashboard/projects',        icon: '🏗️', label: 'Төсөл' },
  project_tasks:   { href: '/dashboard/project-tasks',   icon: '✅', label: 'Даалгавар' },
  materials:       { href: '/dashboard/materials',       icon: '🧱', label: 'Материал' },
  inspections:     { href: '/dashboard/inspections',     icon: '🔍', label: 'Шалгалт' },
  permits:         { href: '/dashboard/permits',         icon: '📜', label: 'Зөвшөөрөл' },
  crew:            { href: '/dashboard/crew',            icon: '👷', label: 'Баг' },
  daily_logs:      { href: '/dashboard/daily-logs',      icon: '📝', label: 'Өдрийн бүртгэл' },
  // Subscription
  subscription_list: { href: '/dashboard/subscriptions', icon: '🔄', label: 'Захиалга' },
  // Sports / Gym
  fitness_classes:  { href: '/dashboard/fitness-classes',  icon: '🏋️', label: 'Хичээл' },
  equipment_list:   { href: '/dashboard/equipment',        icon: '🏃', label: 'Тоног төхөөрөмж' },
  // Repair Shop
  repair_orders:    { href: '/dashboard/repair-orders',    icon: '🔧', label: 'Засварын захиалга' },
  // Consulting
  consultations:    { href: '/dashboard/consultations',    icon: '💼', label: 'Зөвлөгөө' },
  // Home Services
  service_requests: { href: '/dashboard/service-requests', icon: '🔨', label: 'Үйлчилгээний хүсэлт' },
  service_areas:    { href: '/dashboard/service-areas',    icon: '📍', label: 'Үйлчилгээний бүс' },
  // Logistics / Fleet
  fleet_vehicles:   { href: '/dashboard/fleet-vehicles',   icon: '🚛', label: 'Тээврийн хэрэгсэл' },
  trip_logs:        { href: '/dashboard/trip-logs',        icon: '🗺️', label: 'Аяллын бүртгэл' },
  // Restaurant Extensions
  table_layouts:    { href: '/dashboard/table-layouts',    icon: '🪑', label: 'Ширээний зохион байгуулалт' },
  table_reservations: { href: '/dashboard/table-reservations', icon: '📅', label: 'Ширээ захиалга' },
  // Stay Extended
  rate_plans:       { href: '/dashboard/rate-plans',       icon: '💲', label: 'Үнийн төлөвлөгөө' },
  leases:           { href: '/dashboard/leases',           icon: '📄', label: 'Түрээс' },
  // Beauty / Retail Extended
  loyalty:          { href: '/dashboard/loyalty',          icon: '🎯', label: 'Урамшуулал оноо' },
  package_purchases: { href: '/dashboard/package-purchases', icon: '🎁', label: 'Багц худалдан авалт' },
  gift_cards:       { href: '/dashboard/gift-cards',       icon: '🎴', label: 'Бэлгийн карт' },
  // Retail Extended
  stock_transfers:  { href: '/dashboard/stock-transfers',  icon: '🔄', label: 'Нөөц шилжүүлэг' },
}

// Aliases: test-scenario type names → canonical type names
const TYPE_ALIASES: Record<string, string> = {
  // E-commerce / Retail
  commerce: 'ecommerce',
  online_shop: 'ecommerce',
  shop: 'ecommerce',
  // Beauty
  beauty: 'beauty_salon',
  salon: 'beauty_salon',
  barbershop: 'beauty_salon',
  // Wellness
  spa: 'wellness',
  yoga: 'wellness',
  pilates: 'wellness',
  // Pet Services
  pet: 'pet_services',
  pet_grooming: 'pet_services',
  veterinary: 'pet_services',
  boarding: 'pet_services',
  // Car Wash
  carwash: 'car_wash',
  auto_detailing: 'car_wash',
  // QSR / Coffee
  qsr: 'coffee_shop',
  bakery: 'coffee_shop',
  boba: 'coffee_shop',
  // Hospitality
  stay: 'hotel',
  hostel: 'hotel',
  motel: 'hotel',
  camping: 'camping_guesthouse',
  // Sports / Gym
  sports: 'gym',
  sports_center: 'gym',
  // Medical
  medical: 'hospital',
  // Consulting / Pro Services
  proservices: 'consulting',
  pro_services: 'consulting',
  travel_agency: 'consulting',
  // Real Estate
  realtor: 'real_estate',
  // Repair
  repair: 'repair_shop',
  auto_repair: 'repair_shop',
  electronics_repair: 'repair_shop',
  // Home Services
  homeservices: 'home_services',
  cleaning: 'home_services',
  plumbing: 'home_services',
  moving: 'home_services',
  // Logistics
  courier: 'logistics',
  delivery: 'logistics',
  fleet: 'logistics',
  // Laundry
  dry_cleaning: 'laundry',
  laundry_service: 'laundry',
  // Education
  training: 'training_center',
  school: 'education',
  // Legal
  law_firm: 'legal',
  // Venue / Event
  event_venue: 'venue',
  // Coworking
  coworking_space: 'coworking',
  // Subscription
  subscription_box: 'subscription',
  // Photography
  photography_studio: 'photography',
  // Construction
  general_contractor: 'construction',
  contractor: 'construction',
}

// Default modules per business type
const DEFAULT_MODULES: Record<string, string[]> = {
  // E-commerce (default)
  ecommerce: [
    'overview', 'products', 'orders', 'deliveries', 'driver_payouts',
    'returns', 'vouchers', 'gift_cards', 'loyalty',
    'customers', 'chat', 'driver_chat',
    'billing', 'analytics', 'settings',
  ],
  // Food-based
  restaurant: [
    'overview', 'floor', 'table_reservations', 'events', 'catering',
    'menu', 'kds', 'production', 'orders', 'table_layouts',
    'deliveries', 'driver_payouts', 'promotions', 'returns', 'vouchers',
    'customers', 'chat', 'driver_chat', 'billing', 'analytics', 'settings',
  ],
  coffee_shop: [
    'overview', 'menu', 'orders', 'kitchen', 'deliveries', 'driver_payouts',
    'promotions', 'returns', 'vouchers', 'customers', 'chat', 'driver_chat',
    'billing', 'analytics', 'settings',
  ],
  cafe: [
    'overview', 'menu', 'orders', 'kitchen', 'deliveries', 'driver_payouts',
    'promotions', 'returns', 'vouchers', 'customers', 'chat', 'driver_chat',
    'billing', 'analytics', 'settings',
  ],
  // Service-based
  beauty_salon: [
    'overview', 'calendar', 'services', 'staff', 'resources',
    'packages', 'memberships', 'client_profiles', 'staff_commissions',
    'loyalty', 'package_purchases',
    'returns', 'vouchers', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  fitness: [
    'overview', 'calendar', 'services', 'staff', 'resources',
    'memberships', 'returns', 'vouchers', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  education: [
    'overview', 'calendar', 'services', 'staff', 'resources',
    'returns', 'vouchers', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  services: [
    'overview', 'calendar', 'services', 'staff', 'resources',
    'returns', 'vouchers', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  hospital: [
    'overview', 'patients', 'encounters', 'lab', 'pharmacy', 'inpatient',
    'complaints_qa', 'calendar', 'services', 'staff', 'resources',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  dental_clinic: [
    'overview', 'patients', 'encounters', 'lab', 'pharmacy',
    'complaints_qa', 'calendar', 'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Hospitality
  camping_guesthouse: [
    'overview', 'calendar', 'units', 'reservations', 'guests',
    'housekeeping', 'maintenance', 'rate_plans', 'leases',
    'services', 'staff', 'resources',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  hotel: [
    'overview', 'calendar', 'units', 'reservations', 'guests',
    'housekeeping', 'maintenance', 'rate_plans', 'leases',
    'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  guesthouse: [
    'overview', 'calendar', 'units', 'reservations', 'guests',
    'housekeeping', 'maintenance', 'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Real estate
  real_estate: [
    'overview', 'properties', 'calendar', 'agents', 'deals', 'commissions',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Retail
  retail: [
    'overview', 'products', 'orders', 'pos', 'inventory',
    'suppliers', 'purchase_orders', 'stock_transfers',
    'gift_cards', 'loyalty', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Laundry
  laundry: [
    'overview', 'laundry', 'orders', 'staff',
    'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Medical / Clinic
  clinic: [
    'overview', 'patients', 'encounters', 'lab', 'pharmacy',
    'complaints_qa', 'calendar', 'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Education / Training
  training_center: [
    'overview', 'programs', 'enrollments', 'calendar', 'services',
    'staff', 'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Pet Services
  pet_services: [
    'overview', 'pets', 'calendar', 'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Car Wash
  car_wash: [
    'overview', 'car_wash', 'services', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Wellness / Spa
  wellness: [
    'overview', 'calendar', 'services', 'staff', 'resources',
    'treatment_plans', 'packages', 'memberships',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Photography / Studio
  photography: [
    'overview', 'photo_sessions', 'photo_galleries', 'calendar',
    'services', 'staff', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Venue / Event Space
  venue: [
    'overview', 'venue_list', 'venue_bookings', 'calendar',
    'services', 'staff', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Coworking Space
  coworking: [
    'overview', 'coworking', 'desk_bookings', 'calendar',
    'memberships', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Legal / Law Firm
  legal: [
    'overview', 'legal_cases', 'case_documents', 'time_tracking',
    'case_events', 'legal_expenses', 'retainers', 'calendar',
    'staff', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Construction / Project Management
  construction: [
    'overview', 'project_list', 'project_tasks', 'materials',
    'inspections', 'permits', 'crew', 'daily_logs',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Subscription Business
  subscription: [
    'overview', 'subscription_list', 'products', 'services',
    'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Gym / Sports
  gym: [
    'overview', 'fitness_classes', 'equipment_list', 'calendar',
    'memberships', 'staff', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
  // Repair Shop
  repair_shop: [
    'overview', 'repair_orders', 'customers', 'staff',
    'chat', 'billing', 'analytics', 'settings',
  ],
  // Consulting / Professional Services
  consulting: [
    'overview', 'consultations', 'calendar', 'staff',
    'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Home Services (cleaning, plumbing, electrical, etc.)
  home_services: [
    'overview', 'service_requests', 'service_areas', 'calendar',
    'staff', 'customers', 'chat', 'billing', 'analytics', 'settings',
  ],
  // Logistics / Fleet Management
  logistics: [
    'overview', 'fleet_vehicles', 'trip_logs', 'deliveries',
    'driver_payouts', 'staff', 'customers', 'chat',
    'billing', 'analytics', 'settings',
  ],
}

/**
 * Resolve which modules (nav items) to show for a given business type.
 * enabled_modules can override defaults: { "billing": false, "pos": true }
 */
export function resolveFeatures(
  businessType: string | null | undefined,
  enabledModules?: Record<string, boolean> | null,
): string[] {
  const raw = businessType || 'ecommerce'
  const type = TYPE_ALIASES[raw] || raw
  const defaults = DEFAULT_MODULES[type] || DEFAULT_MODULES.ecommerce

  if (!enabledModules) return defaults

  // Apply overrides
  const result = new Set(defaults)

  for (const [module, enabled] of Object.entries(enabledModules)) {
    if (enabled && !result.has(module)) {
      result.add(module)
    } else if (!enabled && result.has(module)) {
      result.delete(module)
    }
  }

  return Array.from(result)
}

/**
 * Get nav items for resolved features.
 */
export function getNavItems(features: string[]): NavItem[] {
  return features
    .map(f => MODULE_REGISTRY[f])
    .filter((item): item is NavItem => item !== undefined)
}

/**
 * Get a single module's nav config.
 */
export function getModuleConfig(module: string): NavItem | undefined {
  return MODULE_REGISTRY[module]
}

/**
 * Resolve a business type alias to its canonical name.
 */
export function resolveBusinessType(type: string): string {
  return TYPE_ALIASES[type] || type
}
