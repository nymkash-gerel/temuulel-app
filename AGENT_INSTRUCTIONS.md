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
│  /api/orders/search  → Order lookup                   │
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
  ├── 2. IN-APP (always saved to notifications table)
  │   └── NotificationBell.tsx via Supabase Realtime subscription
  │
  └── 3. WEBHOOK (if store.webhook_url configured + event enabled)
      └── HMAC-SHA256 signed POST to external system
```

**Trigger points:**
| File | Event | When |
|------|-------|------|
| `/api/payments/callback/route.ts` | `new_order` | QPay callback confirms payment |
| `/api/payments/check/route.ts` | `new_order` | QPay check confirms payment |
| `/api/chat/route.ts` | `new_message` | Customer sends message via widget |
| `/api/webhook/messenger/route.ts` | `new_message` | Messenger message received |
| `/api/webhook/messenger/route.ts` | `new_customer` | First-time Messenger contact |

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
- Handoff keyword matching for escalation to human agents
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
src/lib/rate-limit.ts         — In-memory sliding window rate limiter + getClientIp()
src/lib/notifications.ts      — Central notification dispatcher (email + in-app + webhook)
src/lib/email.ts              — Resend email wrapper + templates
src/lib/webhook.ts            — HMAC-SHA256 signed outgoing webhooks
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
payments/create/route.ts      — QPay/bank/cash invoice creation
payments/check/route.ts       — Payment status check + rate limiting
payments/callback/route.ts    — QPay async payment callback
products/search/route.ts      — Product search + rate limiting + query cap
orders/search/route.ts        — Order lookup
notifications/route.ts        — GET unread, PATCH mark read
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
| `lib/webhook.test.ts` | 6 | HMAC signing, event filtering, payload structure |
| **Total** | **97** | **All pass** |

---

## To-Do List (What's Next)

### High Priority
- [ ] **Instagram DM integration** — UI placeholder exists at `/dashboard/settings/integrations`, needs webhook receiver + message sender (similar to Messenger)
- [ ] **WhatsApp Business integration** — Same pattern as Instagram, using WhatsApp Cloud API
- [ ] **Low stock notification trigger** — Add `dispatchNotification(storeId, 'low_stock', ...)` when variant `stock_quantity` drops below threshold (on order creation or stock update)
- [ ] **Daily report email** — Scheduled job to send daily sales summary (notification settings toggle exists but no implementation)

### Medium Priority
- [x] **Supabase Realtime for notifications** — Replaced 30s polling with Supabase realtime subscription on `notifications` table
- [ ] **Push notifications** — Web Push API integration (settings toggles exist: `push_new_order`, `push_new_message`, `push_low_stock`)
- [ ] **Analytics dashboard** — `/dashboard/analytics` page exists but has no charts/data
- [ ] **Team member management** — `/dashboard/settings/team` UI exists, invite/remove flow needed
- [ ] **Shipping zone configuration** — `/dashboard/settings/shipping` UI exists, rate calculation needed

### Low Priority
- [ ] **Order status change notifications** — Dispatch `order_status` event when order moves through pending → confirmed → processing → shipped → delivered
- [ ] **Notification sound** — Settings toggle exists (`sound_enabled`), needs audio playback in NotificationBell
- [ ] **Email templates** — Move inline HTML to proper React Email templates
- [ ] **Bulk product import validation** — `/dashboard/products/import` exists, needs better error handling

### Technical Debt
- [ ] **Remove legacy chat_sessions/chat_messages** — Backward compat tables, can be dropped once all clients use conversations/messages
- [ ] **Add notification tests** — Unit tests for `dispatchNotification()`, email templates, and `/api/notifications` route
- [ ] **Webhook retry logic** — Currently fire-and-forget, should queue failed deliveries
- [ ] **Production error tracking** — Add Sentry or similar for production error monitoring
- [ ] **Redis-backed rate limiting** — Replace in-memory rate limiter with Upstash Redis for multi-instance deployments

### Completed
- [x] **Rate limiting** — In-memory sliding window rate limiter on all public API routes (chat 30/min, widget 20/min, products 30/min, payments 10/min)
- [x] **Input validation** — Message content max 2000 chars, query max 200 chars, pagination limits capped
- [x] **Mandatory webhook signature verification** — `FACEBOOK_APP_SECRET` now required for Messenger webhook
- [x] **DRY AI logic** — Extracted shared intent classification, search, and response generation into `src/lib/chat-ai.ts`
- [x] **Type safety improvements** — Added `typeof` null checks on AI response data in webhook handler
- [x] **Supabase Realtime for notifications** — Replaced 30s polling in NotificationBell with Supabase Realtime subscription (migration: `002_notifications_realtime.sql`)
