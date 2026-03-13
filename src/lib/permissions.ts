/**
 * Granular permission system for store team members.
 *
 * Owner role always has all permissions (implicit).
 * Admin and staff roles have configurable permissions stored in store_members.permissions JSONB.
 */

export const PERMISSIONS = {
  chat: 'chat',
  orders: 'orders',
  products: 'products',
  delivery: 'delivery',
  payments: 'payments',
  reports: 'reports',
  settings: 'settings',
  staff_manage: 'staff_manage',
  telegram_connect: 'telegram_connect',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS)

export const PERMISSION_LABELS: Record<Permission, string> = {
  chat: 'Чат',
  orders: 'Захиалга',
  products: 'Бараа/Үйлчилгээ',
  delivery: 'Хүргэлт',
  payments: 'Төлбөр',
  reports: 'Тайлан',
  settings: 'Тохиргоо',
  staff_manage: 'Ажилтан удирдах',
  telegram_connect: 'Telegram холбох',
}

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  chat: 'Харилцагчийн чатанд хариулах, харах',
  orders: 'Захиалга харах, статус өөрчлөх',
  products: 'Бараа, үйлчилгээ нэмэх, засах, устгах',
  delivery: 'Хүргэлт удирдах, жолооч оноох',
  payments: 'Төлбөр харах, баталгаажуулах',
  reports: 'Тайлан, статистик харах',
  settings: 'Дэлгүүрийн тохиргоо өөрчлөх',
  staff_manage: 'Ажилтан нэмэх, хасах, эрх өөрчлөх',
  telegram_connect: 'Telegram мэдэгдэл холбох',
}

/** Default permissions by role */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: [...ALL_PERMISSIONS],
  staff: ['chat', 'orders'],
}

/** Map dashboard paths to required permissions */
export const PATH_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/chat': 'chat',
  '/dashboard/conversations': 'chat',
  '/dashboard/orders': 'orders',
  '/dashboard/products': 'products',
  '/dashboard/services': 'products',
  '/dashboard/delivery': 'delivery',
  '/dashboard/deliveries': 'delivery',
  '/dashboard/drivers': 'delivery',
  '/dashboard/payments': 'payments',
  '/dashboard/invoices': 'payments',
  '/dashboard/reports': 'reports',
  '/dashboard/analytics': 'reports',
  '/dashboard/settings': 'settings',
  '/dashboard/staff': 'staff_manage',
  '/dashboard/team': 'staff_manage',
}

/**
 * Check if a member has a specific permission.
 * Owner always returns true.
 */
export function hasPermission(
  role: string,
  permissions: Record<string, boolean> | null | undefined,
  permission: Permission,
): boolean {
  if (role === 'owner') return true

  // If permissions are explicitly set, use them
  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    return permissions[permission] === true
  }

  // Fall back to role defaults
  const defaults = ROLE_DEFAULT_PERMISSIONS[role]
  return defaults ? defaults.includes(permission) : false
}

/**
 * Get all granted permissions for a member.
 */
export function getGrantedPermissions(
  role: string,
  permissions: Record<string, boolean> | null | undefined,
): Permission[] {
  if (role === 'owner') return [...ALL_PERMISSIONS]

  if (permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0) {
    return ALL_PERMISSIONS.filter((p) => permissions[p] === true)
  }

  return ROLE_DEFAULT_PERMISSIONS[role] || []
}

/**
 * Build a permissions object from a list of granted permissions.
 */
export function buildPermissions(granted: Permission[]): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const p of ALL_PERMISSIONS) {
    result[p] = granted.includes(p)
  }
  return result
}

/**
 * Check if a dashboard path requires a specific permission,
 * and whether the member has it.
 */
export function canAccessPath(
  role: string,
  permissions: Record<string, boolean> | null | undefined,
  path: string,
): boolean {
  if (role === 'owner') return true

  // Find matching permission for path
  const matchingPath = Object.keys(PATH_PERMISSIONS)
    .sort((a, b) => b.length - a.length) // longest match first
    .find((p) => path.startsWith(p))

  if (!matchingPath) return true // no restriction on unmatched paths (e.g. /dashboard home)

  return hasPermission(role, permissions, PATH_PERMISSIONS[matchingPath])
}
