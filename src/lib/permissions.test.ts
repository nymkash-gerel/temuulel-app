import { describe, it, expect } from 'vitest'
import {
  hasPermission,
  getGrantedPermissions,
  buildPermissions,
  canAccessPath,
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
} from './permissions'

describe('permissions', () => {
  describe('hasPermission', () => {
    it('owner always has all permissions', () => {
      expect(hasPermission('owner', null, 'chat')).toBe(true)
      expect(hasPermission('owner', null, 'settings')).toBe(true)
      expect(hasPermission('owner', {}, 'staff_manage')).toBe(true)
      expect(hasPermission('owner', { chat: false }, 'chat')).toBe(true) // owner overrides
    })

    it('uses explicit permissions when set', () => {
      const perms = { chat: true, orders: true, products: false, settings: false }
      expect(hasPermission('staff', perms, 'chat')).toBe(true)
      expect(hasPermission('staff', perms, 'orders')).toBe(true)
      expect(hasPermission('staff', perms, 'products')).toBe(false)
      expect(hasPermission('staff', perms, 'settings')).toBe(false)
    })

    it('falls back to role defaults when permissions are empty', () => {
      // staff defaults: chat, orders
      expect(hasPermission('staff', null, 'chat')).toBe(true)
      expect(hasPermission('staff', null, 'orders')).toBe(true)
      expect(hasPermission('staff', null, 'settings')).toBe(false)
      expect(hasPermission('staff', {}, 'chat')).toBe(true) // empty object = use defaults
    })

    it('admin defaults to all permissions', () => {
      expect(hasPermission('admin', null, 'chat')).toBe(true)
      expect(hasPermission('admin', null, 'settings')).toBe(true)
      expect(hasPermission('admin', null, 'staff_manage')).toBe(true)
    })

    it('admin with explicit restrictions', () => {
      const perms = { chat: true, orders: true, settings: false, staff_manage: false }
      expect(hasPermission('admin', perms, 'chat')).toBe(true)
      expect(hasPermission('admin', perms, 'settings')).toBe(false)
    })
  })

  describe('getGrantedPermissions', () => {
    it('owner gets all permissions', () => {
      expect(getGrantedPermissions('owner', null)).toEqual(ALL_PERMISSIONS)
    })

    it('returns explicit permissions when set', () => {
      const perms = { chat: true, orders: true, products: false }
      const granted = getGrantedPermissions('staff', perms)
      expect(granted).toContain('chat')
      expect(granted).toContain('orders')
      expect(granted).not.toContain('products')
    })

    it('returns role defaults when no explicit permissions', () => {
      const granted = getGrantedPermissions('staff', null)
      expect(granted).toEqual(ROLE_DEFAULT_PERMISSIONS.staff)
    })
  })

  describe('buildPermissions', () => {
    it('builds a full permissions object', () => {
      const result = buildPermissions(['chat', 'orders'])
      expect(result.chat).toBe(true)
      expect(result.orders).toBe(true)
      expect(result.settings).toBe(false)
      expect(result.products).toBe(false)
      expect(Object.keys(result).length).toBe(ALL_PERMISSIONS.length)
    })
  })

  describe('canAccessPath', () => {
    it('owner can access everything', () => {
      expect(canAccessPath('owner', null, '/dashboard/settings')).toBe(true)
      expect(canAccessPath('owner', null, '/dashboard/orders')).toBe(true)
    })

    it('staff with default permissions can access chat and orders', () => {
      expect(canAccessPath('staff', null, '/dashboard/chat')).toBe(true)
      expect(canAccessPath('staff', null, '/dashboard/orders')).toBe(true)
      expect(canAccessPath('staff', null, '/dashboard/settings')).toBe(false)
      expect(canAccessPath('staff', null, '/dashboard/products')).toBe(false)
    })

    it('respects explicit permissions', () => {
      const perms = { chat: true, delivery: true, settings: false }
      expect(canAccessPath('staff', perms, '/dashboard/chat')).toBe(true)
      expect(canAccessPath('staff', perms, '/dashboard/delivery')).toBe(true)
      expect(canAccessPath('staff', perms, '/dashboard/settings')).toBe(false)
    })

    it('allows unmatched paths (e.g. /dashboard home)', () => {
      expect(canAccessPath('staff', null, '/dashboard')).toBe(true)
    })

    it('matches subpaths correctly', () => {
      expect(canAccessPath('staff', { orders: true }, '/dashboard/orders/123')).toBe(true)
      expect(canAccessPath('staff', { orders: false }, '/dashboard/orders/123')).toBe(false)
    })
  })
})
