'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, type Permission } from '@/lib/permissions'

interface RoleGuardResult {
  allowed: boolean
  loading: boolean
  role: string | null
  permissions: Record<string, boolean> | null
}

/**
 * Client-side role guard hook for restricted dashboard pages.
 *
 * Supports two modes:
 *   1. Role-based: useRoleGuard(['owner', 'admin']) — original behavior
 *   2. Permission-based: useRoleGuard({ permission: 'orders' }) — granular check
 *
 * Returns role and permissions for further client-side checks.
 */
export function useRoleGuard(
  requirements: string[] | { permission: Permission } = ['owner', 'admin'],
): RoleGuardResult {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null)
  const reqRef = useRef(requirements)

  useEffect(() => {
    reqRef.current = requirements
  }, [requirements])

  useEffect(() => {
    let cancelled = false

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        router.push('/login')
        return
      }

      // Check if store owner
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (cancelled) return

      if (store) {
        setRole('owner')
        setPerms(null) // owner has all permissions implicitly
        setAllowed(true)
        setLoading(false)
        return
      }

      // Check membership role and permissions
      const { data: membership } = await supabase
        .from('store_members')
        .select('role, permissions')
        .eq('user_id', user.id)
        .single()

      if (cancelled) return

      if (!membership) {
        router.push('/dashboard')
        setLoading(false)
        return
      }

      const memberRole = membership.role || 'staff'
      // JSONB narrowing — permissions comes as Json from Supabase
      const memberPerms = (membership.permissions ?? null) as Record<string, boolean> | null
      setRole(memberRole)
      setPerms(memberPerms)

      const req = reqRef.current

      if (Array.isArray(req)) {
        // Role-based check (backwards compatible)
        if (req.includes(memberRole)) {
          setAllowed(true)
        } else {
          router.push('/dashboard')
        }
      } else {
        // Permission-based check
        if (hasPermission(memberRole, memberPerms, req.permission)) {
          setAllowed(true)
        } else {
          router.push('/dashboard')
        }
      }

      setLoading(false)
    }

    check()
    return () => { cancelled = true }
  }, [supabase, router])

  return { allowed, loading, role, permissions: perms }
}
