/**
 * Channel-agnostic staff notification system.
 *
 * Priority:
 * 1. Telegram (with inline buttons for two-way interaction)
 * 2. Messenger (via existing sendTextMessage)
 * 3. Email (if configured)
 * 4. Log warning and skip
 */
import { createClient } from '@supabase/supabase-js'
import { sendTelegramInlineKeyboard, sendTelegramMessage, type InlineButton } from './telegram'
import { sendEmail } from './email'

export interface StaffNotificationPayload {
  appointmentId: string
  customerName: string
  serviceName?: string
  scheduledAt: string
  eventType: 'appointment_created' | 'appointment_confirmed' | 'appointment_cancelled' | 'appointment_assigned'
  resourceName?: string
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

const EVENT_LABELS: Record<string, string> = {
  appointment_created: 'Шинэ захиалга',
  appointment_confirmed: 'Захиалга баталгаажсан',
  appointment_cancelled: 'Захиалга цуцлагдсан',
  appointment_assigned: 'Захиалга оноогдсон',
}

function buildMessage(payload: StaffNotificationPayload): string {
  const label = EVENT_LABELS[payload.eventType] || 'Мэдэгдэл'
  const date = new Date(payload.scheduledAt)
  const dateStr = date.toLocaleDateString('mn-MN', { month: 'numeric', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })

  let msg = `<b>${label}</b>\n`
  msg += `👤 ${payload.customerName}\n`
  if (payload.serviceName) msg += `💼 ${payload.serviceName}\n`
  if (payload.resourceName) msg += `📍 ${payload.resourceName}\n`
  msg += `📅 ${dateStr} ${timeStr}`

  return msg
}

/**
 * Notify a staff member about an appointment event.
 *
 * Tries Telegram first (with confirm/reject buttons),
 * falls back to Messenger, then email, then logs a warning.
 */
export async function notifyStaff(
  staffId: string,
  payload: StaffNotificationPayload
): Promise<'telegram' | 'messenger' | 'email' | 'none'> {
  const supabase = getSupabase()

  const { data: staffMember, error } = await supabase
    .from('staff')
    .select('id, name, telegram_chat_id, messenger_psid, email')
    .eq('id', staffId)
    .single()

  if (error || !staffMember) {
    console.warn(`[staff-notify] Staff ${staffId} not found`)
    return 'none'
  }

  const message = buildMessage(payload)

  // 1. Try Telegram
  if (staffMember.telegram_chat_id) {
    try {
      if (payload.eventType === 'appointment_created' || payload.eventType === 'appointment_assigned') {
        // Send with confirm/reject buttons
        const buttons: InlineButton[] = [
          { text: '✅ Баталгаажуулах', callback_data: `confirm_appointment:${payload.appointmentId}` },
          { text: '❌ Цуцлах', callback_data: `reject_appointment:${payload.appointmentId}` },
        ]
        await sendTelegramInlineKeyboard(staffMember.telegram_chat_id, message, buttons)
      } else {
        await sendTelegramMessage(staffMember.telegram_chat_id, message)
      }
      return 'telegram'
    } catch (err) {
      console.error(`[staff-notify] Telegram failed for staff ${staffId}:`, err)
    }
  }

  // 2. Try Messenger
  if (staffMember.messenger_psid) {
    try {
      const { sendTextMessage } = await import('./messenger')
      // Look up store's page access token
      const { data: store } = await supabase
        .from('staff')
        .select('store_id')
        .eq('id', staffId)
        .single()

      if (store) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('facebook_page_access_token')
          .eq('id', store.store_id)
          .single()

        if (storeData?.facebook_page_access_token) {
          // Strip HTML tags for Messenger
          const plainMessage = message.replace(/<[^>]+>/g, '')
          await sendTextMessage(
            storeData.facebook_page_access_token,
            staffMember.messenger_psid,
            plainMessage
          )
          return 'messenger'
        }
      }
    } catch (err) {
      console.error(`[staff-notify] Messenger failed for staff ${staffId}:`, err)
    }
  }

  // 3. Try Email
  if (staffMember.email) {
    try {
      const label = EVENT_LABELS[payload.eventType] || 'Мэдэгдэл'
      const plainMessage = message.replace(/<[^>]+>/g, '')
      const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e293b; margin-bottom: 16px;">${label}</h2>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; white-space: pre-line; color: #334155;">
            ${plainMessage}
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">— Temuulel</p>
        </div>
      `
      const sent = await sendEmail(staffMember.email, `${label} — ${payload.customerName}`, html)
      if (sent) return 'email'
    } catch (err) {
      console.error(`[staff-notify] Email failed for staff ${staffId}:`, err)
    }
  }

  // 4. No channel available
  console.warn(`[staff-notify] No notification channel for staff ${staffId} (${staffMember.name})`)
  return 'none'
}
