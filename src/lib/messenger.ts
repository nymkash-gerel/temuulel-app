/**
 * Facebook Messenger Platform helpers
 *
 * Handles sending messages (text, buttons, quick replies, product cards),
 * typing indicators, and webhook signature verification.
 */
import crypto from 'crypto'

const GRAPH_API_VERSION = 'v18.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

// ---- Signature Verification ----

/**
 * Verify the HMAC-SHA256 signature of an incoming webhook request.
 * Facebook signs payloads with the app secret.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

// ---- Sending Messages ----

interface SendApiResponse {
  recipient_id: string
  message_id: string
}

async function callSendAPI(
  recipientId: string,
  messagePayload: Record<string, unknown>,
  pageAccessToken: string
): Promise<SendApiResponse | null> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        ...messagePayload,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`Messenger Send API error: ${res.status} ${text}`)
      return null
    }

    return res.json()
  } catch (err) {
    console.error('Messenger Send API failed:', err)
    return null
  }
}

/**
 * Send a plain text message
 */
export async function sendTextMessage(
  recipientId: string,
  text: string,
  pageAccessToken: string
): Promise<SendApiResponse | null> {
  // Messenger has a 2000 char limit per text message
  if (text.length > 2000) {
    const chunks = splitText(text, 2000)
    let lastResult: SendApiResponse | null = null
    for (const chunk of chunks) {
      lastResult = await callSendAPI(recipientId, { message: { text: chunk } }, pageAccessToken)
    }
    return lastResult
  }

  return callSendAPI(recipientId, { message: { text } }, pageAccessToken)
}

/**
 * Send a message with quick reply buttons
 */
export async function sendQuickReplies(
  recipientId: string,
  text: string,
  replies: { title: string; payload: string }[],
  pageAccessToken: string
): Promise<SendApiResponse | null> {
  return callSendAPI(
    recipientId,
    {
      message: {
        text,
        quick_replies: replies.slice(0, 13).map((r) => ({
          content_type: 'text',
          title: r.title.substring(0, 20),
          payload: r.payload,
        })),
      },
    },
    pageAccessToken
  )
}

/**
 * Send a message with URL buttons
 */
export async function sendButtonMessage(
  recipientId: string,
  text: string,
  buttons: { title: string; url: string }[],
  pageAccessToken: string
): Promise<SendApiResponse | null> {
  return callSendAPI(
    recipientId,
    {
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: text.substring(0, 640),
            buttons: buttons.slice(0, 3).map((b) => ({
              type: 'web_url',
              url: b.url,
              title: b.title.substring(0, 20),
            })),
          },
        },
      },
    },
    pageAccessToken
  )
}

/**
 * Send a product card carousel via generic template
 */
export async function sendProductCards(
  recipientId: string,
  products: {
    title: string
    subtitle: string
    imageUrl?: string
    buttonUrl?: string
    buttonTitle?: string
  }[],
  pageAccessToken: string
): Promise<SendApiResponse | null> {
  const elements = products.slice(0, 10).map((p) => {
    const element: Record<string, unknown> = {
      title: p.title.substring(0, 80),
      subtitle: p.subtitle.substring(0, 80),
    }
    if (p.imageUrl) element.image_url = p.imageUrl
    if (p.buttonUrl) {
      element.buttons = [{
        type: 'web_url',
        url: p.buttonUrl,
        title: (p.buttonTitle || 'Дэлгэрэнгүй').substring(0, 20),
      }]
    }
    return element
  })

  return callSendAPI(
    recipientId,
    {
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements,
          },
        },
      },
    },
    pageAccessToken
  )
}

/**
 * Send typing indicator (on/off)
 */
export async function sendTypingIndicator(
  recipientId: string,
  typing: boolean,
  pageAccessToken: string
): Promise<void> {
  await callSendAPI(
    recipientId,
    { sender_action: typing ? 'typing_on' : 'typing_off' },
    pageAccessToken
  )
}

/**
 * Mark message as seen
 */
export async function markSeen(
  recipientId: string,
  pageAccessToken: string
): Promise<void> {
  await callSendAPI(recipientId, { sender_action: 'mark_seen' }, pageAccessToken)
}

// ---- Helpers ----

function splitText(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Try to split at a newline or space
    let splitIndex = remaining.lastIndexOf('\n', maxLength)
    if (splitIndex < maxLength * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', maxLength)
    }
    if (splitIndex < maxLength * 0.3) {
      splitIndex = maxLength
    }

    chunks.push(remaining.substring(0, splitIndex))
    remaining = remaining.substring(splitIndex).trimStart()
  }

  return chunks
}
