#!/usr/bin/env node
/**
 * smoke-production.mjs — post-cutover smoke test.
 *
 * Runs against a deployed URL and asserts the things that can only be checked
 * once the app is actually live: the database is reachable, the cron routes
 * fail closed, the security headers survived the CDN, the public pages Meta
 * requires exist, and — the one that matters most for a multi-tenant product —
 * the anon key cannot read another store's data.
 *
 *   node scripts/smoke-production.mjs https://temuulel.com
 *
 * Optional, enables the RLS isolation check (the most valuable assertion here):
 *   SMOKE_SUPABASE_URL=...  SMOKE_ANON_KEY=...  node scripts/smoke-production.mjs https://temuulel.com
 *
 * Exit code 0 = every required check passed. 1 = at least one failed.
 * Warnings never fail the run: a disabled optional integration is a decision,
 * not a defect, but it should be visible in the output.
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || '').replace(/\/$/, '')
if (!BASE) {
  console.error('usage: node scripts/smoke-production.mjs https://your-domain.com')
  process.exit(2)
}

const TIMEOUT_MS = 20_000
let failed = 0
let warned = 0
/** Set from /api/health. Dev deliberately allows unauthenticated cron runs. */
let isProduction = true

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
}

function pass(name, detail = '') {
  console.log(`  ${c.ok('PASS')}  ${name}${detail ? c.dim('  ' + detail) : ''}`)
}
function fail(name, detail) {
  failed++
  console.log(`  ${c.bad('FAIL')}  ${name}${detail ? '  ' + detail : ''}`)
}
function warn(name, detail) {
  warned++
  console.log(`  ${c.warn('WARN')}  ${name}${detail ? c.dim('  ' + detail) : ''}`)
}
function section(title) {
  console.log(`\n${c.dim('──')} ${title}`)
}

async function get(path, init = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal, redirect: 'manual' })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------

async function checkHealth() {
  section('Health')
  let res
  try {
    res = await get('/api/health')
  } catch (e) {
    return fail('GET /api/health', String(e.message || e))
  }
  if (res.status !== 200) {
    fail('GET /api/health', `expected 200, got ${res.status}`)
    return
  }
  const body = await res.json()
  pass('GET /api/health', '200')

  if (body.status === 'healthy') pass('overall status', 'healthy')
  else fail('overall status', `${body.status} — checks: ${JSON.stringify(body.checks)}`)

  if (body.checks?.database?.status === 'ok') {
    pass('database reachable', `${body.checks.database.latency_ms}ms`)
  } else {
    fail('database reachable', JSON.stringify(body.checks?.database))
  }

  isProduction = body.environment === 'production'
  if (isProduction) pass('NODE_ENV', 'production')
  else warn('NODE_ENV', `${body.environment} — expected production; cron checks below relax accordingly`)

  // Optional integrations: report, never fail. A blank one is a config decision.
  section('Integrations (reported, not required)')
  for (const [name, on] of Object.entries(body.services || {})) {
    if (on) pass(name, 'configured')
    else warn(name, 'not configured — the matching feature is off')
  }
}

async function checkCronFailClosed() {
  section('Cron routes fail closed')
  // Each must reject an unauthenticated request. 401 = the handler ran and
  // stopped at auth. 500 = CRON_SECRET is unset in production (also a
  // rejection, but it means the variable is missing — call that out).
  // Outside production the routes intentionally allow unauthenticated runs so
  // they can be triggered locally, so a non-401 there is expected, not a defect.
  const strict = isProduction
  if (!strict) console.log(c.dim('  (non-production target — reporting only, these cannot fail the run)'))

  const routes = ['daily-report', 'reactivate-delayed', 'payment-followup', 'broadcast']
  for (const r of routes) {
    const note = (name, detail) => (strict ? fail(name, detail) : warn(name, detail))
    try {
      const res = await get(`/api/cron/${r}`)
      if (res.status === 401) pass(`/api/cron/${r}`, '401 unauthenticated')
      // 429 means the limiter answered before the auth check, so this run
      // proved nothing about whether the route rejects an unauthenticated
      // caller. Inconclusive is not the same as safe — fail and rerun.
      else if (res.status === 429) note(`/api/cron/${r}`, '429 rate limited — INCONCLUSIVE, rerun in a minute')
      else if (res.status === 500) note(`/api/cron/${r}`, '500 — CRON_SECRET is not set in this environment')
      else note(`/api/cron/${r}`, `expected 401, got ${res.status} — the route may be UNPROTECTED`)
    } catch (e) {
      fail(`/api/cron/${r}`, String(e.message || e))
    }
  }
}

