# Temuulel Integration Setup Guide

This guide covers the setup of every third-party integration used by the Temuulel ecommerce chatbot platform. Each section lists the required environment variables, step-by-step configuration instructions, and the relevant API endpoints in the codebase.

All environment variables referenced below should be added to your `.env.local` file for local development, or to your Vercel project settings for production. See `.env.example` for the full list.

---

## Table of Contents

1. [Facebook Messenger](#1-facebook-messenger)
2. [Instagram DM](#2-instagram-dm)
3. [Telegram Bot](#3-telegram-bot)
4. [QPay Payment Gateway](#4-qpay-payment-gateway)
5. [Resend Email](#5-resend-email)
6. [Upstash QStash](#6-upstash-qstash)
7. [OpenAI](#7-openai)
8. [Web Push (VAPID)](#8-web-push-vapid)
9. [Sentry Error Monitoring](#9-sentry-error-monitoring)
10. [SMS Gateway](#10-sms-gateway-optional)

---

## 1. Facebook Messenger

Facebook Messenger integration lets your customers chat with the AI-powered bot directly from your Facebook Page. Temuulel receives incoming messages via a webhook, runs them through intent classification and AI response generation, and replies via the Messenger Send API.

### Environment Variables

```bash
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_PAGE_ACCESS_TOKEN=your-page-access-token
MESSENGER_VERIFY_TOKEN=a-random-string-you-choose
```

### Option A: Automated Setup via OAuth (Recommended)

Temuulel provides a built-in OAuth flow that handles token exchange, page selection, and webhook subscription automatically.

1. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in your environment variables.
2. Deploy the application (or run locally with a tunnel like `ngrok`).
3. Go to **Dashboard > Settings > Integrations** in the Temuulel UI.
4. Click the **"Холбох"** (Connect) button next to Facebook Messenger.
5. You will be redirected to Facebook to authorize the app.
6. Grant the requested permissions (`pages_show_list`, `pages_messaging`, `pages_read_engagement`, `pages_manage_metadata`, `business_management`).
7. If you manage multiple Pages, you will be shown a page picker. Select the Page you want to connect.
8. The OAuth callback at `/api/auth/facebook/callback` will automatically:
   - Exchange the authorization code for a long-lived Page Access Token
   - Subscribe the Page to messaging webhook events (`messages`, `messaging_postbacks`, `messaging_optins`, `feed`)
   - Store the Page ID and token in your store record

### Option B: Manual Setup

If you prefer to configure everything manually (or for debugging):

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a new app (type: Business).
2. In the app dashboard, click **Add Product** and add **Messenger**.
3. Create a Facebook Page (or use an existing one that you administer).
4. Under **Messenger > Settings > Access Tokens**, select your Page and click **Generate Token**. Copy the token.
5. Set the environment variables:
   ```bash
   FACEBOOK_APP_ID=<your app id>
   FACEBOOK_APP_SECRET=<your app secret>
   FACEBOOK_PAGE_ACCESS_TOKEN=<the generated page token>
   MESSENGER_VERIFY_TOKEN=<any random string, e.g. "temuulel-verify-2024">
   ```
6. Under **Messenger > Settings > Webhooks**, click **Add Callback URL** and configure:
   - **Callback URL:**
     ```
     https://your-domain.vercel.app/api/webhook/messenger
     ```
   - **Verify Token:** The same value you set for `MESSENGER_VERIFY_TOKEN`.
7. Subscribe to the following webhook fields:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`
   - `feed` (for comment auto-reply)
8. Select your Page under **Webhooks > Page Subscriptions** and click **Subscribe**.

### How It Works

- **Webhook verification** (GET `/api/webhook/messenger`): Facebook sends a `hub.verify_token` challenge. The handler compares it against `MESSENGER_VERIFY_TOKEN` and returns `hub.challenge`.
- **Incoming messages** (POST `/api/webhook/messenger`): The handler verifies the `X-Hub-Signature-256` header using `FACEBOOK_APP_SECRET`, then processes each messaging event -- creating customers, conversations, and messages in the database, running AI auto-reply if enabled, and dispatching notifications.
- Per-store tokens are supported: each store can have its own `facebook_page_access_token` in the database, with `FACEBOOK_PAGE_ACCESS_TOKEN` as a global fallback.

### Relevant Files

- `src/app/api/webhook/messenger/route.ts` -- Webhook handler
- `src/app/api/auth/facebook/route.ts` -- OAuth initiation
- `src/app/api/auth/facebook/callback/route.ts` -- OAuth callback and token exchange
- `src/app/api/auth/facebook/select-page/route.ts` -- Multi-page picker
- `src/lib/messenger.ts` -- Messenger Send API client

---

## 2. Instagram DM

Instagram DM integration uses the same Facebook App and webhook endpoint as Messenger. Messages from Instagram are delivered to `/api/webhook/messenger` with `object: "instagram"` instead of `object: "page"`.

### Environment Variables

```bash
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
INSTAGRAM_APP_ID=your-instagram-app-id
```

### Prerequisites

- A Facebook App with the **Instagram Messaging API** product added.
- An Instagram **Business** or **Creator** account linked to a Facebook Page.
- The `instagram_manage_messages` and `instagram_basic` permissions approved for your app.

### Setup Steps

1. Ensure you have already configured the Facebook App (see [Facebook Messenger](#1-facebook-messenger) above).
2. In the Facebook App dashboard, add the **Instagram** product and request the `instagram_manage_messages` permission through App Review.
3. Link your Instagram Business/Creator account to your Facebook Page:
   - On Instagram, go to **Settings > Account > Linked Accounts > Facebook**.
   - On your Facebook Page, go to **Settings > Instagram** and connect the account.
4. Set the `INSTAGRAM_APP_ID` environment variable.
5. In the Temuulel dashboard, go to **Settings > Integrations** and click **"Холбох"** next to Instagram DM.
6. The OAuth flow (`/api/auth/facebook?channel=instagram`) will:
   - Request the additional `instagram_manage_messages` and `instagram_basic` scopes.
   - After authorization, find Pages with a linked `instagram_business_account`.
   - Subscribe the Page to webhook events (Instagram DMs are routed through the Page subscription).
   - Store the `instagram_business_account_id` in your store record.

### How It Works

- Instagram DMs arrive at the same webhook endpoint as Messenger (`/api/webhook/messenger`).
- The handler checks `body.object` -- if it equals `"instagram"`, it looks up the store by `instagram_business_account_id` instead of `facebook_page_id`.
- Customers are stored with an `instagram_id` field and `channel: "instagram"`.
- Replies are sent using the Page Access Token (shared with Messenger) via the Send API.

### Relevant Files

- `src/app/api/webhook/messenger/route.ts` -- Shared webhook handler (lines 63-68 handle Instagram detection)
- `src/app/api/auth/facebook/callback/route.ts` -- `handleInstagramFlow()` function
- `src/app/dashboard/settings/integrations/page.tsx` -- UI for connecting Instagram

---

## 3. Telegram Bot

The Telegram bot is used for **staff notifications**, not customer-facing chat. Staff members receive appointment alerts with inline Confirm/Reject buttons, and can link their Telegram account to their staff profile.

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz
TELEGRAM_BOT_USERNAME=your_bot_username
```

### Setup Steps

1. Open Telegram and start a conversation with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to create a new bot. You will receive a **bot token** (e.g., `123456789:ABCdefGhIjKlMnOpQrStUvWxYz`).
3. Set the environment variables:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz
   TELEGRAM_BOT_USERNAME=your_bot_username
   ```
4. Register the webhook with Telegram by running:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-domain.vercel.app/api/webhook/telegram"}'
   ```
5. Verify the webhook was set:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Staff Account Linking

Staff members link their Telegram accounts by clicking a deep link generated by the system:

```
https://t.me/your_bot_username?start=STAFF_UUID
```

When the staff member clicks this link and sends `/start STAFF_UUID` to the bot, the webhook handler at `/api/webhook/telegram` automatically saves the `telegram_chat_id` to the staff record in the database.

The deep link is generated in code by `getTelegramBotLink(staffId)` in `src/lib/telegram.ts`.

### Inline Button Actions

When an appointment is created, the bot sends a notification with inline buttons:
- **Confirm** (`confirm_appointment:UUID`) -- sets appointment status to `confirmed`
- **Reject** (`reject_appointment:UUID`) -- sets appointment status to `cancelled`

The bot edits the original message to show the result after the staff member taps a button.

### Relevant Files

- `src/app/api/webhook/telegram/route.ts` -- Webhook handler (start command + callback queries)
- `src/lib/telegram.ts` -- Telegram Bot API client (sendMessage, inline keyboards, deep links)
- `src/lib/staff-notify.ts` -- Staff notification dispatcher

---

## 4. QPay Payment Gateway

QPay is the primary payment gateway for Mongolian bank app QR code payments. Temuulel creates QPay invoices for orders and verifies payment via callbacks.

### Environment Variables

```bash
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=your-qpay-merchant-username
QPAY_PASSWORD=your-qpay-merchant-password
QPAY_INVOICE_CODE=your-invoice-code
```

### Setup Steps

1. Register as a QPay merchant at [merchant.qpay.mn](https://merchant.qpay.mn).
2. After approval, log in to the QPay Merchant Portal.
3. Navigate to your merchant settings and note down:
   - **Username** (merchant username)
   - **Password** (merchant password)
   - **Invoice Code** (the code assigned to your merchant account)
4. Set the environment variables:
   ```bash
   QPAY_BASE_URL=https://merchant.qpay.mn/v2
   QPAY_USERNAME=<your merchant username>
   QPAY_PASSWORD=<your merchant password>
   QPAY_INVOICE_CODE=<your invoice code>
   ```
5. In the QPay Merchant Portal, set the **payment callback URL** to:
   ```
   https://your-domain.vercel.app/api/payments/callback
   ```

### Payment Flow

1. Customer places an order and selects QPay as the payment method.
2. `POST /api/payments/create` calls `createQPayInvoice()`, which:
   - Authenticates with QPay using Basic Auth (`QPAY_USERNAME:QPAY_PASSWORD`).
   - Creates an invoice with the order amount and callback URL.
   - Returns a QR code image (base64), QR text, short URL, and deep links to Mongolian bank apps (Khan Bank, Golomt, TDB, State Bank, etc.).
3. The customer scans the QR code or taps a bank app deep link to pay.
4. After payment, QPay calls `GET /api/payments/callback?order_id=xxx`.
5. The callback handler verifies the payment via `checkQPayPayment()`, updates the order to `paid`/`confirmed`, decrements stock, and dispatches a `new_order` notification.

### How Authentication Works

QPay uses a token-based authentication flow. The `qpay.ts` module caches the access token in memory and refreshes it automatically when it expires (with a 60-second buffer).

### Relevant Files

- `src/lib/qpay.ts` -- QPay API client (auth, invoice creation, payment verification)
- `src/app/api/payments/create/route.ts` -- Invoice creation endpoint
- `src/app/api/payments/callback/route.ts` -- Payment callback verification
- `src/app/api/payments/check/route.ts` -- Manual payment status check

---

## 5. Resend Email

Resend is used for sending transactional emails: order confirmations, new message alerts, low stock warnings, daily reports, and team invitations.

### Environment Variables

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com
```

### Setup Steps

1. Sign up at [resend.com](https://resend.com).
2. Go to **API Keys** and create a new API key. Copy it.
3. Set the environment variable:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. **Verify your sending domain** under **Domains** in the Resend dashboard:
   - Add your domain (e.g., `yourdomain.com`).
   - Add the DNS records (SPF, DKIM, DMARC) that Resend provides.
   - Wait for verification to complete.
   - For testing, you can use Resend's onboarding domain (`onboarding@resend.dev`).
5. Set the from address:
   ```bash
   NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com
   ```

### Email Types Sent

| Email Type | Trigger | Function |
|---|---|---|
| New order alert | QPay payment confirmed, or new order via chat | `sendOrderEmail()` |
| New message alert | Customer sends a message | `sendMessageEmail()` |
| Low stock warning | Product stock falls below threshold after an order | `sendLowStockEmail()` |
| Daily report | Cron job (scheduled task) | `sendDailyReportEmail()` |
| Team invitation | Store owner invites a team member | `sendTeamInviteEmail()` |

### Graceful Degradation

If `RESEND_API_KEY` is not set, `getResend()` returns `null` and all email functions log a warning and return `false` without throwing errors. The rest of the notification pipeline (in-app notifications, push, webhooks) continues to work.

### Relevant Files

- `src/lib/email.ts` -- Resend email client and all email templates
- `src/lib/notifications.ts` -- Central notification dispatcher (calls email functions)

---

## 6. Upstash QStash

QStash is used for reliable asynchronous webhook delivery with automatic retries. When a store has an external webhook URL configured, events are published to QStash, which delivers them to `/api/webhook/deliver` with signature verification.

### Environment Variables

```bash
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
QSTASH_NEXT_SIGNING_KEY=sig_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Setup Steps

1. Sign up at [upstash.com](https://upstash.com).
2. Navigate to the **QStash** section in the Upstash console.
3. Copy the following values from the QStash dashboard:
   - **QSTASH_TOKEN** -- Used to publish messages to QStash.
   - **QSTASH_CURRENT_SIGNING_KEY** -- Used to verify incoming QStash deliveries.
   - **QSTASH_NEXT_SIGNING_KEY** -- Used during key rotation (QStash rotates keys periodically).
4. Set the environment variables:
   ```bash
   QSTASH_TOKEN=<your token>
   QSTASH_CURRENT_SIGNING_KEY=<current signing key>
   QSTASH_NEXT_SIGNING_KEY=<next signing key>
   ```

### Delivery Flow

```
Event occurs (e.g., new_order)
  -> dispatchWebhook() in src/lib/webhook.ts
    -> QStash.publishJSON({ url: "/api/webhook/deliver", body: { store_id, payload } })
      -> QStash delivers to POST /api/webhook/deliver
        -> Verifies QStash signature (Upstash-Signature header)
        -> Looks up the store's webhook_url and webhook_secret
        -> Signs the payload with HMAC-SHA256 using the store's webhook_secret
        -> POST to the store's external webhook URL
```

### Retry Policy

QStash automatically retries failed deliveries up to 3 times with exponential backoff. If `/api/webhook/deliver` returns a non-2xx status code, QStash will retry.

### Graceful Degradation

If `QSTASH_TOKEN` is not set, `dispatchWebhook()` falls back to **direct delivery** -- a fire-and-forget HTTP POST to the store's webhook URL with no retry guarantees.

### Relevant Files

- `src/lib/webhook.ts` -- Webhook dispatch logic (QStash publish + direct fallback)
- `src/app/api/webhook/deliver/route.ts` -- QStash callback target (verifies signature, delivers to store)

---

## 7. OpenAI

OpenAI powers the AI features of Temuulel: chatbot responses, product enrichment, message sentiment tagging, complaint classification, delivery route optimization, and analytics insights.

### Environment Variables

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Setup Steps

1. Go to [platform.openai.com](https://platform.openai.com) and sign in (or create an account).
2. Navigate to **API Keys** and create a new secret key.
3. Set the environment variable:
   ```bash
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Graceful Degradation (Optional Integration)

OpenAI is **optional**. If `OPENAI_API_KEY` is not set:

- `isOpenAIConfigured()` returns `false`.
- The chatbot falls back to **deterministic template responses** based on keyword-based intent classification. These templates are defined in `src/lib/chat-ai.ts` and cover greetings, product search, order status, payment info, shipping info, size guides, complaints, and returns.
- Product enrichment, sentiment tagging, complaint classification, and analytics insights are silently skipped.

### AI Features and Their Modules

| Feature | Module | Model Used | Description |
|---|---|---|---|
| Contextual chatbot | `src/lib/ai/contextual-responder.ts` | gpt-4o-mini | Multi-turn conversational responses with history |
| Product recommendations | `src/lib/ai/recommendation-writer.ts` | gpt-4o-mini | Single-turn product recommendation text |
| Message sentiment tagging | `src/lib/ai/message-tagger.ts` | gpt-4o-mini | Tags messages with sentiment and topic labels |
| Product enrichment | `src/lib/ai/product-enricher.ts` | gpt-4o-mini | Generates descriptions, SEO tags, and FAQs |
| Complaint classification | `src/lib/ai/complaint-classifier.ts` | gpt-4o-mini | Categorizes complaints and suggests compensation |
| Complaint summarization | `src/lib/ai/complaint-summarizer.ts` | gpt-4o-mini | Summarizes complaint conversation threads |
| Analytics insights | `src/lib/ai/analytics-insight.ts` | gpt-4o-mini | Generates natural-language business insights |
| Delivery route optimization | `src/lib/ai/route-optimizer.ts` | gpt-4o-mini | Optimizes delivery batch assignments |
| Delivery driver assignment | `src/lib/ai/delivery-assigner.ts` | gpt-4o-mini | AI-powered driver selection for deliveries |

### AI Response Fallback Chain

The chatbot uses a three-tier fallback chain (defined in `generateAIResponse()` in `src/lib/chat-ai.ts`):

1. **Tier 1: Contextual AI** -- Full multi-turn conversation with message history (requires OpenAI).
2. **Tier 2: Recommendation Writer** -- Single-turn AI product recommendation (requires OpenAI, product_search intent only).
3. **Tier 3: Deterministic Template** -- Zero-cost keyword-based templates (always works, no API needed).

### Relevant Files

- `src/lib/ai/openai-client.ts` -- Shared OpenAI client (JSON completion + chat completion)
- `src/lib/chat-ai.ts` -- Intent classification, template responses, and AI response orchestration

---

## 8. Web Push (VAPID)

Web Push notifications are sent to store owners and delivery drivers via the browser's Push API. VAPID (Voluntary Application Server Identification) keys are required to authenticate push requests.

### Environment Variables

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:support@yourdomain.com
```

### Setup Steps

1. Generate VAPID keys using the `web-push` CLI tool:
   ```bash
   npx web-push generate-vapid-keys
   ```
   This outputs a public key and a private key.
2. Set the environment variables:
   ```bash
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key>
   VAPID_PRIVATE_KEY=<the private key>
   VAPID_SUBJECT=mailto:support@yourdomain.com
   ```
   Note: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has the `NEXT_PUBLIC_` prefix because it is used on the client side for push subscription registration. `VAPID_SUBJECT` should be a `mailto:` URI with a valid email address.

### How It Works

1. When a user (store owner or driver) enables push notifications in the browser, the client subscribes to push using `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and stores the subscription (endpoint, p256dh, auth) in the `push_subscriptions` table.
2. When an event triggers a notification (new order, new message, delivery update, etc.), `sendPushToUser()` in `src/lib/push.ts` fetches all subscriptions for the user and sends the notification via the `web-push` library.
3. Expired subscriptions (HTTP 410 responses) are automatically cleaned up from the database.

### Push Notification Events

Push notifications are sent for the following events (when the user has enabled the corresponding `push_<event>` setting):

- `new_order` -- New order received
- `new_message` -- New customer message
- `new_customer` -- New customer registered
- `low_stock` -- Product stock running low
- `order_status` -- Order status changed
- `escalation` -- Chat escalated to human
- `appointment_*` -- Appointment created/confirmed/cancelled/assigned
- `delivery_*` -- Delivery assigned/picked up/completed/failed/delayed

### Graceful Degradation

If VAPID keys are not configured, `sendPushToUser()` returns immediately without error. The rest of the notification pipeline continues to work.

### Relevant Files

- `src/lib/push.ts` -- Server-side push notification sender
- `src/lib/notifications.ts` -- Central dispatcher (calls `sendPushToUser`)

---

## 9. Sentry Error Monitoring

Sentry provides error tracking, performance monitoring, and session replay for the Temuulel application.

### Environment Variables

```bash
# Client-side (browser) -- used by sentry.client.config.ts
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX

# Server-side -- used by sentry.server.config.ts and sentry.edge.config.ts
SENTRY_DSN=https://xxxxxxxxxxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX

# Source map upload (build time only)
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=your-sentry-project-slug
```

### Setup Steps

1. Sign up at [sentry.io](https://sentry.io) and create a new project (platform: Next.js).
2. Copy the **DSN** from the project settings.
3. Under **Settings > Auth Tokens**, create a new auth token with `project:releases` and `org:read` scopes.
4. Set the environment variables:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=<your DSN>
   SENTRY_DSN=<your DSN>
   SENTRY_AUTH_TOKEN=<your auth token>
   SENTRY_ORG=<your org slug>
   SENTRY_PROJECT=<your project slug>
   ```

### Configuration Details

Sentry is integrated via `@sentry/nextjs` with three configuration files:

| File | Scope | Description |
|---|---|---|
| `sentry.client.config.ts` | Browser | 10% transaction sampling in production, 1% session replay, 100% replay on error |
| `sentry.server.config.ts` | Node.js server | Server-side error and performance tracking |
| `sentry.edge.config.ts` | Edge runtime | Edge function error tracking |

The `next.config.ts` wraps the Next.js config with `withSentryConfig()` which:
- Uploads source maps during build (when `SENTRY_AUTH_TOKEN` is set).
- Hides source maps from clients.
- Silently disables the Sentry webpack plugin when the auth token is missing.

### Filtered Errors

The following noisy errors are ignored in the client configuration:
- `ResizeObserver loop`
- `AbortError`
- `Network request failed`
- `Load failed`

### Graceful Degradation (Optional Integration)

Sentry is **optional**. If `NEXT_PUBLIC_SENTRY_DSN` is not set:
- `Sentry.init()` runs with `enabled: false`, so no data is sent.
- The Sentry webpack plugins are disabled, so builds succeed without a Sentry auth token.
- Errors are logged to the console as usual.

### Relevant Files

- `sentry.client.config.ts` -- Browser-side Sentry initialization
- `sentry.server.config.ts` -- Server-side Sentry initialization
- `sentry.edge.config.ts` -- Edge runtime Sentry initialization
- `next.config.ts` -- `withSentryConfig()` wrapper

---

## 10. SMS Gateway (Optional)

A generic SMS gateway integration for sending SMS notifications when other channels (push, email, Telegram) are unavailable.

### Environment Variables

```bash
SMS_API_URL=https://your-sms-provider.com/api/send
SMS_API_KEY=your-sms-api-key
```

### Setup Steps

1. Choose an SMS gateway provider (e.g., a Mongolian SMS provider).
2. Obtain an API URL and API key from the provider.
3. Set the environment variables:
   ```bash
   SMS_API_URL=https://your-sms-provider.com/api/send
   SMS_API_KEY=your-sms-api-key
   ```

### Graceful Degradation

This integration is **optional**. If the SMS environment variables are not set, SMS notifications are silently skipped and other notification channels (email, push, Telegram, in-app) continue to function.

---

## Environment Variable Summary

Below is the complete list of integration-related environment variables. Copy this block into your `.env.local` and fill in the values for the integrations you need.

```bash
# ── Facebook / Instagram ─────────────────────────────────────────────────
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_PAGE_ACCESS_TOKEN=
MESSENGER_VERIFY_TOKEN=
INSTAGRAM_APP_ID=

# ── Telegram Bot ─────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=

# ── QPay Payment Gateway ─────────────────────────────────────────────────
QPAY_BASE_URL=https://merchant.qpay.mn/v2
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_INVOICE_CODE=

# ── Email Notifications (Resend) ─────────────────────────────────────────
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=noreply@yourdomain.com

# ── Upstash QStash ───────────────────────────────────────────────────────
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# ── OpenAI (optional) ───────────────────────────────────────────────────
OPENAI_API_KEY=

# ── Web Push (VAPID) ────────────────────────────────────────────────────
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@yourdomain.com

# ── Sentry (optional) ───────────────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# ── SMS Gateway (optional) ──────────────────────────────────────────────
SMS_API_URL=
SMS_API_KEY=
```

---

## Webhook Endpoints Reference

| Endpoint | Method | Source | Purpose |
|---|---|---|---|
| `/api/webhook/messenger` | GET | Facebook | Webhook verification (challenge/response) |
| `/api/webhook/messenger` | POST | Facebook | Incoming Messenger and Instagram DM messages |
| `/api/webhook/telegram` | POST | Telegram | Bot commands and inline button callbacks |
| `/api/webhook/deliver` | POST | Upstash QStash | Internal -- delivers queued webhooks to store URLs |
| `/api/payments/callback` | GET | QPay | Payment confirmation callback |
| `/api/auth/facebook` | GET | Browser | Initiates Facebook OAuth flow |
| `/api/auth/facebook/callback` | GET | Facebook | OAuth callback -- token exchange and page setup |

---

## Troubleshooting

### Facebook Messenger / Instagram
- **"no_pages" error**: Your Facebook account does not have Admin access to any Pages. Check that you are an Admin on the Page you want to connect.
- **"no_instagram" error**: None of your Facebook Pages have a linked Instagram Business Account. Connect your Instagram account to a Facebook Page first.
- **Webhook not receiving messages**: Verify that the webhook is subscribed to the correct Page and that the `MESSENGER_VERIFY_TOKEN` matches what you entered in the Facebook App dashboard.
- **Signature verification failing**: Ensure `FACEBOOK_APP_SECRET` is correct. The handler checks `X-Hub-Signature-256` on every POST request.

### QPay
- **"QPay auth failed"**: Double-check `QPAY_USERNAME` and `QPAY_PASSWORD`. These are case-sensitive.
- **"QPay not configured"**: Ensure all three of `QPAY_USERNAME`, `QPAY_PASSWORD`, and `QPAY_INVOICE_CODE` are set.
- **Callback not received**: Verify that the callback URL is publicly accessible and returns a 200 status.

### Telegram
- **Bot not responding to /start**: Verify the webhook is correctly set by calling `getWebhookInfo`. Ensure the URL is HTTPS and the SSL certificate is valid.
- **Staff not receiving notifications**: The staff member must send `/start STAFF_ID` to the bot. Check that `telegram_chat_id` is saved in the staff record.

### Sentry
- **Source maps not uploading**: Ensure `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are all set. The auth token needs `project:releases` scope.
- **No errors appearing in Sentry**: Verify `NEXT_PUBLIC_SENTRY_DSN` is set and correct. Check that your Content Security Policy allows connections to `*.ingest.sentry.io`.
