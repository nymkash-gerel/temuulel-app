# Temuulel — Claude Code Introduction

## What is Temuulel?

**Temuulel** is a Mongolian-first multi-tenant SaaS platform that gives any business a fully automated AI chatbot, order management system, payment integration, and operations dashboard — all in one product.

Store owners connect Facebook Messenger (and other channels), configure an AI agent, accept QPay payments, and manage orders from a single dashboard. The AI handles customer conversations automatically, escalates to human agents when needed, and sends real-time notifications across multiple channels.

**Target market:** Mongolian SMBs — restaurants, salons, clinics, gyms, shops, hotels, and 20+ other business types.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| ORM/queries | Supabase JS client with RLS |
| AI | OpenAI GPT (via `src/lib/ai/openai-client.ts`) |
| Payments | QPay (Mongolian payment gateway) |
| Email | Resend API |
| Push | Web Push API (VAPID) + service worker |
| SMS | Mongolian SMS gateway (`src/lib/sms.ts`) |
| Telegram | Telegram Bot API (`src/lib/telegram.ts`) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Error tracking | Sentry (`@sentry/nextjs`) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Deployment | Vercel |

---

## Project Scale (as of 2026-02-19)

- **API Routes:** 273 `route.ts` files
- **Dashboard Pages:** 214 `page.tsx` files (78 detail `[id]` pages)
- **Library Modules:** 53 files in `src/lib/`
- **Database Migrations:** 45 SQL files (`supabase/migrations/`)
- **Test Files:** 82 files, ~2,179+ tests passing
- **Business Verticals:** 24 supported types
- **Build status:** Passing with zero errors

---

## Architecture

```
Customer (Messenger / Web Widget)
        ↓
/api/webhook/messenger  OR  /api/chat/widget
        ↓
src/lib/chat-ai.ts  (intent classification)
        ↓
src/lib/ai/contextual-responder.ts  (GPT response)
        ↓
src/lib/notifications.ts  (email + push + in-app + webhook)
        ↓
Owner Dashboard (/dashboard/*)
```

### Multi-tenancy
Every table has a `store_id` column. Supabase RLS policies enforce that each store owner can only read/write their own data. Never bypass RLS — always use the server-side Supabase client for mutations.

---

## Key Files

