/**
 * Telegram Bot API client
 *
 * Sends messages and inline keyboards to staff via Telegram.
 * Used by the staff notification system for appointment alerts.
 */

const TELEGRAM_API = 'https://api.telegram.org/bot'

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  return token
}

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
}

async function callApi(method: string, body: Record<string, unknown>): Promise<TelegramResponse> {
  const token = getToken()
  const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  return res.json() as Promise<TelegramResponse>
}

/**
 * Send a plain text message to a Telegram chat.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramResponse> {
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  })
}

export interface InlineButton {
  text: string
  callback_data: string
}

/**
 * Send a message with an inline keyboard (action buttons).
 */
export async function sendTelegramInlineKeyboard(
  chatId: string,
  text: string,
  buttons: InlineButton[]
): Promise<TelegramResponse> {
  return callApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [buttons.map(b => ({ text: b.text, callback_data: b.callback_data }))],
    },
  })
}

/**
 * Answer a callback query (required after user taps inline button).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<TelegramResponse> {
  return callApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || '',
  })
}

/**
 * Edit an existing message's text (used after confirm/reject callback).
 */
export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string
): Promise<TelegramResponse> {
  return callApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  })
}

/**
 * Generate a deep link for staff to connect their Telegram.
 * When staff clicks this link, Telegram opens and sends /start STAFF_ID.
 */
export function getTelegramBotLink(staffId: string): string {
  const token = getToken()
  // Bot username is derived from the token — we need it from env or config.
  // Fallback: use TELEGRAM_BOT_USERNAME env var.
  const username = process.env.TELEGRAM_BOT_USERNAME || ''
  if (!username) {
    // If username not set, return a generic message
    return `Telegram бот: ${token.split(':')[0]} — /start ${staffId} гэж илгээнэ үү`
  }
  return `https://t.me/${username}?start=${staffId}`
}
