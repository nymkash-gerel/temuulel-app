// k6 load test: realistic chat-widget order flow
//
// Run locally:
//   brew install k6
//   k6 run scripts/load-test/order-flow.js
//
// With env override (test against a staging URL):
//   BASE_URL=https://staging.temuulel.com STORE_ID=... k6 run scripts/load-test/order-flow.js
//
// Run in cloud (free tier — up to 50 VUs):
//   k6 cloud login
//   k6 cloud scripts/load-test/order-flow.js
//
// Profile: ramps from 1 → 50 concurrent users over 2 min, holds for 3 min,
// ramps down. Each VU completes a full 5-message order flow then sleeps
// 2-5 s and repeats.

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ---------------- config ----------------

const BASE_URL = __ENV.BASE_URL || 'https://temuulel.com'
const STORE_ID = __ENV.STORE_ID || 'e6c3a3ef-137a-41c0-bcd0-639cb13186f0' // Test Demo Shop
const PRODUCT_QUERY = __ENV.PRODUCT_QUERY || 'iphone avya'

export const options = {
  scenarios: {
    order_flow: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },   // ramp to 10
        { duration: '1m', target: 30 },   // ramp to 30
        { duration: '3m', target: 50 },   // hold 50
        { duration: '1m', target: 0 },    // ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],     // <5% errors
    http_req_duration: ['p(95)<3000'],   // 95% of requests under 3s
    'order_completion_rate': ['rate>0.85'], // 85%+ orders complete
  },
}

// ---------------- custom metrics ----------------

const orderCompletions = new Counter('order_completions')
const orderCompletionRate = new Rate('order_completion_rate')
const stepDuration = new Trend('step_duration_ms')

// ---------------- helpers ----------------

function chatStep(conv, msg, step) {
  const t0 = Date.now()
  const res = http.post(
    `${BASE_URL}/api/chat/widget`,
    JSON.stringify({
      store_id: STORE_ID,
      conversation_id: conv,
      customer_message: msg,
      sender_id: `loadtest-${conv}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step } }
  )
  stepDuration.add(Date.now() - t0, { step })
  return res
}

// ---------------- VU script ----------------

export default function () {
  const conv = uuidv4()
  let completed = false

  group('order-flow', () => {
    // 1. Greeting / product query
    const r1 = chatStep(conv, PRODUCT_QUERY, 'product_query')
    if (!check(r1, { 'p1 status 200': r => r.status === 200 })) return
    sleep(1 + Math.random())

    // 2. Name
    const r2 = chatStep(conv, `Loadtest User ${conv.slice(0, 6)}`, 'name')
    if (!check(r2, { 'p2 status 200': r => r.status === 200 })) return
    sleep(1 + Math.random())

    // 3. Address
    const r3 = chatStep(conv, 'СБД 1-р хороо, 99-р байр', 'address')
    if (!check(r3, { 'p3 status 200': r => r.status === 200 })) return
    sleep(1 + Math.random())

    // 4. Phone (if not already captured from address combo)
    const r4body = (() => { try { return JSON.parse(r3.body) } catch { return {} } })()
    if (r4body.order_step !== 'confirming') {
      const r4 = chatStep(conv, '99' + Math.floor(Math.random() * 1e6).toString().padStart(6, '0'), 'phone')
      if (!check(r4, { 'p4 status 200': r => r.status === 200 })) return
      sleep(1 + Math.random())
    }

    // 5. Confirm
    const r5 = chatStep(conv, 'тийм', 'confirm')
    const ok = check(r5, {
      'p5 status 200': r => r.status === 200,
      'p5 order created': r => {
        try { return JSON.parse(r.body).intent === 'order_created' } catch { return false }
      },
    })
    if (ok) {
      orderCompletions.add(1)
      completed = true
    }
  })

  orderCompletionRate.add(completed)

  sleep(2 + Math.random() * 3) // 2-5 s think time before VU restarts
}

export function handleSummary(data) {
  const m = data.metrics
  const p95 = m.http_req_duration?.values?.['p(95)'] ?? 0
  const errors = m.http_req_failed?.values?.rate ?? 0
  const completion = m.order_completion_rate?.values?.rate ?? 0
  const orders = m.order_completions?.values?.count ?? 0
  const summary = {
    p95_ms: Math.round(p95),
    error_rate_pct: Math.round(errors * 10000) / 100,
    completion_rate_pct: Math.round(completion * 10000) / 100,
    orders_created: orders,
    pass: p95 < 3000 && errors < 0.05 && completion > 0.85,
  }
  return {
    stdout: '\n' + JSON.stringify(summary, null, 2) + '\n',
    'load-test-summary.json': JSON.stringify(summary, null, 2),
  }
}
