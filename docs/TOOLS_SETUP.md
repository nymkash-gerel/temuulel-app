# Quality / Observability Tooling — User Setup

Complement to `LAUNCH_SETUP.md`. These tools improve AI quality measurement,
security scanning, performance monitoring, and stress-testing — all of which
strengthen the Meta App Review submission and protect production after
launch.

Code-side setup is already done. Each tool ships a workflow / wrapper that
**activates automatically when its env vars / accounts are configured.**

---

## 1. Langfuse — AI quality observability ⭐⭐⭐ Top ROI

**What it gives us:** every OpenAI call is traced (input prompt, output,
latency, cost, model) and can be rolled into eval datasets for regression
testing. Critical for proving "Mongolian AI quality" measurably better
than competitors.

**Code state:** `src/lib/ai/openai-client.ts` already wraps OpenAI with
`observeOpenAI()` when env keys are set. Falls back silently to the plain
client when not configured. The `langfuse` npm package is installed.

**Setup (you do):**

1. Sign up: https://cloud.langfuse.com (EU region — closest to us +
   GDPR-friendly). Free tier: 50K observations/month.
2. **Create project:** name `temuulel-prod`
3. **Settings → API Keys → Create new API keys:**
   - `LANGFUSE_PUBLIC_KEY` (pk-lf-...)
   - `LANGFUSE_SECRET_KEY` (sk-lf-...)
   - `LANGFUSE_HOST` = `https://cloud.langfuse.com`
4. Wire into Vercel:
   ```bash
   cd /Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app
   read "PUB?Langfuse public key: "
   read "SEC?Langfuse secret key: "
   printf '%s' "$PUB" | npx vercel env add LANGFUSE_PUBLIC_KEY production 2>&1 | tail -1
   printf '%s' "$SEC" | npx vercel env add LANGFUSE_SECRET_KEY production 2>&1 | tail -1
   printf 'https://cloud.langfuse.com' | npx vercel env add LANGFUSE_HOST production 2>&1 | tail -1
   git commit --allow-empty -m "chore: enable Langfuse observability" && git push origin main
   unset PUB SEC
   ```
5. Wait for deploy (~3 min), trigger one chat (`/api/chat/widget` or via
   widget) → check Langfuse dashboard → first trace appears.

**Eval dataset:** once 100+ real conversations are traced, mark a dozen
representative ones in the Langfuse UI as "expected good answers". Add
new prompt versions and run the eval to see regression scores before
deploying.

---

## 2. Semgrep — SAST scanning ⭐⭐ Required for Meta Review

**Workflow:** `.github/workflows/semgrep.yml` (already added)

Runs on every PR + nightly + manual trigger. Uploads SARIF to GitHub
Code Scanning (Security tab → Code scanning alerts).

**What it catches:**
- OWASP Top 10
- TypeScript / React / Next.js anti-patterns
- Hardcoded secrets, weak crypto
- SQL injection, XSS, SSRF, CSRF

**Setup:** nothing — runs automatically. Free for public repos. For
private repos under 100k LOC also free; above that requires Semgrep Pro.

**Verify after first run:** GitHub repo → **Security** tab → Code
scanning alerts → see findings. Triage by severity. Critical findings
post to Slack via the existing webhook.

---

## 3. k6 Load Test — pre-launch capacity check ⭐⭐

**Script:** `scripts/load-test/order-flow.js` (already added)

Simulates 50 concurrent users running the full chat-widget order flow
(query → name → address → phone → confirm) for 5 min. Asserts:
- p95 latency < 3s
- error rate < 5%
- order completion rate > 85%

**Run locally:**
```bash
brew install k6
k6 run scripts/load-test/order-flow.js
```

**Run in cloud (free 50 VU):**
```bash
k6 cloud login
k6 cloud scripts/load-test/order-flow.js
```

