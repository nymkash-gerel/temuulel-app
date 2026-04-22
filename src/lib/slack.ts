/**
 * Slack Incoming Webhook client
 *
 * Sends notifications to a team Slack channel via webhook URL stored in
 * SLACK_WEBHOOK_URL. All sends are fire-and-forget — if Slack is down, the
 * business logic that called us should never fail.
 *
 * Channel routing (all optional, fall back to SLACK_WEBHOOK_URL):
 *   - SLACK_WEBHOOK_URL            default channel (e.g. #deploys)
 *   - SLACK_BUSINESS_WEBHOOK_URL   business metrics (new signups, orders)
 *   - SLACK_ERRORS_WEBHOOK_URL     production errors / alerts
 *
 * Usage:
 *   import { notify } from '@/lib/slack'
 *   await notify('business', { text: 'New store created', fields: {...} })
 */

type Channel = 'default' | 'business' | 'errors'

interface SlackBlock {
  type: string
  text?: { type: string; text: string }
  fields?: Array<{ type: string; text: string }>
  elements?: Array<{ type: string; text: string }>
}

interface NotifyArgs {
  /** Plain-text fallback (required for accessibility + notifications) */
  text: string
  /** Header text (big, bold) */
  header?: string
  /** Key:value fields shown in a grid */
  fields?: Record<string, string>
  /** Small context footer (muted grey) */
  context?: string
  /** Color stripe on the left side */
  color?: 'good' | 'warning' | 'danger' | string
  /** Emoji prefix for the header (default: 🔔) */
  emoji?: string
}

function resolveWebhook(channel: Channel): string | null {
  switch (channel) {
    case 'business':
      return process.env.SLACK_BUSINESS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null
    case 'errors':
      return process.env.SLACK_ERRORS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL || null
    case 'default':
    default:
      return process.env.SLACK_WEBHOOK_URL || null
  }
}

function colorHex(color?: string): string {
  switch (color) {
    case 'good': return '#36a64f'
    case 'warning': return '#ffaa00'
    case 'danger': return '#d72b3f'
    default: return color || '#3b82f6'
  }
}

/**
 * Send a Slack notification. Never throws — errors are swallowed and logged.
 *
 * @param channel Which webhook channel to use ('default' | 'business' | 'errors')
 * @param args    Message content
 * @returns true on success, false on failure (for tests / conditional logging)
 */
export async function notify(channel: Channel, args: NotifyArgs): Promise<boolean> {
  const url = resolveWebhook(channel)
  if (!url) {
    // No webhook configured — silently skip (dev, staging, etc.)
    return false
  }

  const emoji = args.emoji || '🔔'
  const blocks: SlackBlock[] = []

  if (args.header) {
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${args.header}` },
    })
  }

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: args.text },
  })

  if (args.fields && Object.keys(args.fields).length > 0) {
    blocks.push({
      type: 'section',
      fields: Object.entries(args.fields).map(([k, v]) => ({
        type: 'mrkdwn',
        text: `*${k}:* ${v}`,
      })),
    })
  }

  if (args.context) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: args.context }],
    })
  }

  const payload = {
    text: args.text, // fallback for accessibility / desktop notifications
    attachments: [
      {
        color: colorHex(args.color),
        blocks,
      },
    ],
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(`Slack webhook returned ${res.status}: ${await res.text().catch(() => '')}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Slack notify failed:', err)
    return false
  }
}

/**
 * Fire-and-forget variant: starts the send and returns immediately.
 * Use this in request handlers where you don't want to delay the response.
 */
export function notifyAsync(channel: Channel, args: NotifyArgs): void {
  void notify(channel, args)
}
