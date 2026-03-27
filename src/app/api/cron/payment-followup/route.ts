import { NextRequest, NextResponse } from 'next/server'
import { createQPayInvoice, isQPayConfigured } from '@/lib/qpay'
import { getSupabase } from '@/lib/supabase/service'

/**
 * Reminder schedule:
 *   reminder_count=1 → sent immediately by driver bot (payment_delayed)
 *   reminder_count=2 → 2 hours after first reminder
 *   reminder_count=3 → 12 hours after first reminder (final warning)
 *   After 3rd → 24 hours after first: escalate to human agent
 */
const REMINDER_SCHEDULE = [
  { reminderCount: 2, minHoursAfterFirst: 2 },
  { reminderCount: 3, minHoursAfterFirst: 12 },
] as const

const ESCALATION_HOURS_AFTER_FIRST = 24

const REMINDER_MESSAGES: Record<number, string> = {
  2: '⏰ Сануулга: Таны захиалгын төлбөр хүлээгдсээр байна.\n\nТөлбөрөө аль болох хурдан хийнэ үү.',
  3: '⚠️ Сүүлийн сануулга: Таны захиалгын төлбөр хийгдээгүй байна.\n\nХэрэв 12 цагийн дотор төлбөр хийгдэхгүй бол манай ажилтан тантай холбогдоно.',
}

/**
 * GET /api/cron/payment-followup
 *
 * Vercel Cron handler — runs every hour.
 * Finds delivered-but-unpaid orders, sends reminder #2 and #3,
 * then escalates to a human agent after 24 hours.
 *
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()

  // Find orders that are delivered but unpaid, with payment_followup metadata
  const { data: pendingOrders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, customer_id, store_id, metadata, notes')
    .eq('payment_status', 'pending')
    .eq('status', 'delivered')

  if (fetchErr) {
    console.error('[cron/payment-followup] Fetch error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return NextResponse.json({ ok: true, reminders_sent: 0, escalated: 0 })
  }

  let remindersSent = 0
  let escalatedCount = 0

  for (const order of pendingOrders) {
    // JSONB narrowing — metadata is typed as Json in Supabase
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const reminderCount = (meta.payment_reminder_count as number) || 0
    const lastReminderAt = meta.last_reminder_at as string | undefined

    // Skip orders that don't have a first reminder (not from payment_delayed flow)
    if (reminderCount === 0 || !lastReminderAt) continue

    // Calculate hours since first reminder
    // For reminder_count > 1, we need to track the original first reminder time
    // We use first_reminder_at if available, otherwise fall back to last_reminder_at for count=1
    const firstReminderAt = (meta.first_reminder_at as string) || lastReminderAt
    const hoursSinceFirst = (now.getTime() - new Date(firstReminderAt).getTime()) / (1000 * 60 * 60)

    // Already escalated — skip
    if (reminderCount >= 4) continue

    // Check if it's time to escalate (24h after first reminder, after 3 reminders sent)
    if (reminderCount >= 3 && hoursSinceFirst >= ESCALATION_HOURS_AFTER_FIRST) {
      await escalateToHumanAgent(supabase, order, meta)
      escalatedCount++
      continue
    }

    // Check if it's time to send the next reminder
    const nextReminder = REMINDER_SCHEDULE.find((r) => r.reminderCount === reminderCount + 1)
    if (!nextReminder) continue
    if (hoursSinceFirst < nextReminder.minHoursAfterFirst) continue

    // Prevent sending too frequently — at least 1 hour since last reminder
    const hoursSinceLast = (now.getTime() - new Date(lastReminderAt).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLast < 1) continue

    const sent = await sendReminder(supabase, order, meta, nextReminder.reminderCount)
    if (sent) remindersSent++
  }

  console.log(`[cron/payment-followup] Sent ${remindersSent} reminders, escalated ${escalatedCount}`)
  return NextResponse.json({ ok: true, reminders_sent: remindersSent, escalated: escalatedCount })
}

async function sendReminder(
  supabase: ReturnType<typeof getSupabase>,
  order: { id: string; order_number: string; total_amount: number; customer_id: string; store_id: string; notes: string | null },
  meta: Record<string, unknown>,
  reminderCount: number,
): Promise<boolean> {
  const customerId = order.customer_id
  if (!customerId) return false

  // Find customer's conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('store_id', order.store_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) return false

  const fmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n)
  const baseMessage = REMINDER_MESSAGES[reminderCount] || ''

  // Build payment link if QPay is configured
  let paymentLinkText = ''
  if (isQPayConfigured()) {
    try {
      // Check if there's already a QPay invoice
      let shortUrl = ''
      if (order.notes) {
        try {
          const notesData = JSON.parse(order.notes) as Record<string, unknown>
          shortUrl = (notesData.qpay_short_url as string) || ''
        } catch { /* notes might not be JSON */ }
      }

      // Create new invoice if none exists
      if (!shortUrl) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com'
        const invoice = await createQPayInvoice({
          orderNumber: order.order_number,
          amount: order.total_amount,
          description: `Захиалга #${order.order_number} — төлбөр`,
          callbackUrl: `${baseUrl}/api/payments/callback?order_id=${order.id}`,
        })
        shortUrl = invoice.qPay_shortUrl

        await supabase.from('orders')
          .update({
            notes: JSON.stringify({
              qpay_invoice_id: invoice.invoice_id,
              qpay_short_url: shortUrl,
            }),
          })
          .eq('id', order.id)
      }

      if (shortUrl) {
        paymentLinkText = `\n\n🔗 Төлбөр хийх: ${shortUrl}`
      }
    } catch (err) {
      console.error(`[cron/payment-followup] QPay error for order ${order.order_number}:`, err)
    }
  }

  const reminderMsg =
    `${baseMessage}\n\n` +
    `📦 Захиалга: #${order.order_number}\n` +
    `💰 Төлөх дүн: ${fmt(order.total_amount)}₮` +
    paymentLinkText

  // Insert message to customer's conversation
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    content: reminderMsg,
    is_from_customer: false,
    is_ai_response: true,
    metadata: { type: 'payment_reminder', reminder_count: reminderCount, order_id: order.id },
  })

  if (msgErr) {
    console.error(`[cron/payment-followup] Message insert failed for order ${order.order_number}:`, msgErr)
    return false
  }

  // Update order metadata with new reminder count
  const firstReminderAt = (meta.first_reminder_at as string) || (meta.last_reminder_at as string)
  await supabase.from('orders')
    .update({
      metadata: {
        ...meta,
        payment_reminder_count: reminderCount,
        last_reminder_at: new Date().toISOString(),
        first_reminder_at: firstReminderAt,
      },
    })
    .eq('id', order.id)

  // Notify store about reminder sent
  await supabase.from('notifications').insert({
    store_id: order.store_id,
    type: 'payment_pending',
    title: `🔔 Төлбөрийн ${reminderCount}-р сануулга явлаа`,
    body: `#${order.order_number} — харилцагч руу ${reminderCount}-р сануулга автоматаар явууллаа.`,
    metadata: { order_id: order.id, reminder_count: reminderCount },
  }).then(null, () => {})

  return true
}

