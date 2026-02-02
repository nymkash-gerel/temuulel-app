import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parsePagination } from '@/lib/validations'

/**
 * GET /api/audit-logs
 *
 * List audit logs for the store.
 * Supports filtering by entity_type, entity_id, action, actor_id.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  const action = searchParams.get('action')
  const actorId = searchParams.get('actor_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('audit_logs')
    .select('id, entity_type, entity_id, action, actor_id, actor_type, changes, metadata, ip_address, created_at', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (entityType) {
    query = query.eq('entity_type', entityType)
  }
  if (entityId) {
    query = query.eq('entity_id', entityId)
  }
  const validActions = ['create', 'update', 'delete', 'status_change'] as const
  if (action && validActions.includes(action as typeof validActions[number])) {
    query = query.eq('action', action as typeof validActions[number])
  }
  if (actorId) {
    query = query.eq('actor_id', actorId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}
