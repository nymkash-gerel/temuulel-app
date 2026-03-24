/**
 * Shared test utilities for all test scripts.
 *
 * Eliminates code duplication — chat(), delay(), assert(), DB helpers
 * are defined ONCE here and imported by all test scripts.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client (singleton)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''

let _sb: SupabaseClient | null = null
export function getSupabase(): SupabaseClient {
  if (!_sb) _sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  return _sb
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LOCAL = 'http://localhost:3000'
export const PROD = 'https://temuulel-app.vercel.app'
export const DRIVER_CHAT_ID = 1999860372
export const DRIVER_BOT_TOKEN = process.env.DRIVER_TELEGRAM_BOT_TOKEN || ''
export const DRIVER_WEBHOOK_SECRET = process.env.DRIVER_TELEGRAM_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET || ''

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Chat helper — two-step: save message + get AI response
// ---------------------------------------------------------------------------

export interface ChatResult {
  conversationId: string | null
  saveStatus: number
  aiStatus: number
  intent: string
  response: string
  productsFound: number | undefined
  orderStep: string | null | undefined
}

export async function chat(
  api: string,
  storeId: string,
  senderId: string,
  message: string,
  conversationId?: string | null,
  delayMs = 1000,
): Promise<ChatResult> {
  await delay(delayMs)

  // Step 1: Save customer message
  const saveRes = await fetch(`${api}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: senderId, store_id: storeId, role: 'user', content: message }),
  })
  const saveData = saveRes.ok ? await saveRes.json() : {}
  const convId = saveData.conversation_id || conversationId || null

  await delay(300)

  // Step 2: Get AI response
  const aiRes = await fetch(`${api}/api/chat/widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: storeId, customer_message: message, sender_id: senderId, conversation_id: convId }),
  })
  const aiData = aiRes.ok ? await aiRes.json() : { intent: 'error', response: `HTTP ${aiRes.status}` }

  return {
    conversationId: convId,
    saveStatus: saveRes.status,
    aiStatus: aiRes.status,
    intent: aiData.intent || 'unknown',
    response: aiData.response || '',
    productsFound: aiData.metadata?.products_found ?? aiData.products_found,
    orderStep: aiData.metadata?.order_step ?? aiData.order_step ?? null,
  }
}

// ---------------------------------------------------------------------------
// Driver Telegram webhook helper
// ---------------------------------------------------------------------------

export async function driverWebhook(api: string, payload: object): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${api}/api/telegram/driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': DRIVER_WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  })
  const body = res.ok ? await res.json().catch(() => null) : null
  return { status: res.status, body }
}

export function callbackPayload(data: string) {
  return {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 1, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data,
    },
  }
}

export function messagePayload(text: string) {
  return {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text,
    },
  }
}

// ---------------------------------------------------------------------------
// Send real Telegram message to driver
// ---------------------------------------------------------------------------

export async function sendDriverTelegram(text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${DRIVER_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DRIVER_CHAT_ID, text }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

export async function getOrCreateDriver(storeId: string): Promise<string> {
  const sb = getSupabase()
  const chatId = String(DRIVER_CHAT_ID)
  const { data: existing } = await sb
    .from('delivery_drivers')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .single()
  if (existing) return existing.id

  const { data: created } = await sb
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: 'E2E Test Driver',
      phone: '99998888',
      telegram_chat_id: chatId,
      telegram_linked_at: new Date().toISOString(),
      status: 'active',
    })
    .select('id')
    .single()
  return created!.id
}

export async function createOrderViaChat(
  api: string,
  storeId: string,
  scenarioName: string,
): Promise<{
  conversationId: string
  orderId: string
  orderNumber: string
  deliveryId: string
  deliveryNumber: string
  senderId: string
} | null> {
  const sid = `web_e2e_${scenarioName}_${Date.now()}`
  let r = await chat(api, storeId, sid, 'Сайн байна уу')
  r = await chat(api, storeId, sid, 'Цамц байна уу?', r.conversationId)
  r = await chat(api, storeId, sid, '1', r.conversationId)
  r = await chat(api, storeId, sid, 'Бат', r.conversationId)
  r = await chat(api, storeId, sid, '99776655', r.conversationId)
  r = await chat(api, storeId, sid, 'БГД 3-р хороо 15 байр 201 тоот', r.conversationId)
  r = await chat(api, storeId, sid, 'Тийм', r.conversationId)

  await delay(1500)
  const sb = getSupabase()

  const { data: order } = await sb
    .from('orders')
    .select('id, order_number')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!order) return null

  const { data: delivery } = await sb
    .from('deliveries')
    .select('id, delivery_number')
    .eq('order_id', order.id)
    .single()

  if (!delivery) return null

  return {
    conversationId: r.conversationId || '',
    orderId: order.id,
    orderNumber: order.order_number,
    deliveryId: delivery.id,
    deliveryNumber: delivery.delivery_number,
    senderId: sid,
  }
}

export async function assignAndPickup(api: string, deliveryId: string, driverId: string): Promise<boolean> {
  const sb = getSupabase()
  await sb.from('deliveries').update({ driver_id: driverId, status: 'assigned' }).eq('id', deliveryId)
  await delay(500)

  const res = await driverWebhook(api, callbackPayload(`confirm_received:${deliveryId}`))
  await delay(500)
  return res.status === 200
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

let _passed = 0
let _failed = 0
let _total = 0
const _errors: string[] = []

export function resetCounters() {
  _passed = 0
  _failed = 0
  _total = 0
  _errors.length = 0
}

export function assert(condition: boolean, message: string, details?: string) {
  _total++
  if (condition) {
    _passed++
    console.log(`    ✅ ${message}`)
  } else {
    _failed++
    const msg = details ? `${message} — ${details}` : message
    _errors.push(msg)
    console.log(`    🔴 ${message}${details ? ` (${details})` : ''}`)
  }
}

export function ok(step: number | string, msg: string) {
  console.log(`  Step ${step}: ${msg}`)
}

export function dbOk(msg: string) {
  console.log(`  DB: ✅ ${msg}`)
}

export function dbFail(msg: string) {
  _failed++
  _errors.push(msg)
  console.log(`  DB: 🔴 ${msg}`)
}

export function scenarioResult(pass: boolean) {
  if (pass) {
    _passed++
    console.log('  Result: ✅ PASS\n')
  } else {
    _failed++
    console.log('  Result: 🔴 FAIL\n')
  }
}

export function getSummary() {
  return { passed: _passed, failed: _failed, total: _total, errors: [..._errors] }
}

export function printSummary(label = 'TEST SUMMARY') {
  console.log('═'.repeat(55))
  console.log(`${label}: ${_passed} passed, ${_failed} failed`)
  if (_errors.length > 0) {
    console.log('\n  FAILURES:')
    _errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`))
  }
  console.log('')
}

export function section(title: string) {
  console.log(title)
}

// ---------------------------------------------------------------------------
// Facebook message extraction helpers
// ---------------------------------------------------------------------------

function decodeFB(s: string): string {
  try {
    return Buffer.from(s, 'latin1').toString('utf-8')
  } catch {
    return s
  }
}

export function extractCustomerMessages(
  filePath: string,
  storeName: string,
  maxMessages: number,
): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require('fs')
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    const messages: string[] = []
    for (const m of [...data.messages].reverse()) {
      const sender = decodeFB(m.sender_name || '')
      const content = m.content ? decodeFB(m.content) : ''
      if (sender === storeName || !content) continue
      if (
        content.includes('replied to') ||
        content.includes('reacted') ||
        content.includes('sent a photo')
      )
        continue
      if (content.length >= 3 && content.length <= 200)
        messages.push(content.trim())
      if (messages.length >= maxMessages) break
    }
    return messages
  } catch {
    return []
  }
}
