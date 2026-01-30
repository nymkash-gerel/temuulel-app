# Temuulel Commerce Platform — Agent Instructions

## Main Concept

Temuulel is a **Mongolian-first multi-channel ecommerce chatbot platform**. Store owners connect their Facebook Page, configure AI auto-reply, accept QPay payments, and manage orders — all from one dashboard. The platform is built as a multi-tenant SaaS where each store is isolated via Supabase Row-Level Security.

**Core flow:**
Customer sends message (Messenger/Web) → AI classifies intent → Auto-replies with products/order info → Customer places order → QPay payment → Owner gets notified (email + in-app + webhook)

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  Next.js 16 (App Router) + React 19 + Tailwind v4   │
│                                                      │
│  /dashboard/*        → Owner UI (products, orders,   │
│                        chat, analytics, settings)    │
│  /(auth)/*           → Login, signup, verify         │
│  /                   → Public landing page           │
│  ChatWidget.tsx      → Embeddable customer widget    │
│  NotificationBell.tsx→ Real-time bell + dropdown     │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                   API LAYER                           │
│  /api/chat           → Message save/retrieve          │
│  /api/chat/ai        → Intent classification + reply  │
│  /api/chat/widget    → Widget initialization          │
│  /api/webhook/messenger → Facebook webhook receiver   │
│  /api/payments/*     → QPay create/callback/check     │
│  /api/notifications  → GET unread, PATCH mark read    │
│  /api/products/search→ Product search (Mongolian)     │
│  /api/orders         → POST create order + shipping   │
│  /api/orders/search  → Order lookup                   │
│  /api/orders/status  → PATCH update order status      │
│  /api/cron/daily-report → Daily sales report email    │
│  /api/auth/*         → OAuth callback, signout        │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                SERVICE LAYER (src/lib/)               │
│                                                      │
│  chat-ai.ts       → Shared AI intent classification, │
│                      search helpers, response gen     │
│  rate-limit.ts    → In-memory sliding window limiter │
│  notifications.ts  → Central dispatcher              │
│                      (email + in-app + webhook)       │
│  email.ts          → Resend transactional emails     │
│  webhook.ts        → HMAC-signed outgoing webhooks   │
│  messenger.ts      → Facebook Graph API helpers      │
│  qpay.ts           → QPay token cache + invoice API  │
│  supabase/server.ts→ Server-side Supabase client     │
│  supabase/client.ts→ Browser-side Supabase client    │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│                  DATA LAYER                           │
│  Supabase (PostgreSQL + Auth + Realtime + Storage)   │
│                                                      │
│  16 Tables:                                          │
│  users, stores, store_subscriptions, store_members,  │
│  products, product_variants, customers, orders,      │
│  order_items, conversations, messages, notifications, │
│  chat_sessions, chat_messages, subscription_plans    │
│  + storage.buckets (product images)                  │
│                                                      │
│  Security: RLS policies isolate data per store owner  │
│  Realtime: conversations + messages + notifications   │
└──────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              EXTERNAL SERVICES                        │
│                                                      │
│  Facebook Graph API  → Messenger send/receive        │
│  QPay API            → Payment QR + verification     │
│  Resend API          → Transactional email delivery  │
│  n8n / Zapier        → Outgoing webhook consumers    │
└──────────────────────────────────────────────────────┘
```

---

## Database Schema (Quick Reference)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Auth users | `email`, `notification_settings` (JSONB) |
| `stores` | Tenants | `owner_id`, `facebook_page_id`, `ai_auto_reply`, `webhook_url` |
| `store_subscriptions` | Plan limits | `plan_id`, `messages_used` |
| `store_members` | Team | `user_id`, `role` (owner/admin/staff) |
| `products` | Catalog | `store_id`, `base_price`, `images`, `status`, `has_variants` |
| `product_variants` | SKU variants | `product_id`, `size`, `color`, `stock_quantity` |
| `customers` | Multi-channel | `messenger_id`, `instagram_id`, `whatsapp_id`, `channel` |
| `orders` | Sales | `order_number`, `payment_method`, `payment_status`, `status` |
| `order_items` | Line items | `order_id`, `product_id`, `variant_id`, `quantity` |
| `conversations` | Chat threads | `customer_id`, `channel`, `unread_count` |
| `messages` | Chat messages | `conversation_id`, `is_from_customer`, `is_ai_response` |
| `notifications` | In-app alerts | `store_id`, `type`, `title`, `body`, `is_read` |
| `subscription_plans` | 4 plans | Free / Basic (29,900₮) / Pro (79,900₮) / Enterprise |

---

## Notification System

```
dispatchNotification(storeId, event, data)
  │
  ├── 1. EMAIL (if user.notification_settings.email_{event} === true)
  │   ├── new_order  → "Шинэ захиалга #ORD-XXX"
  │   ├── new_message→ "Шинэ мессеж: {customer}"
  │   └── low_stock  → "Нөөц дуусаж байна: {product}"
  │
  ├── 2. PUSH (if user.notification_settings.push_{event} === true)
  │   └── Web Push via VAPID keys → browser notification
  │
  ├── 3. IN-APP (always saved to notifications table)
  │   └── NotificationBell.tsx via Supabase Realtime subscription
  │       + notification sound if sound_enabled === true
  │
  └── 4. WEBHOOK (if store.webhook_url configured + event enabled)
      └── Upstash QStash → /api/webhook/deliver → store's webhook_url
      └── HMAC-SHA256 signed, 3 retries with exponential backoff
      └── Falls back to direct delivery when QStash not configured
```

**Trigger points:**
| File | Event | When |
|------|-------|------|
| `/api/payments/callback/route.ts` | `new_order` | QPay callback confirms payment |
| `/api/payments/check/route.ts` | `new_order` | QPay check confirms payment |
| `/api/chat/route.ts` | `new_message` | Customer sends message via widget |
| `/api/webhook/messenger/route.ts` | `new_message` | Messenger message received |
| `/api/webhook/messenger/route.ts` | `new_customer` | First-time Messenger contact |
| `/api/orders/route.ts` | `new_order` | Order created via POST /api/orders |
| `/api/orders/status/route.ts` | `order_status` | Order status changes |
| `src/lib/stock.ts` | `low_stock` | Variant stock falls below threshold |

---

## Key Patterns

### Authentication
- Supabase Auth with cookie-based SSR (`@supabase/ssr`)
- `middleware.ts` protects `/dashboard/*` routes
- Service role key used in API routes for server-side DB access

### Multi-Tenancy
- Every table has `store_id` foreign key
- RLS policies: `stores.owner_id = auth.uid()` or `store_members.user_id = auth.uid()`
- Dashboard layout fetches user's store on every render

### AI Chatbot
- Shared logic in `src/lib/chat-ai.ts` — used by both `/api/chat/ai` and `/api/chat/widget`
- Mongolian keyword-based intent classification (product_search, order_status, greeting, thanks, complaint, size_info, payment, shipping)
- Template responses with dynamic product/order data
- Auto-reply toggle per store (`ai_auto_reply`)
- Handoff keyword matching for immediate escalation to human agents
- **Smart escalation** — cumulative scoring engine (`src/lib/escalation.ts`) that detects complaint, frustration, return/exchange, payment disputes, repeated messages, and AI-fail-to-resolve signals. Auto-escalates to human agent when score crosses threshold (default 60). Dashboard shows priority badges and "Хүлээж авах" (Take over) button.
- Rich Messenger responses: product cards, quick replies

### Security & Rate Limiting
- Mandatory HMAC-SHA256 signature verification on Messenger webhook (`FACEBOOK_APP_SECRET` required)
- In-memory sliding window rate limiter (`src/lib/rate-limit.ts`) on all public endpoints
- Input validation: message content max 2000 chars, query max 200 chars, limit caps on pagination
- Rate limits per endpoint: chat 30/min, widget 20/min, products 30/min, payments 10/min

### Payments
- QPay: QR code generation → async callback → verify → confirm order
- Bank transfer: manual admin confirmation
- Cash on delivery: manual admin confirmation
- Payment metadata stored as JSON in `orders.notes`

---

## File Map

### Service Layer (`src/lib/`)
```
src/lib/chat-ai.ts            — Shared AI: intent keywords, classifyIntent(), searchProducts(),
                                 searchOrders(), generateResponse(), matchesHandoffKeywords()
src/lib/escalation.ts         — Smart escalation: scoring engine, processEscalation(),
                                 signal detection (complaint, frustration, repeat, AI-fail)
src/lib/rate-limit.ts         — In-memory sliding window rate limiter + getClientIp()
src/lib/notifications.ts      — Central notification dispatcher (email + in-app + webhook)
src/lib/email.ts              — Resend email wrapper + templates
src/lib/webhook.ts            — QStash-backed outgoing webhooks (HMAC-SHA256 signed, 3 retries)
src/lib/messenger.ts          — Facebook Graph API helpers (send, verify, cards)
src/lib/qpay.ts               — QPay token cache + invoice/payment API
src/lib/database.types.ts     — Auto-generated Supabase TypeScript types (733 lines)
src/lib/supabase/server.ts    — Server-side Supabase client with cookies
src/lib/supabase/client.ts    — Browser-side Supabase client
```

### API Routes (`src/app/api/`)
```
chat/route.ts                 — Message save/retrieve + rate limiting + input validation
chat/ai/route.ts              — AI intent classification + reply (uses chat-ai.ts)
chat/widget/route.ts          — Widget AI endpoint (uses chat-ai.ts) + handoff
webhook/messenger/route.ts    — Facebook webhook (mandatory signature verification)
webhook/deliver/route.ts      — QStash callback target for reliable webhook delivery
payments/create/route.ts      — QPay/bank/cash invoice creation
payments/check/route.ts       — Payment status check + rate limiting
payments/callback/route.ts    — QPay async payment callback
products/search/route.ts      — Product search + rate limiting + query cap
orders/route.ts               — POST create order + shipping calculation
orders/search/route.ts        — Order lookup
orders/status/route.ts        — PATCH update order status + notifications
notifications/route.ts        — GET unread, PATCH mark read
cron/daily-report/route.ts    — Vercel Cron: daily sales report email
auth/callback/route.ts        — Supabase OAuth callback
auth/signout/route.ts         — Sign out + redirect
```

### Components
```
src/components/ui/ChatWidget.tsx        — Embeddable customer chat widget
src/components/ui/NotificationBell.tsx  — Real-time bell + dropdown
src/components/ui/ImageUpload.tsx       — Product image upload
src/components/dashboard/DashboardLayout.tsx — Sidebar + nav layout
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=

# Facebook Messenger
FACEBOOK_APP_SECRET=
FACEBOOK_PAGE_ACCESS_TOKEN=
MESSENGER_VERIFY_TOKEN=

# Email Notifications (Resend)
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com

# Web Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@yourdomain.com

# Cron Job Security
CRON_SECRET=

# Upstash QStash (reliable webhook delivery)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# QPay Payment Gateway
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_INVOICE_CODE=
```

---

## Test Coverage

| Test File | Tests | Covers |
|-----------|-------|--------|
| `chat/ai/route.test.ts` | 31 | Intent classification, Mongolian keywords, response generation (imports from `chat-ai.ts`) |
| `chat/chat-bridge.test.ts` | 20 | Message saving, conversation resolution |
| `payments/payments.test.ts` | 18 | QPay callback, payment status, invoice creation |
| `lib/messenger.test.ts` | 14 | Signature verify, send text/cards/quick replies |
| `lib/qpay.test.ts` | 8 | Token caching, invoice creation, payment check |
| `lib/webhook.test.ts` | 10 | QStash delivery, direct fallback, HMAC signing, event filtering |
| `lib/stock.test.ts` | 9 | Stock decrement, low-stock notification threshold |
| `lib/notifications.test.ts` | 15 | Notification dispatcher, email/push/webhook triggering, escalation event |
| `lib/escalation.test.ts` | 31 | Scoring engine, signal detection, level mapping, repeated message, AI-fail-to-resolve |
| `orders/route.test.ts` | 14 | Order creation, shipping calculation, validation |
| **Total** | **170** | **All pass** |

---

## To-Do List (What's Next)

### High Priority
- [ ] **Instagram DM integration** — UI placeholder exists at `/dashboard/settings/integrations`, needs webhook receiver + message sender (similar to Messenger)
- [ ] **WhatsApp Business integration** — Same pattern as Instagram, using WhatsApp Cloud API

### Low Priority
- [ ] **Email templates** — Move inline HTML to proper React Email templates
- [ ] **Bulk product import validation** — `/dashboard/products/import` exists, needs better error handling

### Technical Debt
- [ ] **Remove legacy chat_sessions/chat_messages** — Backward compat tables, can be dropped once all clients use conversations/messages
- [ ] **Production error tracking** — Add Sentry or similar for production error monitoring
- [ ] **Redis-backed rate limiting** — Replace in-memory rate limiter with Upstash Redis for multi-instance deployments

### Completed
- [x] **Rate limiting** — In-memory sliding window rate limiter on all public API routes (chat 30/min, widget 20/min, products 30/min, payments 10/min)
- [x] **Input validation** — Message content max 2000 chars, query max 200 chars, pagination limits capped
- [x] **Mandatory webhook signature verification** — `FACEBOOK_APP_SECRET` now required for Messenger webhook
- [x] **DRY AI logic** — Extracted shared intent classification, search, and response generation into `src/lib/chat-ai.ts`
- [x] **Type safety improvements** — Added `typeof` null checks on AI response data in webhook handler
- [x] **Supabase Realtime for notifications** — Replaced 30s polling in NotificationBell with Supabase Realtime subscription (migration: `002_notifications_realtime.sql`)
- [x] **Order creation API** — `POST /api/orders` with shipping zone calculation, free shipping thresholds, rate limiting, and `new_order` notification dispatch
- [x] **Notification sound** — `NotificationBell.tsx` plays `/notification.wav` on new realtime INSERT when `sound_enabled` is true
- [x] **Daily report email** — Vercel Cron job at `/api/cron/daily-report` sends daily sales summary (orders, revenue, customers, messages, top products) via Resend
- [x] **Push notifications** — Web Push via VAPID keys, service worker (`/public/sw.js`), `sendPushToUser()` wired into `dispatchNotification()` for all events
- [x] **Low stock notification trigger** — `decrementStockAndNotify()` in `src/lib/stock.ts` dispatches `low_stock` when variant stock falls below threshold
- [x] **Order status change notifications** — `dispatchNotification(storeId, 'order_status', ...)` called in `PATCH /api/orders/status` on status transitions
- [x] **Shipping zone integration** — `POST /api/orders` calculates shipping from store's `shipping_settings` zones + free shipping threshold
- [x] **Analytics dashboard** — Full analytics page with revenue charts, order metrics, AI stats, top products, subscription usage
- [x] **Team member management** — Invite/remove flow with role-based access (owner/admin/staff)
- [x] **Notification tests** — 11 tests in `notifications.test.ts`, 14 tests in `orders/route.test.ts` (131 total)
- [x] **Webhook retry logic (QStash)** — Replaced fire-and-forget webhooks with Upstash QStash for reliable delivery (3 retries, exponential backoff). Falls back to direct delivery when QStash not configured.
- [x] **Smart escalation system** — Cumulative scoring engine (`src/lib/escalation.ts`) with 7 signal types (complaint, frustration, return/exchange, payment dispute, repeated message, AI-fail-to-resolve, long unresolved thread). Auto-escalates conversations when score crosses threshold (default 60). Dashboard shows priority badges (critical/high/medium), "Шилжсэн" filter tab, and "Хүлээж авах" (Take over) button. 31 tests in `escalation.test.ts`. Migration: `003_escalation.sql`.
