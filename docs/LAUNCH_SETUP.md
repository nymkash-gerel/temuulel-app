# Launch Setup — User Actions Checklist

Tasks that require user-side account creation, dashboard configuration,
or external credentials. Grouped by urgency. Each item links to the exact
dashboard page and provides the exact terminal command to wire the result
back into our Vercel env + repo.

> Pattern for every secret below:
> ```bash
> # 1. Paste secret into a tmp file (never pasted into chat)
> read VAR ; echo > /tmp/v.txt ; pbpaste > /tmp/v.txt
> # 2. Pass through env without echoing
> V=$(cat /tmp/v.txt)
> # 3. Add to Vercel prod (no trailing newline — the block-echo-env hook
> #    will guard Claude Code from using the `echo | vercel env add` form)
> printf 'y\n' | npx vercel env rm <NAME> production 2>&1 | tail -1
> printf '%s' "$V" | npx vercel env add <NAME> production 2>&1 | tail -1
> # 4. Trigger redeploy
> git commit --allow-empty -m "chore: set <NAME>" && git push origin main
> # 5. Clean up
> unset V ; rm -f /tmp/v.txt
> ```

---

## 🔴 Launch-blocking — do before the first real user signs up

### 1. Resend — signup / password-reset email

**Why:** Supabase's built-in auth email is slow and often goes to spam. Real
users hitting "forgot password" or trying to verify their email will not
receive it. The existing `RESEND_API_KEY` env var is also **invalid** — our
transactional emails (order confirmations, low-stock alerts) are failing
silently in prod right now.

**Steps:**

1. Sign up / log in: https://resend.com
2. Go to **Domains** → **Add Domain** → enter `temuulel.com`
3. Copy the 4 DNS records Resend shows you (SPF, DKIM ×2, DMARC)
4. In Cloudflare dashboard for `temuulel.com`, add them as **TXT** records.
   Turn **proxy OFF** (DNS only / grey cloud) for these records.
5. Back in Resend, click **Verify DNS**. Wait until all green.
6. Go to **API Keys** → **Create API Key** → name it `temuulel-prod` →
   permission: **Full access** → copy the key.
7. Terminal:
   ```bash
   cd /Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app
   read "RESEND_KEY?Resend API key: "    # paste when prompted, no echo
   printf 'y\n' | npx vercel env rm RESEND_API_KEY production 2>&1 | tail -1
   printf '%s' "$RESEND_KEY" | npx vercel env add RESEND_API_KEY production 2>&1 | tail -1
   git commit --allow-empty -m "chore: rotate RESEND_API_KEY" && git push origin main
   unset RESEND_KEY
   ```
8. Configure Supabase Auth to use Resend SMTP:
   - Supabase dashboard → https://supabase.com/dashboard/project/nplzzjqainveqcuohsjo/auth/templates
   - Scroll to **SMTP Settings** → **Enable Custom SMTP**
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** *(the same API key from step 6)*
   - **Sender email:** `noreply@temuulel.com`
   - **Sender name:** `Temuulel`
   - **Save**
9. Test: sign up with a fresh email on https://temuulel.com/signup — the
   confirmation email should arrive within 30s from `noreply@temuulel.com`.

---

### 2. Upstash Redis — real rate limiting

**Why:** Rate-limit code is already wired (every public endpoint uses
`rateLimit()`), but without `UPSTASH_REDIS_REST_URL` it falls back to an
in-memory counter that resets on every Vercel cold start — effectively no
limit across lambda instances.

**Steps:**

1. Sign up / log in: https://console.upstash.com
2. **Create Database** → name `temuulel-prod` → region **ap-southeast-1**
   (Singapore — same as Supabase, lowest latency) → **Regional** →
   **Create**
3. On the database page, scroll to **REST API** section
4. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**
5. Terminal:
   ```bash
   cd /Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app
   read "U_URL?Upstash REST URL: "
   read "U_TOKEN?Upstash REST Token: "
   printf 'y\n' | npx vercel env rm UPSTASH_REDIS_REST_URL production 2>&1 | tail -1
   printf 'y\n' | npx vercel env rm UPSTASH_REDIS_REST_TOKEN production 2>&1 | tail -1
   printf '%s' "$U_URL"   | npx vercel env add UPSTASH_REDIS_REST_URL   production 2>&1 | tail -1
   printf '%s' "$U_TOKEN" | npx vercel env add UPSTASH_REDIS_REST_TOKEN production 2>&1 | tail -1
   git commit --allow-empty -m "chore: enable Upstash rate limiting" && git push origin main
   unset U_URL U_TOKEN
   ```
