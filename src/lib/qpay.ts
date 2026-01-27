/**
 * QPay Payment Gateway Integration
 *
 * QPay API documentation: https://developer.qpay.mn
 * This module handles invoice creation, payment checking, and callback verification.
 */

const QPAY_BASE_URL = process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn/v2'
const QPAY_USERNAME = process.env.QPAY_USERNAME || ''
const QPAY_PASSWORD = process.env.QPAY_PASSWORD || ''
const QPAY_INVOICE_CODE = process.env.QPAY_INVOICE_CODE || ''

interface QPayAuthResponse {
  token_type: string
  refresh_expires_in: number
  refresh_token: string
  access_token: string
  expires_in: number
}

interface QPayInvoiceRequest {
  invoice_code: string
  sender_invoice_no: string
  invoice_receiver_code: string
  invoice_description: string
  amount: number
  callback_url: string
}

export interface QPayInvoiceResponse {
  invoice_id: string
  qr_text: string
  qr_image: string // base64 QR image
  qPay_shortUrl: string
  urls: {
    name: string
    description: string
    logo: string
    link: string
  }[]
}

export interface QPayPaymentCheckResponse {
  count: number
  paid_amount: number
  rows: {
    payment_id: string
    payment_status: string
    payment_date: string
    payment_fee: string
    payment_amount: string
    payment_currency: string
    payment_wallet: string
    transaction_type: string
  }[]
}

// Token cache
let tokenCache: { token: string; expiresAt: number } | null = null

/**
 * Get QPay access token (cached)
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token
  }

  const response = await fetch(`${QPAY_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${QPAY_USERNAME}:${QPAY_PASSWORD}`).toString('base64')}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`QPay auth failed: ${response.status} ${text}`)
  }

  const data: QPayAuthResponse = await response.json()

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

/**
 * Create a QPay invoice for an order
 */
export async function createQPayInvoice(params: {
  orderNumber: string
  amount: number
  description: string
  callbackUrl: string
  receiverCode?: string
}): Promise<QPayInvoiceResponse> {
  const token = await getAccessToken()

  const invoiceData: QPayInvoiceRequest = {
    invoice_code: QPAY_INVOICE_CODE,
    sender_invoice_no: params.orderNumber,
    invoice_receiver_code: params.receiverCode || '',
    invoice_description: params.description,
    amount: params.amount,
    callback_url: params.callbackUrl,
  }

  const response = await fetch(`${QPAY_BASE_URL}/invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(invoiceData),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`QPay invoice creation failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Check payment status for an invoice
 */
export async function checkQPayPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
  const token = await getAccessToken()

  const response = await fetch(`${QPAY_BASE_URL}/payment/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      object_type: 'INVOICE',
      object_id: invoiceId,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`QPay payment check failed: ${response.status} ${text}`)
  }

  return response.json()
}

/**
 * Check if QPay is configured
 */
export function isQPayConfigured(): boolean {
  return !!(QPAY_USERNAME && QPAY_PASSWORD && QPAY_INVOICE_CODE)
}
