'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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

  const check = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
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

    if (membership && requiredRoles.includes(membership.role)) {
      setAllowed(true)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }, [supabase, router, requiredRoles])

  useEffect(() => {
    check()
  }, [check])

  return { allowed, loading }
}
