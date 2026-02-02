/**
 * SMS notification library.
 *
 * Uses a configurable HTTP-based SMS API (env: SMS_API_URL, SMS_API_KEY).
 * In dev mode (no SMS_API_URL), logs to console only.
 */

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an SMS message to a phone number.
 */
export async function sendSMS(phone: string, message: string): Promise<SMSResult> {
  const apiUrl = process.env.SMS_API_URL
  const apiKey = process.env.SMS_API_KEY

  if (!apiUrl) {
    console.log(`[SMS-DEV] To: ${phone}\n${message}`)
    return { success: true, messageId: `dev-${Date.now()}` }
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ phone, message }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `SMS API error: ${res.status} ${text}` }
    }

    const data = await res.json()
    return { success: true, messageId: data.message_id || data.id }
  } catch (err) {
    const message_err = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message_err }
  }
}

/**
 * Send a delivery tracking SMS to a customer.
 */
export async function sendDeliveryTrackingSMS(
  phone: string,
  deliveryNumber: string,
  customerName?: string | null
): Promise<SMSResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  const trackingUrl = `${baseUrl}/track/${deliveryNumber}`

  const greeting = customerName ? `${customerName} танд ` : ''
  const message = `${greeting}Сайн байна уу! Таны захиалга хүргэлтэд гарлаа.\n\nХүргэлтийн дугаар: ${deliveryNumber}\nХянах: ${trackingUrl}\n\n— Temuulel`

  return sendSMS(phone, message)
}
