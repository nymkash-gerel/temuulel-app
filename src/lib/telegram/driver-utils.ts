/**
 * Shared types and utility functions for the driver Telegram bot.
 */

import { getSupabase } from '@/lib/supabase/service'

// ─── Telegram update types (only fields we use) ─────────────────────────────

export interface TgPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

export interface TgMessage {
  message_id: number
  from: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  contact?: { phone_number: string; user_id?: number }
  /** Array of photo sizes (smallest -> largest). Last element is highest quality. */
  photo?: TgPhotoSize[]
  caption?: string
}

export interface TgCallbackQuery {
  id: string
  from: { id: number; first_name: string }
  message?: TgMessage
  data?: string
}

export interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

export interface TgAccountEntry {
  chat_id: number
  first_name: string
  last_name?: string
  username?: string
  linked_at: string
}

// ─── Supabase helper type ────────────────────────────────────────────────────

export type SupabaseClient = ReturnType<typeof getSupabase>

// ─── Utility functions ───────────────────────────────────────────────────────

/** Fetch delivery metadata and merge with new fields (prevents overwriting existing metadata) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mergedDeliveryMeta(supabase: any, deliveryId: string, newFields: Record<string, unknown>): Promise<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('deliveries').select('metadata').eq('id', deliveryId).single()
  const existing = (data?.metadata ?? {}) as Record<string, unknown>
  return { ...existing, ...newFields }
}

/** Get all staff + store_members Telegram chat IDs for a store */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getStaffMemberChatIds(supabase: any, storeId: string): Promise<string[]> {
  const chatIds: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff } = await (supabase as any)
    .from('staff').select('telegram_chat_id').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
  for (const s of (staff || []) as Array<{ telegram_chat_id: string }>) {
    if (s.telegram_chat_id && !chatIds.includes(s.telegram_chat_id)) chatIds.push(s.telegram_chat_id)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from('store_members').select('telegram_chat_id, notification_preferences').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
  for (const m of (members || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
    const prefs = m.notification_preferences || {}
    if (m.telegram_chat_id && prefs.delivery !== false && !chatIds.includes(m.telegram_chat_id)) {
      chatIds.push(m.telegram_chat_id)
    }
  }
  return chatIds
}

/** Fetch delivery info and build a consistent header line for in-place message edits */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDeliveryHeader(supabase: any, deliveryId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('deliveries')
    .select('delivery_number, delivery_address, customer_name, customer_phone')
    .eq('id', deliveryId)
    .maybeSingle()
  if (!data) return ''
  return `📦 <b>ЗАХИАЛГА — #${data.delivery_number}</b>\n\n` +
    (data.delivery_address ? `📍 ${data.delivery_address}\n` : '') +
    (data.customer_name ? `👤 ${data.customer_name}` : '') +
    (data.customer_phone ? `${data.customer_name ? ' · ' : '📞 '}<code>${data.customer_phone}</code>` : '') +
    '\n\n'
}

/**
 * Rebuild the combined bulk-assign message after driver taps confirm or deny.
 * Fetches fresh delivery states, updates text + keyboard in-place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rebuildBatchMessage(supabase: any, chatId: number, messageId: number, batchIds: string[]): Promise<void> {
  const { tgEdit } = await import('@/lib/driver-telegram')
  type TgInlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batch } = await (supabase as any)
    .from('deliveries')
    .select('id, delivery_number, delivery_address, customer_name, customer_phone, status, driver_id')
    .in('id', batchIds)

  if (!batch) return

  const lines = (batch as { id: string; delivery_number: string; delivery_address: string | null; customer_name: string | null; customer_phone: string | null; status: string; driver_id: string | null }[]).map((d, i) => {
    const confirmed = ['picked_up', 'in_transit', 'delivered', 'at_store'].includes(d.status)
    const denied = !d.driver_id && ['pending', 'cancelled', 'failed'].includes(d.status)
    const icon = confirmed ? '✅' : denied ? '❌' : '📋'
    const tag = confirmed ? ' — Хүлээж авлаа' : denied ? ' — Татгалзсан' : ''
    return `${i + 1}. ${icon} <b>#${d.delivery_number}</b>${tag}\n    📍 ${d.delivery_address || '—'}\n    👤 ${d.customer_name || '—'}${d.customer_phone ? ` · <code>${d.customer_phone}</code>` : ''}`
  }).join('\n\n')

  // Build smart keyboard: assigned -> accept/deny, picked_up/in_transit -> delivery actions
  type BatchDelivery = { id: string; status: string; driver_id: string | null }
  const typedBatch = batch as BatchDelivery[]
  const keyboardRows = typedBatch.flatMap(d => {
    if (d.status === 'assigned' && d.driver_id) {
      return [[
        { text: '✅ Хүлээж авлаа', callback_data: `confirm_received:${d.id}` },
        { text: '❌ Татгалзах', callback_data: `deny_delivery:${d.id}` },
      ]]
    }
    if (d.status === 'picked_up' || d.status === 'in_transit') {
      return [[
        { text: '✅ Хүргэлээ', callback_data: `delivered:${d.id}` },
        { text: '⏰ Хоцрох', callback_data: `delay:${d.id}` },
      ]]
    }
    return []
  })

  const newText = `🚚 <b>ЗАХИАЛГУУД — ${batchIds.length} хүргэлт</b>\n\n${lines}`
  const newKeyboard: TgInlineKeyboard = { inline_keyboard: keyboardRows }

  await tgEdit(chatId, messageId, newText, { replyMarkup: newKeyboard })
}

/** Clean a phone number to 8 digits (Mongolian mobile) */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^976/, '').slice(-8)
}

/** Check if a string looks like a Mongolian phone number (any common format) */
export function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, '')
  // 8 digits (local), 11 digits (976 + 8), 12 digits (+976 + 8)
  return digits.length === 8 || digits.length === 11 || digits.length === 12
}

/**
 * Record a Telegram account link into driver metadata.telegram_history.
 * Always saves the new chat_id as current; old one gets pushed to history.
 */
export async function recordTgHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient<any>>,
  driverId: string,
  newChatId: number,
  from: { id: number; first_name?: string; last_name?: string; username?: string }
): Promise<boolean> {
  // Fetch current driver metadata + existing chat_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drv } = await (supabase as any)
    .from('delivery_drivers')
    .select('telegram_chat_id, metadata')
    .eq('id', driverId)
    .single()

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta: Record<string, any> = drv?.metadata ?? {}
  const history: TgAccountEntry[] = meta.telegram_history ?? []

  // Add the new account at the front (most recent first)
  const newEntry: TgAccountEntry = {
    chat_id: newChatId,
    first_name: from.first_name ?? 'Unknown',
    ...(from.last_name ? { last_name: from.last_name } : {}),
    ...(from.username ? { username: from.username } : {}),
    linked_at: now,
  }

  // Deduplicate: remove previous entry for this chat_id (if re-linking)
  const filtered = history.filter((h) => h.chat_id !== newChatId)
  const updatedHistory = [newEntry, ...filtered].slice(0, 20) // keep last 20

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('delivery_drivers')
    .update({
      telegram_chat_id: newChatId,
      telegram_linked_at: now,
      metadata: { ...meta, telegram_history: updatedHistory },
    })
    .eq('id', driverId)

  if (error) {
    console.error(`[DriverBot] recordTgHistory FAILED driver=${driverId} chat=${newChatId}:`, error)
    return false
  }
  return true
}
