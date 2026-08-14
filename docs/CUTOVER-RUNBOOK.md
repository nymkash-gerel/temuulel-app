# Production cutover runbook

Step-by-step, gated. Every phase ends in a check that must pass before the next
one starts. If a gate fails, stop and use the rollback for that phase — do not
continue and fix forward.

`docs/DEPLOYMENT.md` explains *how* each system works; this file is the ordered
sequence for the day itself. `docs/LAUNCH_SETUP.md` lists the account signups.

**Prerequisite:** `main` is green — `npm test`, `npm run build`, and CI all pass.

---

## Phase 1 — Point at the right project

There is already a production project with a **tracked migration history**:

| ref | name | status | region |
|---|---|---|---|
| `nplzzjqainveqcuohsjo` | **temuulel-prod** | ACTIVE_HEALTHY | ap-southeast-1 (Singapore) |
| `yglemwhbvhupoqniyxog` | nymkash@gmail.com's Project | INACTIVE (paused) | ap-south-1 |

`temuulel-prod` reports **001–071 applied, 072–080 pending**, and Vercel prod
already points at it. So there is nothing to create and no secret to rotate —
`supabase db push` will apply exactly the 9 outstanding migrations.

> **The old project is not a fallback.** It has a schema but no
> `supabase_migrations.schema_migrations` history, so a push there restarts at
> `001` and fails immediately (measured: 46 of 79). It is also paused, which is
> why its hostname returns NXDOMAIN rather than an error page.

1. **Check `SUPABASE_PROJECT_REF`.** It was last set 2026-02-02, *before*
   temuulel-prod existed (2026-03-28), so it almost certainly still points at
   the old project. Set it to `nplzzjqainveqcuohsjo` before running anything.
   GitHub does not let you read a secret back — overwrite it rather than
   guessing.
2. **Turn on PITR** on temuulel-prod. It only protects from the moment it is
   enabled, and this is the last point where a restore is still cheap.
3. Confirm `SUPABASE_ACCESS_TOKEN` is still valid (also set 2026-02-03).

**Gate:** `SUPABASE_PROJECT_REF` = `nplzzjqainveqcuohsjo`, PITR on.

---

## Phase 2 — Migrations

Run **Actions → Deploy Migrations** → target `production` → confirm `migrate`.

The workflow runs a dry-run and then **pauses** on the `production-migrations`
environment. Open the dry-run job log and confirm it lists exactly these nine
before approving:

```
072_fix_pending_invites_rls          076_restrict_driver_ratings_insert
073_atomic_stock_decrement           077_reviews_table
074_customer_order_stats             078_backfill_untracked_tables
075_churn_order_aggregates           079_stripe_store_subscriptions
                                     080_referrals_user_sessions_write_policies
```

If it lists more than nine — especially if it starts at `001` — **stop**: the
ref is still pointing at the old project.

Only `077` and `078` create tables (1 + 5). Verified against the live project
over PostgREST: 161 of the 167 migration-defined tables already exist, and the
6 missing are exactly what those two create.

```sql
-- after the push
select count(*) from supabase_migrations.schema_migrations;            -- 80
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r';                          -- 167
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;  -- 0
```

**The storage-policy risk does not apply to this push.** Migrations `001` and
`023` — the only ones that touch `storage.*` — are already applied, and none of
072–080 go near it. That was the one thing a local rehearsal could not prove,
and it is now out of the path.

**Gate:** 80 rows in `schema_migrations`, 167 tables, 0 without RLS.

**Rollback:** PITR restore to just before the push. Deleting and recreating the
project is *not* an option here — unlike a fresh project, this one may already
hold data.

---

## Phase 3 — Vercel environment

Most of this is already done — Vercel prod points at `temuulel-prod` and the
Supabase trio is set. What follows is the checklist to confirm, not a blank
slate. The app validates on boot (`instrumentation.ts` → `checkEnvOnBoot`) and
**exits fatally in production** if any of these five are missing:

