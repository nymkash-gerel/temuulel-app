import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, teamUpdatePermissionsSchema } from '@/lib/validations'
import { ALL_PERMISSIONS } from '@/lib/permissions'

const RATE_LIMIT = { limit: 20, windowSeconds: 60 }

/**
 * PATCH /api/team/permissions
 *
 * Update a team member's permissions.
 * Only store owner or members with staff_manage permission can do this.
 */
export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: body, error: validationError } = await validateBody(request, teamUpdatePermissionsSchema)
  if (validationError) return validationError
  const { user_id, permissions } = body

  // Verify requester owns a store or is admin with staff_manage permission
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  let storeId = store?.id

  if (!storeId) {
    // Check if requester is a member with staff_manage permission
    const { data: requesterMembership } = await supabase
      .from('store_members')
      .select('store_id, role, permissions')
      .eq('user_id', user.id)
      .single()

    if (!requesterMembership) {
      return NextResponse.json({ error: 'Эрх хүрэлцэхгүй байна' }, { status: 403 })
    }

    const reqRole = requesterMembership.role || 'staff'
    // JSONB narrowing
    const reqPerms = (requesterMembership.permissions ?? null) as Record<string, boolean> | null
    const canManage = reqRole === 'admin' && (reqPerms?.staff_manage === true || !reqPerms || Object.keys(reqPerms).length === 0)

    if (!canManage) {
      return NextResponse.json({ error: 'Зөвхөн эзэмшигч эсвэл админ эрх өөрчлөх боломжтой' }, { status: 403 })
    }

    storeId = requesterMembership.store_id
  }

  // Cannot change own permissions
  if (user_id === user.id) {
    return NextResponse.json({ error: 'Өөрийнхөө эрхийг өөрчлөх боломжгүй' }, { status: 400 })
  }

  // Verify target member exists and is in the same store
  const { data: targetMember } = await supabase
    .from('store_members')
    .select('id, role')
    .eq('store_id', storeId)
    .eq('user_id', user_id)
    .single()

  if (!targetMember) {
    return NextResponse.json({ error: 'Гишүүн олдсонгүй' }, { status: 404 })
  }

  // Cannot change owner permissions
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Эзэмшигчийн эрхийг өөрчлөх боломжгүй' }, { status: 400 })
  }

  // Filter to valid permissions only
  const validPerms: Record<string, boolean> = {}
  for (const key of ALL_PERMISSIONS) {
    if (key in permissions) {
      validPerms[key] = permissions[key]
    }
  }

  const { error: updateError } = await supabase
    .from('store_members')
    .update({ permissions: validPerms })
    .eq('store_id', storeId)
    .eq('user_id', user_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ user_id, permissions: validPerms })
}
