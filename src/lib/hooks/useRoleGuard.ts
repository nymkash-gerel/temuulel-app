'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side role guard hook for restricted settings pages.
 * Checks if the current user is the store owner or has a required role.
 * Redirects to /dashboard if unauthorized.
 */
export function useRoleGuard(requiredRoles: string[] = ['owner', 'admin']) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const rolesRef = useRef(requiredRoles)
  rolesRef.current = requiredRoles

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
        setAllowed(true)
        setLoading(false)
        return
      }

      // Check membership role
      const { data: membership } = await supabase
        .from('store_members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (cancelled) return

      if (membership && rolesRef.current.includes(membership.role)) {
        setAllowed(true)
      } else {
        router.push('/dashboard')
      }
      setLoading(false)
    }

    check()
    return () => { cancelled = true }
  }, [supabase, router])

  return { allowed, loading }
}