async function escalateToHumanAgent(
  supabase: ReturnType<typeof getSupabase>,
  order: { id: string; order_number: string; total_amount: number; customer_id: string; store_id: string },
  meta: Record<string, unknown>,
): Promise<void> {
  const customerId = order.customer_id
  if (!customerId) return

  // Find customer's conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', customerId)
    .eq('store_id', order.store_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) return

  // Send final message to customer
  await supabase.from('messages').insert({
    conversation_id: conversation.id,
    content:
      `📞 Таны #${order.order_number} захиалгын төлбөр 24 цагийн дотор хийгдээгүй тул ` +
      `манай ажилтан тантай удахгүй холбогдоно.\n\nАсуудал байвал бидэнд мессеж бичнэ үү.`,
    is_from_customer: false,
    is_ai_response: true,
    metadata: { type: 'payment_escalation', order_id: order.id },
  }).then(null, () => {})

  // Escalate the conversation — mark as escalated so human agent picks it up
  await supabase
    .from('conversations')
    .update({
      status: 'escalated',
      escalated_at: new Date().toISOString(),
      escalation_level: 'high',
    })
    .eq('id', conversation.id)

  // Mark order as escalated in metadata
  await supabase.from('orders')
    .update({
      metadata: {
        ...meta,
        payment_reminder_count: 4,
        escalated_at: new Date().toISOString(),
        escalation_reason: 'payment_overdue_24h',
      },
    })
    .eq('id', order.id)

  // Urgent notification to store
  await supabase.from('notifications').insert({
    store_id: order.store_id,
    type: 'payment_pending',
    title: `🚨 Төлбөр 24ц+ хийгдээгүй — хүн ажилтан шаардлагатай`,
    body: `#${order.order_number} — 3 удаа сануулга явуулсан ч төлбөр хийгдээгүй. Харилцагчтай шууд холбогдоно уу.`,
    metadata: { order_id: order.id, escalation: true },
  }).then(null, () => {})
}