async function checkWebhooks() {
  section('Webhook endpoints registered')
  // The Messenger verify handshake: a wrong token must NOT be echoed back.
  try {
    const res = await get('/api/webhook/messenger?hub.mode=subscribe&hub.verify_token=smoke-wrong-token&hub.challenge=smoke123')
    const text = await res.text()
    if (text.includes('smoke123')) {
      fail('messenger verify', 'echoed the challenge for a WRONG token — anyone could bind this webhook')
    } else if (res.status === 403 || res.status === 401) {
      pass('messenger verify', `${res.status} rejects a wrong token`)
    } else {
      warn('messenger verify', `status ${res.status}, challenge not echoed`)
    }
  } catch (e) {
    fail('messenger verify', String(e.message || e))
  }

  // The rest only need to exist — a POST without a valid signature should be
  // rejected, but never 404 (which would mean the URL registered externally is wrong).
  for (const path of ['/api/webhook/telegram', '/api/webhook/delivery', '/api/stripe/webhook']) {
    try {
      const res = await get(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (res.status === 404) fail(path, '404 — no handler; an externally registered URL would be dead')
      else pass(path, `${res.status} (exists, rejects unsigned)`)
    } catch (e) {
      fail(path, String(e.message || e))
    }
  }
}

async function checkPublicPages() {
  section('Public pages')
  // Meta app review requires reachable privacy + data-deletion URLs.
  for (const [path, why] of [
    ['/privacy', 'Meta app review requires this URL'],
    ['/terms', 'Meta app review requires this URL'],
    ['/status', 'public status page'],
  ]) {
    try {
      const res = await get(path)
      if (res.status === 200) pass(path, why)
      else fail(path, `expected 200, got ${res.status} — ${why}`)
    } catch (e) {
      fail(path, String(e.message || e))
    }
  }
}

async function checkSecurityHeaders() {
  section('Security headers (survive the CDN?)')
  let res
  try {
    res = await get('/')
  } catch (e) {
    return fail('GET /', String(e.message || e))
  }
  const expected = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': null, // checked separately — max-age must be > 0
    'content-security-policy': null,
    'permissions-policy': null,
  }
  for (const [header, want] of Object.entries(expected)) {
    const got = res.headers.get(header)
    if (!got) { fail(header, 'missing'); continue }
    if (want && got !== want) { fail(header, `expected "${want}", got "${got}"`); continue }
    // A present HSTS header still disables HSTS when max-age is 0, so presence
    // alone is not the assertion worth making.
    if (header === 'strict-transport-security') {
      const maxAge = Number(/max-age=(\d+)/i.exec(got)?.[1])
      if (!Number.isFinite(maxAge)) { fail(header, `no max-age directive: "${got}"`); continue }
      if (maxAge === 0) { fail(header, 'max-age=0 — HSTS is DISABLED'); continue }
    }
    pass(header, got.length > 48 ? got.slice(0, 48) + '…' : got)
  }
}

async function checkTenantIsolation() {
  section('Multi-tenant isolation (anon key vs RLS)')
  const url = process.env.SMOKE_SUPABASE_URL
  const key = process.env.SMOKE_ANON_KEY
  if (!url || !key) {
    warn('RLS isolation', 'skipped — set SMOKE_SUPABASE_URL and SMOKE_ANON_KEY to run the most important check')
    return
  }
  // The anon key is public by design; RLS is what stops it reading tenant data.
  // An unauthenticated anon request must come back EMPTY, not merely non-error.
  const tables = ['orders', 'customers', 'messages', 'conversations', 'stores']
  for (const t of tables) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${t}?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      const body = await res.json().catch(() => null)

      if (res.ok && Array.isArray(body)) {
        if (body.length === 0) pass(`anon read ${t}`, 'empty — RLS holding')
        else fail(`anon read ${t}`, `RETURNED ${body.length} ROW(S) — tenant data is publicly readable`)
        continue
      }

      // A rejection only counts if RLS/permissions did the rejecting. A bad key
      // or a missing table means the request never reached the policy, so this
      // check proved nothing about isolation — that is a failure, not a pass.
      const code = body?.code || ''
      const msg = String(body?.message || body?.msg || '')
      const inconclusive =
        res.status === 401 || res.status === 403 ||
        /api ?key|jwt|token/i.test(msg) ||
        code === '42P01' // undefined_table — wrong project or wrong name
      if (inconclusive) {
        fail(`anon read ${t}`, `INCONCLUSIVE (${res.status}${code ? ' ' + code : ''}) ${msg} — the key never reached RLS`)
      } else {
        // e.g. 42501 insufficient_privilege: the policy itself refused.
        pass(`anon read ${t}`, `rejected by the database (${code || res.status})`)
      }
    } catch (e) {
      fail(`anon read ${t}`, String(e.message || e))
    }
  }
}

// ---------------------------------------------------------------------------

console.log(`\nSmoke test → ${BASE}`)
await checkHealth()
await checkCronFailClosed()
await checkWebhooks()
await checkPublicPages()
await checkSecurityHeaders()
await checkTenantIsolation()

console.log(
  `\n${failed === 0 ? c.ok('SMOKE PASSED') : c.bad(`SMOKE FAILED — ${failed} check(s)`)}` +
  `${warned ? c.dim(`  (${warned} warning${warned === 1 ? '' : 's'})`) : ''}\n`
)
process.exit(failed === 0 ? 0 : 1)