| Purpose | Path |
|---------|------|
| AI chat engine | `src/lib/chat-ai.ts` |
| Intent + GPT responder | `src/lib/ai/contextual-responder.ts` |
| Notification dispatcher | `src/lib/notifications.ts` |
| Push notifications | `src/lib/push.ts` |
| Email (Resend) | `src/lib/email.ts` |
| Outgoing webhooks | `src/lib/webhook.ts` |
| QPay client | `src/lib/qpay.ts` |
| Facebook Messenger | `src/lib/messenger.ts` |
| Telegram bot | `src/lib/telegram.ts` |
| Staff notifications | `src/lib/staff-notify.ts` |
| Escalation scoring | `src/lib/escalation.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Status machine | `src/lib/status-machine.ts` |
| Booking conflict | `src/lib/booking-conflict.ts` |
| Billing utilities | `src/lib/billing.ts` |
| Feature flags (sidebar) | `src/lib/features.ts` |
| Database types | `src/lib/database.types.ts` |
| Validation schemas | `src/lib/validations.ts` |
| i18n (MN/EN) | `src/lib/i18n/` |
| Dashboard layout/nav | `src/components/dashboard/DashboardLayout.tsx` |
| Notification bell | `src/components/ui/NotificationBell.tsx` |
| Chat widget | `src/components/chat/ChatWidget.tsx` |
| Supabase (server) | `src/lib/supabase/server.ts` |
| Supabase (client) | `src/lib/supabase/client.ts` |
| Service worker | `public/sw.js` |
| Widget script | `public/widget.js` |

---

## Database

**Local Supabase:**
- Start: `supabase start`
- Studio: http://127.0.0.1:54323
- API: http://127.0.0.1:54321
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

**Migrations:** `supabase/migrations/001_initial_schema.sql` through `045_*.sql`

**Next migration number to use:** `046_*.sql`

**Pattern for new migrations:**
1. Create `supabase/migrations/046_description.sql`
2. Add types to `src/lib/database.types.ts`
3. Add Zod schemas to `src/lib/validations.ts`
4. Create API routes: `src/app/api/{resource}/route.ts` + `[id]/route.ts`
5. Create dashboard pages: `src/app/dashboard/{resource}/page.tsx`
6. Add feature flag in `src/lib/features.ts` if it needs a nav item

---

## Test Credentials (password: `test1234`)

| Email | Store | Business Type |
|-------|-------|--------------|
| restaurant@temuulel.test | Номин Ресторан | restaurant |
| hospital@temuulel.test | Эрүүл Амьдрал Эмнэлэг | hospital |
| beauty@temuulel.test | Bella Beauty Salon | beauty_salon |
| coffee@temuulel.test | Кофе Хаус | coffee_shop |
| fitness@temuulel.test | FitZone Gym | fitness |
| education@temuulel.test | Ухаанай Сургалт | education |
| dental@temuulel.test | Инээмсэглэл Шүдний | dental_clinic |
| realestate@temuulel.test | Green Home Realty | real_estate |
| camping@temuulel.test | Хустай Кемпинг | camping_guesthouse |
| shop@temuulel.test | Монгол Маркет | ecommerce |

---

## Common Commands

```bash
npm run dev          # Start development server
npm test             # Run all Vitest unit tests
npm run test:e2e     # Run Playwright E2E tests
npm run build        # Production build (must pass zero errors)
npm run lint         # ESLint check
supabase start       # Start local Supabase
supabase status      # Check local Supabase status
supabase stop        # Stop local Supabase
```

---

## Coding Conventions

- **Language:** TypeScript strict mode — no `any` in production code
- **Auth:** Always use `supabase.auth.getUser()` on the server, never trust client-passed user IDs
- **RLS:** Never disable RLS. Use server-side client for all mutations
- **Rate limiting:** All public/auth endpoints must have rate limiting via `src/lib/rate-limit.ts` or Upstash
- **Notifications:** Use `dispatchNotification()` from `src/lib/notifications.ts` — never call email/push/webhook directly from API routes
- **Status transitions:** Use `validateTransition()` from `src/lib/status-machine.ts` for any entity with a status workflow
- **Mongolian text:** UI labels, error messages, and email content should be in Mongolian unless the user is in EN mode
- **Tests:** Run `npm test` and `npm run build` after every non-trivial change. Both must pass before stopping work
- **No `as any`:** Use `as unknown as T` with a comment explaining why, only when unavoidable (JSONB narrowing, mock clients)

---

## Business Verticals Supported

Ecommerce, Restaurant, QSR, Hotel/Stay, Education, Medical/Hospital, Beauty Salon, Coffee Shop, Fitness/Gym, Dental Clinic, Real Estate, Camping/Guesthouse, Laundry, Pet Services, Car Wash, Wellness, Photography, Venue/Events, Coworking, Legal, Construction, Subscription Box, Sports, Professional Services, Repair, Home Services, Logistics/Fleet.

Vertical-specific logic is controlled by `store.business_type` + feature flags in `src/lib/features.ts`.

---

## Spec Files

Detailed business logic specs live in `specs/verticals/`:
- `specs/MASTER-IMPLEMENTATION-GUIDE.md` — full system overview
- `specs/verticals/01-QSR.md` through `specs/verticals/22-LOGISTICS.md` — per-vertical specs
- `specs/core/00-CORE-FOUNDATION.md` — core data model
- `specs/shared/BOOKING-CORE.md` — shared booking patterns

Progress tracker: `TODOLIST.md`

---

## What Needs Production Setup (External Credentials Required)

- Vercel production deployment (env vars + domain)
- Production Supabase project (apply migrations 025-045)
- Facebook/Instagram OAuth live app approval
- Telegram bot live testing
- Database backup verification
- Stripe billing webhook (currently using manual QPay only)
