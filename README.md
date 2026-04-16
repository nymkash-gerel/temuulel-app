# Temuulel — AI-powered Chatbot SaaS for Mongolian SMBs

> Multi-tenant SaaS that gives any Mongolian business a fully automated AI chatbot, order management system, payment integration, and operations dashboard — all in one product.

Target: Mongolian SMBs across **24+ verticals** (restaurants, salons, clinics, gyms, shops, hotels, car washes, legal, real estate, etc.).

---

## Core capabilities

| Area | What it does |
|------|--------------|
| **AI chatbot** | GPT-4o-mini multi-turn conversations in Mongolian (Cyrillic + Latin). Intent classification, RAG over store catalog, fallback to template responses. |
| **Image recognition** | Customer sends a product photo → GPT-4o Vision identifies → matches against catalog → sends carousel. |
| **Voice transcription** | Customer sends a voice note → Whisper transcribes in Mongolian Cyrillic → normal AI flow. |
| **Self-learning AI** | Quality scoring (0-100) per response, unanswered-question tracking, store-specific knowledge base injected into prompts. |
| **Channels** | Facebook Messenger, Instagram DM, Web widget, Telegram, SMS. |
| **Orders & payments** | Full order flow (product → name → phone → address → payment), QPay integration. |
| **Operations** | Kitchen Display System (KDS), delivery tracking, driver chat, inventory, reservations, appointments. |
| **Business intelligence** | Analytics, churn prediction, A/B tests, broadcast campaigns, customer intelligence. |
| **White-label** | Custom logo, colors, widget title, custom domain, hide "Powered by Temuulel" (Pro). |
| **Security** | 2FA (TOTP), session rotation, rate limiting, Row-Level Security on every table. |
| **Growth** | Referral program (1 free month per friend), Affiliate program (20% lifetime commission). |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI | OpenAI GPT-4o-mini (chat) + GPT-4o (Vision) + Whisper |
| Payments | QPay (Mongolian) + Stripe (subscriptions) |
| Email | Resend |
| Push | Web Push API (VAPID) + service worker |
| SMS | Mongolian SMS gateway |
| Telegram | Telegram Bot API |
| Testing | Vitest (unit) + Playwright (E2E) |
| Error tracking | Sentry |
| Rate limiting | Upstash Redis |
| Deployment | Vercel |

---

## Project scale

- **273** API routes
- **214** dashboard pages
- **53** library modules
- **67** database migrations
- **82** test files, **2,179+** tests passing
- **24** business verticals

---

## Getting started

### Prerequisites

- Node.js 20+
- Supabase CLI (`brew install supabase/tap/supabase`)
- OpenAI API key (for AI features)

### Local setup

```bash
# Install dependencies
npm install

# Start local Supabase
supabase start

# Apply migrations
supabase db reset

# Copy .env.example → .env.local and fill in your keys
cp .env.example .env.local

# Seed test accounts
npx tsx scripts/seed-local.ts

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Test credentials (password: `test1234`)

| Email | Vertical |
|-------|----------|
| `shop@temuulel.test` | ecommerce |
| `restaurant@temuulel.test` | restaurant |
| `beauty@temuulel.test` | beauty salon |
| `hospital@temuulel.test` | hospital |
| `dental@temuulel.test` | dental clinic |
| `coffee@temuulel.test` | coffee shop |
| `fitness@temuulel.test` | gym |
| `education@temuulel.test` | training courses |
| `realestate@temuulel.test` | real estate |
| `camping@temuulel.test` | camping / guesthouse |

---

## Commands

```bash
npm run dev           # Development server
npm test              # Vitest unit tests
npm run test:e2e      # Playwright E2E
npm run build         # Production build (must pass zero errors)
npm run lint          # ESLint check

supabase start        # Start local Supabase
supabase status       # Check status
supabase stop         # Stop
```

### Stress tests

```bash
# 14 test groups covering every flow + real Facebook chat history
bash scripts/run-all-tests.sh

# Individual groups
npx tsx scripts/stress-test-order-flow.ts           # 40 order scenarios
npx tsx scripts/stress-test-comment-ai-reply.ts     # Real FB comments through AI
npx tsx scripts/stress-test-image-recognition.ts    # 7 product images
npx tsx scripts/stress-test-audio-transcription.ts  # Whisper with Mongolian
```

---

## Architecture

```
Customer (Messenger / Web Widget / Telegram / SMS)
        ↓
