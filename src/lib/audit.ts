/**
 * Audit logging utility.
 * Records entity changes for audit trail.
 */
import { SupabaseClient } from '@supabase/supabase-js'

interface AuditLogInput {
  storeId: string
  entityType: string
  entityId: string
  action: 'create' | 'update' | 'delete' | 'status_change'
  actorId?: string
  actorType?: 'user' | 'system' | 'ai' | 'customer'
  changes?: Record<string, { old?: unknown; new?: unknown }>
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Log an audit event. Fire-and-forget -- does not throw on failure.
 */
export async function logAudit(
  supabase: SupabaseClient,
  input: AuditLogInput,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      store_id: input.storeId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      actor_id: input.actorId || null,
      actor_type: input.actorType || 'user',
      changes: input.changes || {},
      metadata: input.metadata || {},
      ip_address: input.ipAddress || null,
    })
  } catch {
    // Audit logging should never block the main operation
    console.error('[audit] Failed to log audit event:', input.entityType, input.entityId, input.action)
  }
}

/**
 * Compute a diff between two objects for audit logging.
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {}

  for (const key of Object.keys(after)) {
    if (key === 'updated_at' || key === 'created_at') continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { old: before[key], new: after[key] }
    }
  }

  return changes
}