| Variable | Missing means |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | clients silently fall back to a placeholder host |
| `NEXT_PUBLIC_SUPABASE_KEY` | no browser or server Supabase client works |
| `SUPABASE_SECRET_KEY` | every RLS-bypassing server route fails |
| `NEXT_PUBLIC_APP_URL` | callback/redirect/webhook URLs are built wrong |
| `CRON_SECRET` | all four cron routes refuse to run |

These are optional, but each silently disables a feature — decide deliberately:

| Variable | Missing means |
|---|---|
| `OPENAI_API_KEY` | AI replies fall back to deterministic templates |
| `RESEND_API_KEY` | no email is sent at all |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | rate limiting is per-instance in memory |
| `SENTRY_DSN` | server errors are not reported anywhere |

> `NEXT_PUBLIC_*` values are inlined into the bundle at **build** time. After
> adding one you must **redeploy** — restarting the deployment does not pick it up.

Known outstanding as of the last audit (`docs/LAUNCH_SETUP.md`, 2026-04-23):
`RESEND_API_KEY` is set but **invalid** (Resend returns `400 "API key is
invalid"`), and `UPSTASH_REDIS_REST_URL` / `_TOKEN` and the QPay pair are not
set at all. `CRON_SECRET` and `NEXT_PUBLIC_APP_URL` do not appear in that
audit's verified list either — both are required, so check them explicitly.

**Gate:** deployment succeeds and the runtime log contains no `[env] FATAL`.

**Rollback:** promote the previous Vercel deployment. The database is untouched.

---

## Phase 4 — Domain, then webhooks

Order matters: every webhook URL is derived from `NEXT_PUBLIC_APP_URL`, so
finalise the domain first or you will register URLs twice.

1. Attach the domain, confirm SSL, set `NEXT_PUBLIC_APP_URL` to the final
   origin, redeploy.
2. Register the external callbacks:
   - Messenger — `/api/webhook/messenger` (+ `MESSENGER_VERIFY_TOKEN`)
   - Telegram — `/api/webhook/telegram`, and the driver bot
   - Delivery partner — `/api/webhook/delivery`
   - Stripe — `/api/stripe/webhook`, if card payments are in scope
3. The four cron jobs need no action: `vercel.json` registers them.

**Gate:** Phase 5's smoke test passes the webhook and cron sections.

---

## Phase 5 — Smoke test

```bash
SMOKE_SUPABASE_URL=https://<ref>.supabase.co \
SMOKE_ANON_KEY=<publishable key> \
node scripts/smoke-production.mjs https://<your-domain>
```

Exit code 0 means every required check passed. It asserts the things only a live
deployment can show: the database is reachable, all four cron routes return 401
unauthenticated, the Messenger verify handshake rejects a wrong token, the
security headers survived the CDN, `/privacy` and `/terms` are reachable (Meta
requires those URLs), and — most important for a multi-tenant product — **the
anon key reads back empty from `orders`, `customers`, `messages`,
`conversations` and `stores`**.

That last check is the one that cannot be done anywhere but production. If any
table returns a row, stop: tenant data is publicly readable.

Then do one real pass by hand: register a store, send a Messenger message, let
the AI reply, place an order, take a payment.

**Gate:** smoke exits 0, and one end-to-end order exists.

**Rollback:** from here on, restore via Supabase PITR (enabled in Phase 1).

---

## Phase 6 — Meta app review

Only possible once the app is live. Materials are drafted in
`docs/meta-app-review/`: reviewer instructions, permission descriptions, a demo
video script, and the use-case write-up.

Record the screencasts, create the dedicated review test user, then submit the
Tech Provider review. Review turnaround is long — start this as soon as Phase 5
passes rather than treating it as the last task.

---

## Post-cutover

- Point UptimeRobot (or equivalent) at `/api/health`, 5-minute interval. The
  repo's own uptime workflow already polls on the same schedule.
- Watch Sentry for the first 24 hours.
- Re-run `scripts/smoke-production.mjs` after any subsequent deploy that touches
  env vars, headers, or the cron routes.
