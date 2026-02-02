# Temuulel Ecommerce Chatbot Platform -- Deployment Guide

Complete guide for deploying the Temuulel platform built with Next.js 16, Supabase, and Vercel.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Supabase Project Setup](#3-supabase-project-setup)
4. [Vercel Deployment](#4-vercel-deployment)
5. [Domain & SSL](#5-domain--ssl)
6. [Cron Jobs](#6-cron-jobs)
7. [Database Backups](#7-database-backups)
8. [Monitoring](#8-monitoring)
9. [Post-Deployment Checklist](#9-post-deployment-checklist)
10. [Updating](#10-updating)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Before deploying, ensure you have the following:

- **Node.js 20+** -- download from [nodejs.org](https://nodejs.org). Verify with `node --version`.
- **npm** (bundled with Node.js) or **yarn** as your package manager.
- **Supabase account** -- sign up at [supabase.com](https://supabase.com). You will need a project for the Postgres database, authentication, storage, and realtime features.
- **Vercel account** -- sign up at [vercel.com](https://vercel.com). This is the recommended hosting platform for Next.js applications.
- **Git repository** -- the codebase should be hosted on GitHub (or GitLab/Bitbucket) for Vercel's automatic deployment integration.
- **Docker** (optional) -- required only if you want to run Supabase locally via the Supabase CLI.

---

## 2. Local Development Setup

### Clone and Install

```bash
git clone <your-repo-url>
cd temuulel-app
npm install
```

### Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the required values. The full list of environment variables is in `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, never expose to client) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the app (use `http://localhost:3000` for local dev) |
| `OPENAI_API_KEY` | No | OpenAI API key; if absent, AI features are disabled and templates are used instead |
| `FACEBOOK_APP_ID` | No | Facebook App ID for Messenger/Instagram integration |
| `FACEBOOK_APP_SECRET` | No | Facebook App Secret |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | No | Facebook Page access token for Messenger |
| `MESSENGER_VERIFY_TOKEN` | No | Verification token for Facebook webhook setup |
| `INSTAGRAM_APP_ID` | No | Instagram App ID |
| `TELEGRAM_BOT_TOKEN` | No | Telegram Bot token from @BotFather |
| `TELEGRAM_BOT_USERNAME` | No | Telegram bot username |
| `RESEND_API_KEY` | No | Resend API key for email notifications |
| `NOTIFICATION_FROM_EMAIL` | No | Sender email address for notifications |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | VAPID public key for web push notifications |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for web push notifications |
| `VAPID_SUBJECT` | No | VAPID subject (e.g. `mailto:support@yourdomain.com`) |
| `CRON_SECRET` | No | Secret token to authenticate cron job requests |
| `QSTASH_TOKEN` | No | Upstash QStash token for reliable webhook delivery |
| `QSTASH_CURRENT_SIGNING_KEY` | No | QStash current signing key |
| `QSTASH_NEXT_SIGNING_KEY` | No | QStash next signing key |
| `QPAY_BASE_URL` | No | QPay API base URL (`https://merchant.qpay.mn/v2`) |
| `QPAY_USERNAME` | No | QPay merchant username |
| `QPAY_PASSWORD` | No | QPay merchant password |
| `QPAY_INVOICE_CODE` | No | QPay invoice code |
| `SMS_API_URL` | No | SMS gateway API URL |
| `SMS_API_KEY` | No | SMS gateway API key |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry DSN for client-side error tracking |
| `SENTRY_DSN` | No | Sentry DSN for server-side error tracking |
| `SENTRY_AUTH_TOKEN` | No | Sentry auth token for source map uploads |
| `SENTRY_ORG` | No | Sentry organization slug |
| `SENTRY_PROJECT` | No | Sentry project slug |

### Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### Local Supabase (Optional)

If you prefer to develop against a local Supabase instance instead of a hosted project:

```bash
# Requires Docker to be installed and running
npx supabase start
```

This starts a local Supabase stack. Use the following connection details in your `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key-printed-by-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key-printed-by-supabase-start>
```

The local Postgres database is accessible directly at:

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Run Tests

The project uses Vitest for testing:

```bash
# Run all tests once
npm test

# Run tests in watch mode during development
npm run test:watch
```

### Build Check

Before deploying, verify the production build succeeds locally:

```bash
npm run build
```

This runs the Next.js production build and will surface any TypeScript errors, missing imports, or build-time issues.

---

## 3. Supabase Project Setup

### Create a New Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose your organization, enter a project name, set a strong database password, and select a region close to your users.
4. Wait for the project to finish provisioning.

### Run Database Migrations

Migrations are located in `supabase/migrations/` and must be run in sequential order. You can either use the Supabase CLI or run them manually via the SQL Editor in the Supabase Dashboard.

**Option A: Supabase CLI (recommended)**

```bash
# Link your local project to the remote Supabase project
npx supabase link --project-ref <your-project-ref>

# Push all migrations
npx supabase db push
```

**Option B: Manual via SQL Editor**

Open the SQL Editor in the Supabase Dashboard and run each migration file in order:

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables: stores, products, orders, customers, conversations, messages, users |
| `002_notifications_realtime.sql` | Notification system and Supabase Realtime subscriptions |
| `003_escalation.sql` | Chat escalation workflows |
| `004_conversation_metadata.sql` | Conversation metadata and tagging |
| `005_fix_rls_recursion.sql` | Fixes for Row Level Security policy recursion issues |
| `006_facebook_oauth.sql` | Facebook OAuth tables for Messenger/Instagram integration |
| `007_instagram_dm.sql` | Instagram Direct Message support |
| `008_rpc_functions.sql` | RPC helper functions for complex queries |
| `009_comment_auto_reply.sql` | Comment auto-reply rules (ManyChat-style) |
| `010_comment_ai_reply.sql` | AI-powered reply option for comment auto-rules |
| `011_product_facebook_post.sql` | Product-to-Facebook post linking |
| `012_product_ai_context.sql` | Product AI context for smarter chatbot responses |
| `013_business_types_services.sql` | Business type and service definitions |
| `014_performance_indexes.sql` | Performance indexes for query optimization |
| `015_flow_builder.sql` | Visual flow builder data model |
| `016_telegram_bookable_resources.sql` | Telegram integration and bookable resources |
| `017_returns.sql` | Returns and refund management |
| `018_compensation.sql` | Compensation and voucher system |
| `019_deliveries.sql` | Delivery tracking |
| `020_driver_portal.sql` | Driver portal and assignment |
| `021_earnings_tracking.sql` | Driver earnings tracking |
| `022_driver_ratings.sql` | Driver rating system |
| `023_scheduling_chat_multistore.sql` | Scheduling, chat improvements, and multi-store support |

### Enable Row Level Security

All migrations include RLS policy definitions, but verify that RLS is enabled on every table:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

Every table should show `rowsecurity = true`. If any table shows `false`, enable it:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

### Create Storage Buckets

In the Supabase Dashboard, go to **Storage** and create two buckets:

1. **`product-images`** -- stores product photos uploaded by merchants.
2. **`delivery-proofs`** -- stores delivery proof photos uploaded by drivers.

### Set Bucket Policies

For each bucket, add a policy to allow public read access so images can be displayed on the storefront and in chat:

```sql
-- Allow public read access to product-images
CREATE POLICY "Public read access for product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow public read access to delivery-proofs
CREATE POLICY "Public read access for delivery-proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proofs');
```

For write access, add policies that restrict uploads to authenticated users who own the relevant store.

### Enable Realtime

Enable Supabase Realtime for the following tables (required for live chat updates):

- `conversations`
- `messages`
- `notifications`

Migration `002_notifications_realtime.sql` enables Realtime for notifications. You can enable it for the other tables in the Supabase Dashboard under **Database > Replication**, or via SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Copy Project Credentials

From your Supabase Dashboard, go to **Settings > API** and copy:

- **Project URL** --> `NEXT_PUBLIC_SUPABASE_URL`
- **anon/public key** --> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** --> `SUPABASE_SERVICE_ROLE_KEY`

These values go into your Vercel environment variables and your local `.env.local`.

---

## 4. Vercel Deployment

### Connect Your Repository

1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New > Project**.
3. Import your GitHub repository containing the Temuulel codebase.
4. Vercel will auto-detect the framework as **Next.js**.

### Configure Build Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node.js Version | 20.x |

### Set Environment Variables

In Vercel Dashboard, go to **Settings > Environment Variables** and add all variables from `.env.example`. At minimum, set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (set to your Vercel deployment URL or custom domain)
- `CRON_SECRET` (generate a random string, e.g. `openssl rand -hex 32`)

Add all other variables for the features you plan to use (OpenAI, Facebook, Telegram, QPay, Resend, Sentry, etc.).

Set variables for the appropriate environments:
- **Production** -- your live deployment.
- **Preview** -- for pull request preview deployments (use staging Supabase credentials if available).
- **Development** -- for `vercel dev` local usage.

### Deploy

Once the repository is connected and environment variables are configured, Vercel will automatically build and deploy on every push to the `main` branch.

For manual deployment via CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

---

## 5. Domain & SSL

### Add a Custom Domain

1. In the Vercel Dashboard, go to your project's **Settings > Domains**.
2. Add your custom domain (e.g. `temuulel.mn` or `app.temuulel.mn`).
3. Follow the DNS configuration instructions provided by Vercel (add a CNAME or A record with your DNS provider).

### SSL Configuration

SSL certificates are provisioned and renewed automatically by Vercel. No manual configuration is needed. Vercel enforces HTTPS by default.

The application also sets the `Strict-Transport-Security` header (HSTS with 2-year max-age, includeSubDomains, and preload) via `next.config.ts`.

### Update Application URL

After setting up your custom domain, update the `NEXT_PUBLIC_APP_URL` environment variable in Vercel to your domain:

```
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Update External Webhook URLs

Update webhook/callback URLs in all external services to point to your custom domain:

- **Facebook Messenger webhook**: `https://yourdomain.com/api/webhook/messenger`
- **Telegram webhook**: set via Bot API -- `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/webhook/telegram`
- **QPay callback URL**: update in QPay merchant dashboard to `https://yourdomain.com/api/payments/qpay/callback`
- **Upstash QStash**: update delivery target URLs if using QStash for webhook delivery.

---

## 6. Cron Jobs

### Vercel Cron Configuration

The project includes a `vercel.json` file that configures scheduled cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 22 * * *"
    }
  ]
}
```

This runs the daily report endpoint every day at 22:00 UTC (06:00 UTC+8, Mongolian morning). The endpoint sends email summaries to store owners who have daily reports enabled.

### Cron Security

The `CRON_SECRET` environment variable protects cron endpoints from unauthorized access. Vercel automatically sends this secret as a `Bearer` token in the `Authorization` header when invoking cron jobs.

Generate a secure secret:

```bash
openssl rand -hex 32
```

Set it in Vercel's environment variables as `CRON_SECRET`.

In production, any request to `/api/cron/*` without a valid `Authorization: Bearer <CRON_SECRET>` header will be rejected with a 401 status.

### Adding New Cron Jobs

To add additional scheduled jobs, add entries to the `crons` array in `vercel.json` and create the corresponding API route under `src/app/api/cron/`.

**Note**: Vercel's free (Hobby) plan supports cron jobs that run once per day. Pro and Enterprise plans support more frequent schedules (down to every minute).

---

## 7. Database Backups

### Automatic Backups (Supabase Pro Plan)

If you are on the Supabase Pro plan or higher:

1. Go to the Supabase Dashboard.
2. Navigate to **Settings > Database > Backups**.
3. Automatic daily backups are enabled by default with 7-day retention.
4. Point-in-time recovery (PITR) is available on Pro plans for continuous backup coverage.

### Manual Backups with pg_dump

For manual backups or if you are on the Supabase Free plan:

```bash
# Get your database connection string from Supabase Dashboard > Settings > Database
# Use the "Connection string" (URI format)

pg_dump "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

To restore from a backup:

```bash
pg_restore --clean --no-owner --no-privileges \
  -d "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres" \
  backup_20260101_120000.dump
```

### Backup Best Practices

- Run manual backups before applying new migrations.
- Store backups in a secure, off-site location (e.g. encrypted S3 bucket).
- Test restoring from backups periodically to verify integrity.
- Keep at least 7 days of backup history.

---

## 8. Monitoring

### Sentry Error Tracking

The application integrates with [Sentry](https://sentry.io) for error tracking via `@sentry/nextjs`.

Set the following environment variables to enable Sentry:

```
NEXT_PUBLIC_SENTRY_DSN=https://examplekey@o123456.ingest.sentry.io/1234567
SENTRY_DSN=https://examplekey@o123456.ingest.sentry.io/1234567
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org
SENTRY_PROJECT=temuulel
```

When `SENTRY_AUTH_TOKEN` is set, source maps are automatically uploaded during the build for better stack traces. If the token is absent, the Sentry webpack plugin is disabled and the build proceeds without source map uploads.

### Vercel Analytics

Enable Vercel Analytics in the Vercel Dashboard under your project's **Analytics** tab. This provides:

- Web Vitals (LCP, FID, CLS, TTFB)
- API route latency and throughput
- Page view tracking
- Geographic distribution of users

### Health Check Endpoint

The application exposes a health check endpoint at:

```
GET /api/health
```

**Response (healthy)**:
```json
{
  "status": "healthy",
  "checks": {
    "app": "ok",
    "database": "ok"
  },
  "timestamp": "2026-01-31T12:00:00.000Z",
  "version": "0.1.0"
}
```

**Response (degraded -- database unreachable)**:
```json
{
  "status": "degraded",
  "checks": {
    "app": "ok",
    "database": "error"
  },
  "timestamp": "2026-01-31T12:00:00.000Z",
  "version": "0.1.0"
}
```

- Returns HTTP `200` when all checks pass.
- Returns HTTP `503` when any check fails.

### Uptime Monitoring

Point an external uptime monitoring service at `/api/health` to get alerted when the application or database goes down. Recommended services:

- [UptimeRobot](https://uptimerobot.com) (free tier available)
- [Better Uptime](https://betteruptime.com)
- [Vercel Monitoring](https://vercel.com/docs/observability) (built-in)

Configure the monitor to:
- Check `GET https://yourdomain.com/api/health` every 1-5 minutes.
- Alert when the response status is not `200`.
- Alert when the response body `status` field is `"degraded"`.

### Logging

- **Vercel Logs**: Available in the Vercel Dashboard under **Deployments > Logs**. Shows server-side console output from API routes and middleware.
- **Supabase Logs**: Available in the Supabase Dashboard under **Logs**. Shows database queries, auth events, and storage operations.
- **Structured Logging**: API routes log key events (errors, cron runs, webhook deliveries) using `console.error` and `console.log` in JSON-friendly format for easier parsing in Vercel's log viewer.

---

## 9. Post-Deployment Checklist

Run through this checklist after every production deployment:

- [ ] All required environment variables are configured in Vercel
- [ ] All Supabase migrations have been run (001 through 023)
- [ ] Storage buckets created (`product-images`, `delivery-proofs`)
- [ ] Storage bucket policies set for public read access
- [ ] Row Level Security enabled on all public tables
- [ ] Supabase Realtime enabled for `conversations`, `messages`, `notifications`
- [ ] `GET /api/health` returns HTTP 200 with `"status": "healthy"`
- [ ] Facebook Messenger webhook verified (`/api/webhook/messenger`)
- [ ] Telegram webhook set via Bot API
- [ ] QPay callback URL configured in QPay merchant dashboard
- [ ] VAPID keys generated and set (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- [ ] Cron job configured in `vercel.json` and `CRON_SECRET` is set
- [ ] Sentry connected and receiving test events
- [ ] Custom domain configured and DNS propagated
- [ ] SSL certificate active (automatic via Vercel)
- [ ] Health check monitoring service pointed at `/api/health`

### Generating VAPID Keys

If you have not yet generated VAPID keys for web push notifications:

```bash
npx web-push generate-vapid-keys
```

This outputs a public and private key pair. Set them in your environment variables:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:support@yourdomain.com
```

---

## 10. Updating

### Standard Update Process

```bash
# Pull latest changes
git pull origin main

# Install any new or updated dependencies
npm install

# Run the build locally to catch errors before deploying
npm run build

# Run tests to verify nothing is broken
npm test
```

If the build and tests pass, push to `main`. Vercel automatically deploys from the `main` branch.

### Database Migration Updates

When new migrations are added:

```bash
# Review new migration files in supabase/migrations/
# Then push to Supabase
npx supabase db push
```

Or run the new SQL files manually via the Supabase Dashboard SQL Editor.

**Always back up your database before running new migrations in production.**

### Rolling Back

If a deployment causes issues:

1. **Vercel rollback**: In the Vercel Dashboard, go to **Deployments**, find the last known-good deployment, and click **Promote to Production**.
2. **Database rollback**: Restore from your latest backup if a migration caused data issues. Supabase PITR (Pro plan) allows restoring to any point in time.

---

## 11. Troubleshooting

### Common Issues

**RLS policies blocking queries**

Symptom: API routes return empty arrays or "permission denied" errors.

Fix: Verify RLS policies are correctly defined. Check the Supabase Dashboard under **Authentication > Policies**. Use the service role key (not the anon key) for server-side operations that need to bypass RLS.

```sql
-- Check which policies exist for a table
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

**Missing environment variables**

Symptom: Runtime errors like `Supabase credentials not configured` or features silently not working.

Fix: Compare your Vercel environment variables against `.env.example`. Ensure all required variables are set for the Production environment. After adding variables, redeploy the application (Vercel does not hot-reload env var changes).

**Facebook webhook verification failing**

Symptom: Facebook shows "Callback URL could not be verified" when setting up the Messenger webhook.

Fix:
1. Ensure `MESSENGER_VERIFY_TOKEN` in Vercel matches the verify token you entered in the Facebook Developer Console.
2. Ensure the webhook URL is `https://yourdomain.com/api/webhook/messenger` (HTTPS required).
3. Verify the app is deployed and the endpoint is reachable.
4. Check Vercel logs for the incoming GET request from Facebook.

**CORS errors on the chat widget**

Symptom: Browser console shows `Access-Control-Allow-Origin` errors when loading the widget on a third-party site.

Fix: The CORS headers for `/api/chat/widget`, `/api/products/search`, `/api/orders`, and `/api/webhook/*` are configured in `next.config.ts`. If you are embedding the widget on a new domain and seeing CORS errors, verify that the route's CORS headers include the correct `Access-Control-Allow-Origin` value. The current configuration uses `*` (allow all origins) for public-facing API endpoints.

**Build failures related to Sentry**

Symptom: Build fails with Sentry-related errors when `SENTRY_AUTH_TOKEN` is not set.

Fix: This is expected if you have not configured Sentry. The `next.config.ts` disables the Sentry webpack plugin when `SENTRY_AUTH_TOKEN` is absent, so builds should succeed without it. If the build still fails, ensure `@sentry/nextjs` is installed (`npm install`) and check that `next.config.ts` includes the `silent` and `disable*WebpackPlugin` flags.

**Local Supabase not starting**

Symptom: `npx supabase start` fails.

Fix: Ensure Docker is installed and running. The Supabase CLI requires Docker to run the local stack. Run `docker info` to verify Docker is accessible.

### Debug Resources

| Resource | Location |
|----------|----------|
| Vercel deployment logs | Vercel Dashboard > Deployments > select deployment > Logs |
| Vercel function logs | Vercel Dashboard > Logs (real-time) |
| Supabase database logs | Supabase Dashboard > Logs > Postgres |
| Supabase auth logs | Supabase Dashboard > Logs > Auth |
| Sentry error dashboard | [sentry.io](https://sentry.io) > your project |
| Health check | `GET https://yourdomain.com/api/health` |
| Next.js build output | Run `npm run build` locally and inspect terminal output |

### Getting Help

- **Supabase documentation**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js documentation**: [nextjs.org/docs](https://nextjs.org/docs)
- **Sentry for Next.js**: [docs.sentry.io/platforms/javascript/guides/nextjs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
