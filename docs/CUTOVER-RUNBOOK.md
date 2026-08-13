# Production cutover runbook

Step-by-step, gated. Every phase ends in a check that must pass before the next
one starts. If a gate fails, stop and use the rollback for that phase — do not
continue and fix forward.

`docs/DEPLOYMENT.md` explains *how* each system works; this file is the ordered
sequence for the day itself. `docs/LAUNCH_SETUP.md` lists the account signups.

**Prerequisite:** `main` is green — `npm test`, `npm run build`, and CI all pass.

---

## Phase 1 — Fresh Supabase project

> **Do not push migrations at the old cloud project.** It has the schema but no
> `supabase_migrations.schema_migrations` history, so the CLI starts at `001`
> and fails immediately with `relation "users" already exists`. Measured: 46 of
> 79 migrations fail that way. Create a new project.

1. Create a new Supabase project. Region: closest to Mongolia.
2. **Turn on PITR immediately.** It only protects from the moment it is enabled,
   and Phase 5 is the last point where a restore is still cheap.
3. Copy the project ref into the GitHub secret `SUPABASE_PROJECT_REF`, and
   `SUPABASE_ACCESS_TOKEN` if it is not already set.

**Gate:** project exists, PITR on, both secrets set.

---

## Phase 2 — Migrations

Run **Actions → Deploy Migrations** → target `production` → confirm `migrate`.

The workflow runs a dry-run and then **pauses** on the `production-migrations`
environment. Open the dry-run job log and read what is about to be applied
*before* approving the deployment.

```bash
# after the push completes, verify against the new project:
#   79 migrations applied, 167 tables, RLS on all of them
select count(*) from supabase_migrations.schema_migrations;          -- 80
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r';                        -- 167
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity; -- 0
```

**If it fails on a storage policy** — that is the one failure this was never able
to be rehearsed locally, because local `postgres` is a superuser and the
ownership check never fires. `storage.objects` is owned by
`supabase_storage_admin`. The 6 policies are wrapped in
`EXCEPTION WHEN insufficient_privilege` blocks (migrations `001` and `023`) so
the push should skip them with a NOTICE rather than abort. If it aborts anyway,
create those 6 policies by hand in **Dashboard → Storage → Policies** and re-run.

**Gate:** 80 rows in `schema_migrations`, 167 tables, 0 tables without RLS.

**Rollback:** delete the project and start Phase 1 again. There is no data yet,
so this is cheaper and safer than repairing a half-applied schema.

---

## Phase 3 — Vercel environment

Set the variables, then deploy. The app validates on boot
(`instrumentation.ts` → `checkEnvOnBoot`) and **exits fatally in production** if
any of these five are missing:

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