/api/webhook/messenger  /  /api/chat/widget  /  /api/webhook/telegram
        ↓
src/lib/chat-ai.ts             (intent classification: keyword + BERT-like + GPT)
        ↓
src/lib/ai/contextual-responder.ts   (GPT response + knowledge base injection)
        ↓
src/lib/ai/quality-scorer.ts    (score 0-100, flag unanswered)
        ↓
src/lib/notifications.ts        (email + push + in-app + webhook)
        ↓
Owner Dashboard (/dashboard/*)
```

### Multi-tenancy

Every table has a `store_id` column. Supabase RLS policies enforce per-store isolation. Never bypass RLS — always use the server-side Supabase client for mutations.

---

## Key files

| Purpose | Path |
|---------|------|
| Intent + GPT responder | `src/lib/ai/contextual-responder.ts` |
| OpenAI client (chat + vision + whisper) | `src/lib/ai/openai-client.ts` |
| Image recognizer | `src/lib/ai/image-recognizer.ts` |
| Quality scorer | `src/lib/ai/quality-scorer.ts` |
| Cost tracker | `src/lib/ai/cost-tracker.ts` |
| Notification dispatcher | `src/lib/notifications.ts` |
| QPay client | `src/lib/qpay.ts` |
| Facebook Messenger | `src/lib/messenger.ts` |
| Telegram bot | `src/lib/telegram.ts` |
| Escalation scoring | `src/lib/escalation.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Status machine | `src/lib/status-machine.ts` |
| Feature flags (sidebar) | `src/lib/features.ts` |
| Validation schemas | `src/lib/validations.ts` |
| Dashboard layout/nav | `src/components/dashboard/DashboardLayout.tsx` |
| Cmd+K palette | `src/components/dashboard/CommandPalette.tsx` |
| PWA install prompt | `src/components/ui/PWAInstallPrompt.tsx` |
| Chat widget | `src/components/chat/ChatWidget.tsx` |
| Review widget | `src/components/ui/ReviewWidget.tsx` |

---

## Recent major features (v2.0 → v2.4)

- **v2.4** — Affiliate partner program (20% lifetime), PWA install prompt, video onboarding, review widgets on customer profiles
- **v2.3** — Cmd+K command palette, referral program, QR code generator, help center, changelog, status page
- **v2.2** — 2FA (TOTP), session rotation, A/B tests, churn prediction, Stripe subscriptions, white-label branding, native HTML chat widget
- **v2.1** — Self-learning AI (quality scoring + unanswered questions + knowledge base), broadcast campaigns, operator mode, message packs, OpenAI cost tracking, performance indexes
- **v2.0** — Image recognition (GPT-4o Vision), voice transcription (Whisper), Mongolian-first AI

Full changelog: `/changelog` (in-app page).

---

## Database migrations

Pattern: `supabase/migrations/NNN_description.sql`

| Migration | Description |
|-----------|-------------|
| 001-045 | Core schema (stores, products, orders, conversations, RLS) |
| 046 | Customer intelligence |
| 047-060 | Vertical-specific + fulfillment |
| 061 | AI quality learning (quality_logs, unanswered_questions, knowledge_base) |
| 062 | Broadcast campaigns |
| 063 | Operator mode |
| 064 | Message packs |
| 065 | OpenAI usage logs |
| 066 | Performance indexes |
| 067 | Affiliate program |

Next migration number to use: **068**.

---

## Deployment

Production runs on Vercel with a separate production Supabase project. See `DEPLOYMENT.md` for full setup.

**Required external credentials:**
- Vercel project + env vars
- Production Supabase project
- Facebook App (OAuth live approval)
- QPay merchant credentials
- Resend API key
- Sentry DSN
- Upstash Redis

---

## Contributing

1. Create feature branch from `main`
2. Run `npm test` and `npm run build` before pushing (both must pass)
3. No `as any` in production code — use `as unknown as T` with a comment explaining why
4. All API routes must have rate limiting
5. All mutations must go through server-side Supabase client
6. All UI in Mongolian by default, with English translations via `src/lib/i18n/`

See `CLAUDE.md` for detailed coding conventions.

---

## License

Proprietary — © 2026 Temuulel. All rights reserved.
