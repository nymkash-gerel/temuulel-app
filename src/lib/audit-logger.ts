/**
 * Audit log helper — record store owner actions for security/compliance.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction =
  | 'order_status_change'
  | 'product_created' | 'product_updated' | 'product_deleted'
  | 'customer_updated' | 'customer_deleted'
  | 'broadcast_sent' | 'broadcast_deleted'
  | 'knowledge_added' | 'knowledge_updated' | 'knowledge_deleted'
  | 'settings_changed' | 'staff_added' | 'staff_removed'
  | 'operator_mode_toggled' | 'comment_rule_changed'

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    storeId: string
    userId: string
    action: AuditAction
    entityType?: string
    entityId?: string
    changes?: Record<string, unknown>
  },
): Promise<void> {
  // Fire-and-forget
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('audit_logs').insert({
        store_id: params.storeId,
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        changes: params.changes || null,
      })
    } catch (e) {
      console.error('[audit]', e)
    }
  })()
}