6. Verify: hit `/api/chat/widget` ~35 times in under 1 minute from a
   single IP — the 31st-ish call should start returning `429 Too many
   requests`. (Rate limit for that endpoint is 30/min.)

**Free tier:** 10,000 commands/day — enough for ~300 stores hitting
public endpoints.

---

### 3. UptimeRobot — 5-minute production health monitor

**Why:** No external pings today means if `/api/health` goes to 5xx for
any reason (DB down, Supabase paused, env var dropped) we find out from
customer complaints. UptimeRobot checks every 5 min and alerts to email
+ Slack.

**Steps:**

1. Sign up / log in: https://uptimerobot.com
2. **New Monitor** → **HTTPS(S)** → URL: `https://temuulel.com/api/health`
3. **Monitoring Interval:** 5 minutes (free tier default)
4. **Keyword (optional):** `"healthy"` — this fails the monitor if our
   status flips to `degraded` even when the HTTP code is 200
5. **Alert Contacts:**
   - Email: your@email
   - Slack: paste the same `SLACK_WEBHOOK_URL` used by our GitHub Actions
     (https://api.slack.com/apps → Incoming Webhooks → copy)
6. **Create Monitor**
7. Test the alert: in Supabase, briefly pause the project, wait 5-10 min,
   confirm Slack + email alert arrives, then resume.

---

## 🟠 Before Facebook App Review submission

### 4. Sentry → Slack integration

**Why:** Sentry is active (we verified `services.sentry: true` earlier)
but prod errors only surface in the Sentry dashboard. Route them to Slack
for real-time awareness.

**Steps:**

1. Go to https://sentry.io → your `temuulel` project
2. **Settings → Integrations → Slack** → **Install**
3. OAuth Slack workspace
4. **Create alert rule:**
   - **When:** An issue's state is set to `unresolved`
   - **If:** The issue is new **OR** matches a regression
   - **Then:** Send a notification to Slack channel — pick the same
     channel the webhook posts to (Shijir DM or `#deploys`)
5. Save
6. Test: visit https://temuulel.com/api/intentionally-404 → check Sentry
   sees the hit. (Or wait for a real error.)

---

### 5. Record the 5 Meta App Review screencasts

**What:** Videos Meta reviewers watch to verify each requested permission
actually works as described.

**Reference:** scripts are already written in
[`docs/meta-app-review/SCREENCASTS.md`](./meta-app-review/SCREENCASTS.md)

**Tools:** Loom (free — https://loom.com) or QuickTime + upload to
unlisted YouTube.

**Checklist per video:**

| # | Title | Length | Covers |
|---|-------|--------|--------|
| 1 | Product Overview | 1:30 | What Temuulel is |
| 2 | Facebook Page Connection | 2:00 | `pages_messaging`, `pages_manage_metadata`, `business_management` |
| 3 | Customer Messages Flow | 1:30 | `pages_messaging` live demo |
| 4 | Instagram DM Handling | 1:30 | `instagram_basic`, `instagram_manage_messages` |
| 5 | Data Deletion & Account Management | 1:00 | GDPR compliance |

**Before recording:**

- Use the demo store already created (`Test Demo Shop`,
  `e6c3a3ef-137a-41c0-bcd0-639cb13186f0`) or create a second one.
- Seed 5-10 products with real-looking prices and images.
- Have a second Facebook test user ready in **App → Roles → Test Users**
  so you can demonstrate messaging from "the customer side".

Upload each to Loom → copy the public URL → paste into Meta App Review
submission form.

---

### 6. Business Verification (already in progress)

Waiting on Meta — no action needed until they respond. Typical turnaround
is 3–7 business days.

**Track status:** https://business.facebook.com/settings/security

**If rejected:** Meta usually explains what document was missing. Common
issues: business registration document in Mongolian must be accompanied
by an English translation.

---

### 7. Tech Provider Review submission

**Prerequisite:** Business Verification approved.

**Do this after:**

1. Business Verification is green ✅
2. The 5 screencasts are recorded + uploaded
3. `/privacy`, `/terms`, `/data-deletion`, `/data-handling` are live
   (they are — all at https://temuulel.com)
4. Webhook still verifying (ours is — auto-test:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     "https://temuulel.com/api/webhook/messenger?hub.mode=subscribe&hub.verify_token=TEST&hub.challenge=HELLO"
   # expect: 403 (signals webhook is alive but rejecting bad token,
   # which is what it should do)
   ```

**Submission form:**

Copy-paste from [`docs/meta-app-review/PERMISSION_USE_CASES.md`](./meta-app-review/PERMISSION_USE_CASES.md)
into the Meta App Review form. Every permission + screencast link.

**Review tips:** Meta reviewers respond via email + in-dashboard
comments. Address every piece of feedback within 24h — slow responses
often get the whole submission rejected.

---

### 8. Facebook App Review — dedicated test user

**Why:** Meta reviewers need to log in as a real-world user without seeing
real customer data. Create a dedicated test user for them.

**Steps:**

1. Create a fresh email (e.g. `review-test@temuulel.com` via Resend — or
   gmail is fine)
2. Sign up at https://temuulel.com/signup
3. Onboard: pick `ecommerce`, store name `Meta Review Demo`
4. Add 5 realistic products (phones/laptops if you want to mirror the
   `iPhone 15 Pro` we already have)
5. Write a short intro message in the chat widget settings like:
   *"Hi, this is the Meta Review demo account. Try sending a message
   from Messenger — the AI should reply."*
6. In the submission form's **Test Credentials** section, paste:
   ```
   URL:      https://temuulel.com/login
   Email:    review-test@temuulel.com
   Password: MetaReview2026!
   ```

---

## 🟡 Post-launch (do in the first 2 weeks)

### 9. QPay merchant credentials (live payments)

- QPay merchant onboarding is a paper/email process with QPay Mongolia.
  Contact info@qpay.mn
- Once approved, they give you a merchant ID + access token
- Put both into Vercel prod env as `QPAY_MERCHANT_ID` and
  `QPAY_ACCESS_TOKEN`
- Existing code in `src/lib/qpay.ts` already reads those env vars

### 10. Stripe live mode (international cards)

- Dashboard → https://dashboard.stripe.com/test/apikeys
- Flip toggle from Test to Live, go through KYC, then copy live keys
- Add `STRIPE_LIVE_SECRET_KEY` and `STRIPE_LIVE_WEBHOOK_SECRET` to
  Vercel prod env

### 11. Support email (support@temuulel.com)

- In Cloudflare DNS for `temuulel.com`:
  - **MX** record, host `@`, priority `10`, value
    `smtp.google.com` (Google Workspace) *or* Resend Inbound catch-all
- Sign up for Google Workspace (₮8,900/user/mo) and create
  `support@temuulel.com` mailbox
- OR use Cloudflare Email Routing (free) to forward
  `support@temuulel.com` → your personal Gmail

### 12. `.env.example` — onboarding for future contributors

After the above secrets are set, we should commit a sanitized
`.env.example` with all required variable names (not values). Low
priority until we have a second developer.

---

## 🟢 Nice-to-have (later)

| # | Task | Effort |
|---|------|--------|
| 13 | CHANGELOG auto-generation from conventional commits | 1h |
| 14 | Database backup restore drill (prove Supabase backups are usable) | 2h |
| 15 | Load test: k6 script simulating 100 concurrent users placing orders | 3h |
| 16 | Categories UI: surface "electronics" in the Free-plan product form | 15 min |
| 17 | Product status UX: make it one click to flip draft → active | 30 min |
| 18 | Onboarding progress bar: tighter copy, fewer clicks | 1h |
| 19 | Dashboard welcome tour (first-time-user overlay) | 2h |

---

## Verifying after each task

- **After #1 (Resend):** new-user signup email arrives within 30s, sender
  shows `noreply@temuulel.com`, lands in inbox not spam.
- **After #2 (Upstash):** 31st `/api/chat/widget` call in a minute returns
  `429`.
- **After #3 (UptimeRobot):** pausing Supabase raises a Slack + email alert
  within 10 min.
- **After #4 (Sentry→Slack):** trigger any prod error, Slack receives an
  alert with stack-trace link.
- **After #5-8 (Meta):** Meta App Review status dashboard flips to
  `Under Review` after submission.

---

## State of env vars in Vercel prod (as of 2026-04-23)

✅ Set and verified:
- `NEXT_PUBLIC_SUPABASE_URL` (Singapore prod)
- `NEXT_PUBLIC_SUPABASE_KEY` (anon)
- `SUPABASE_SECRET_KEY` (service role)
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- `SLACK_WEBHOOK_URL`
- `OPENAI_API_KEY`
- `FACEBOOK_APP_SECRET`, `MESSENGER_VERIFY_TOKEN`
- `TELEGRAM_BOT_TOKEN`, `DRIVER_TELEGRAM_BOT_TOKEN`

⚠️ Set but invalid — must rotate in #1:
- `RESEND_API_KEY` — returns `400 "API key is invalid"` from Resend API

❌ Not set — must add in #2:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

❌ Not set — add in #9/#10:
- `QPAY_MERCHANT_ID`, `QPAY_ACCESS_TOKEN`
- `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_WEBHOOK_SECRET`