**When to run:** before each major launch milestone, after Vercel/Supabase
plan upgrades, when adding new public endpoints. Don't run more than once
per day to avoid flagging Vercel for abuse.

**Output:** `load-test-summary.json` with pass/fail summary.

---

## 4. Lighthouse CI — performance + accessibility ⭐⭐

**Workflow:** `.github/workflows/lighthouse.yml`
**Config:** `.lighthouserc.json` (thresholds)

Runs against production after every deploy + nightly. Audits:
- Landing (`/`)
- Login (`/login`)
- Signup (`/signup`)
- Pricing (`/pricing`)

**Thresholds:**
- Performance: warn < 0.75
- Accessibility: error < 0.85 (Meta App Review checks accessibility)
- Best practices: warn < 0.85
- SEO: warn < 0.85

**Setup:** nothing — runs automatically. Slack alert fires if any
threshold fails.

---

## 5. Checkly — synthetic monitor (you do)

**What it gives us:** real Playwright runs against production every 15 min,
asserting end-to-end flows still work. Catches regressions UptimeRobot
can't see (e.g. signup form broken, AI returns 500, dashboard JS error).

**Setup:**

1. Sign up: https://www.checklyhq.com (free 5 checks + 10K runs/month)
2. **Create check → API check:**
   - URL: `https://temuulel.com/api/health`
   - Frequency: **5 min**
   - Assert: `body.status equals "healthy"`
   - Alert channel: Slack (paste existing `SLACK_WEBHOOK_URL`)
3. **Create check → Browser check (Playwright):**
   - Frequency: **15 min**
   - Script: paste from below
4. Save

**Browser check script (paste into Checkly UI):**

```js
const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('https://temuulel.com')
await page.waitForLoadState('networkidle')
const heading = await page.textContent('h1')
if (!heading) throw new Error('Landing page hero heading missing')
await page.click('text=Үнэтэй танилц')
await page.waitForURL('**/pricing')
const buttons = await page.$$('a:has-text("Эхлэх"), button:has-text("Эхлэх")')
if (buttons.length === 0) throw new Error('Pricing CTA buttons missing')
await browser.close()
```

---

## 6. PostHog — product analytics (post-launch only)

**Why post-launch:** event tracking is only useful when you have real
users. Don't add the SDK until you've onboarded 10+ stores.

**Setup (later):**

1. Sign up: https://posthog.com (free 1M events/month)
2. Get API key
3. `npm install posthog-node posthog-js`
4. Wrap in `src/lib/analytics.ts` (we'll add when needed)

---

## State after this work

| Tool | Code-side status | User-side status |
|------|------------------|------------------|
| Langfuse | ✅ Auto-activates with env | ⏳ Need account + 3 keys |
| Semgrep | ✅ Workflow runs on every PR | ✅ Nothing — auto |
| k6 | ✅ Script + thresholds | ⏳ Run manually before launch |
| Lighthouse CI | ✅ Workflow + thresholds | ✅ Nothing — auto |
| Checkly | ⏳ Pending | ⏳ Need account + 2 check rules |
| PostHog | Not yet | Wait for real users |

---

## Final consolidated user actions (combined with LAUNCH_SETUP.md)

When you sit down to do this in one go, do them in this order:

1. **Resend** (LAUNCH_SETUP #1) — 30 min
2. **Upstash** (LAUNCH_SETUP #2) — 15 min
3. **Langfuse** (TOOLS_SETUP #1) — 10 min
4. **Checkly** (TOOLS_SETUP #5) — 20 min
5. **UptimeRobot** (LAUNCH_SETUP #3) — 10 min
6. **Sentry → Slack** (LAUNCH_SETUP #4) — 5 min
7. *(Wait for FB Business Verification)*
8. **Record screencasts** (LAUNCH_SETUP #5) — 30-60 min
9. **Tech Provider Review submission** (LAUNCH_SETUP #7) — 30 min

Total ~3 hours of focused work. Spread across 2-3 sittings is fine.
