/**
 * Boot-time environment variable validation.
 *
 * Wired into `register()` in instrumentation.ts so a missing or typo'd variable
 * fails loudly when the server starts, instead of surfacing later as a confusing
 * runtime error. Without this check, src/lib/supabase/{client,server}.ts fall
 * back to 'https://placeholder.supabase.co' and every query fails against a
 * domain that isn't ours.
 *
 * Variable names, and which of them are REQUIRED, are documented in .env.example
 * — keep the two in sync.
 */

export type EnvSeverity = 'error' | 'warning'

export interface EnvIssue {
  /** Canonical variable name the issue is about. */
  name: string
  message: string
  severity: EnvSeverity
}

export interface EnvReport {
  /** True when nothing fatal was found. Warnings do not clear this flag. */
  ok: boolean
  errors: EnvIssue[]
  warnings: EnvIssue[]
}

type EnvSource = Record<string, string | undefined>

interface VarSpec {
  name: string
  /**
   * Older names still accepted, checked in order after `name`. Resolving through
   * one of these emits a deprecation warning rather than an error.
   */
  deprecatedAliases?: string[]
  /**
   * Must parse as an absolute http(s) URL when set. Only ever set on variables
   * whose value is safe to echo into a log line.
   */
  isUrl?: boolean
  /** Explains the impact of leaving it unset. Shown in the log. */
  hint: string
}

/**
 * Required in production. In development and test these only warn, so a partial
 * .env.local still lets the app boot.
 */
const REQUIRED_IN_PRODUCTION: VarSpec[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    isUrl: true,
    hint: 'Supabase clients silently fall back to https://placeholder.supabase.co',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_KEY',
    deprecatedAliases: ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    hint: 'publishable key — both browser and server Supabase clients need it',
  },
  {
    name: 'SUPABASE_SECRET_KEY',
    deprecatedAliases: ['SUPABASE_SERVICE_ROLE_KEY'],
    hint: 'secret key — every RLS-bypassing server route needs it',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    isUrl: true,
    hint: 'absolute callback, redirect and webhook URLs are built from it',
  },
  {
    name: 'CRON_SECRET',
    hint: 'all four /api/cron routes fail closed in production without it',
  },
]

/**
 * Optional, but each one silently disables a feature — worth a startup warning
 * so a half-configured deploy is visible in the logs.
 */
const OPTIONAL_NOTABLE: { name: string; hint: string }[] = [
  { name: 'OPENAI_API_KEY', hint: 'AI replies fall back to deterministic templates' },
  { name: 'RESEND_API_KEY', hint: 'email notifications are skipped' },
  { name: 'UPSTASH_REDIS_REST_URL', hint: 'rate limiting uses a single-instance in-memory store' },
  { name: 'SENTRY_DSN', hint: 'server errors are not reported to Sentry' },
]

const REDEPLOY_HINT =
  'Set these in your hosting provider (Vercel → Project → Settings → Environment Variables).\n' +
  'NEXT_PUBLIC_* values are inlined into the bundle at build time, so after adding one you must\n' +
  'REDEPLOY — restarting the deployment alone will not pick it up.'

function isAbsoluteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function resolve(
  env: EnvSource,
  spec: VarSpec
): { value?: string; viaAlias?: string } {
  const primary = env[spec.name]?.trim()
  if (primary) return { value: primary }

  for (const alias of spec.deprecatedAliases ?? []) {
    const fallback = env[alias]?.trim()
    if (fallback) return { value: fallback, viaAlias: alias }
  }

  return {}
}

/**
 * Inspect the environment. Pure — logs nothing and throws nothing, so tests can
 * assert on the result directly.
 */
export function validateEnv(env: EnvSource = process.env): EnvReport {
  const isProduction = env.NODE_ENV === 'production'
  const issues: EnvIssue[] = []

  // Outside production a missing required var is a warning, not an error, so
  // `npm test` and a bare `npm run dev` still work without a full .env.local.
  const missingSeverity: EnvSeverity = isProduction ? 'error' : 'warning'

  for (const spec of REQUIRED_IN_PRODUCTION) {
    const { value, viaAlias } = resolve(env, spec)

    if (!value) {
      issues.push({
        name: spec.name,
        severity: missingSeverity,
        message: `not set — ${spec.hint}`,
      })
      continue
    }

    if (spec.isUrl && !isAbsoluteUrl(value)) {
      issues.push({
        name: spec.name,
        severity: missingSeverity,
        message: `is not an absolute http(s) URL (got "${value}")`,
      })
      continue
    }

    if (viaAlias) {
      issues.push({
        name: spec.name,
        severity: 'warning',
        message: `resolved from deprecated ${viaAlias} — rename it to ${spec.name} (see .env.example)`,
      })
    }
  }

  for (const { name, hint } of OPTIONAL_NOTABLE) {
    if (!env[name]?.trim()) {
      issues.push({ name, severity: 'warning', message: `not set — ${hint}` })
    }
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Validate, log, and abort the boot on a fatal misconfiguration.
 *
 * Called once from instrumentation.ts `register()`. Throwing here takes the
 * server instance down with a message naming the exact variables, which is the
 * whole point: a typo'd Vercel env var should be a one-line log, not a week of
 * "why is Supabase returning network errors".
 */
export function checkEnvOnBoot(env: EnvSource = process.env): EnvReport {
  const report = validateEnv(env)

  for (const warning of report.warnings) {
    console.warn(`[env] ${warning.name}: ${warning.message}`)
  }

  if (report.ok) return report

  const detail = report.errors.map(e => `  ${e.name}: ${e.message}`).join('\n')

  // `next build` runs with NODE_ENV=production but not necessarily with the
  // production environment attached (local builds, CI type-checks). Breaking the
  // build there would be a false alarm — the runtime check above is what
  // actually gates a bad deploy.
  if (env.NEXT_PHASE === 'phase-production-build') {
    console.warn(
      `[env] required variables missing during build (not fatal here):\n${detail}\n${REDEPLOY_HINT}`
    )
    return report
  }

  console.error(
    `[env] FATAL — required environment variables are missing or invalid:\n${detail}\n${REDEPLOY_HINT}`
  )

  throw new Error(
    `Environment validation failed: ${report.errors.map(e => e.name).join(', ')}`
  )
}
