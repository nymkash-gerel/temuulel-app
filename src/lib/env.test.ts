import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateEnv, checkEnvOnBoot } from './env'

/**
 * Every case passes an explicit env object rather than mutating process.env, so
 * the results don't depend on whatever .env.local the runner happened to load.
 */

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  NEXT_PUBLIC_APP_URL: 'https://temuulel.app',
  CRON_SECRET: 'cron-secret',
  // Optional-but-notable, set so warning assertions stay focused
  OPENAI_API_KEY: 'sk-test',
  RESEND_API_KEY: 'resend-test',
  UPSTASH_REDIS_REST_URL: 'https://upstash.test',
  SENTRY_DSN: 'https://sentry.test/1',
} as const

function names(issues: { name: string }[]): string[] {
  return issues.map(i => i.name)
}

describe('validateEnv', () => {
  it('passes with a fully configured production environment', () => {
    const report = validateEnv({ ...PRODUCTION_ENV })

    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it('reports each missing required var as an error in production', () => {
    const report = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    })

    expect(report.ok).toBe(false)
    expect(names(report.errors)).toEqual([
      'NEXT_PUBLIC_SUPABASE_KEY',
      'SUPABASE_SECRET_KEY',
      'NEXT_PUBLIC_APP_URL',
      'CRON_SECRET',
    ])
  })

  it('treats CRON_SECRET as required in production', () => {
    const report = validateEnv({ ...PRODUCTION_ENV, CRON_SECRET: undefined })

    expect(report.ok).toBe(false)
    expect(names(report.errors)).toEqual(['CRON_SECRET'])
  })

  it('accepts the new Supabase key names without any deprecation warning', () => {
    const report = validateEnv({ ...PRODUCTION_ENV })

    expect(report.warnings.some(w => w.message.includes('deprecated'))).toBe(false)
  })

  it('falls back to the deprecated Supabase names and warns instead of failing', () => {
    const report = validateEnv({
      ...PRODUCTION_ENV,
      NEXT_PUBLIC_SUPABASE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'legacy-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-key',
    })

    expect(report.ok).toBe(true)
    expect(names(report.warnings)).toEqual([
      'NEXT_PUBLIC_SUPABASE_KEY',
      'SUPABASE_SECRET_KEY',
    ])
    expect(report.warnings[0].message).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    expect(report.warnings[1].message).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('prefers the new name when both new and deprecated are set', () => {
    const report = validateEnv({
      ...PRODUCTION_ENV,
      SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-key',
    })

    expect(report.ok).toBe(true)
    expect(report.warnings).toEqual([])
  })

  it('rejects a required URL var that is not an absolute http(s) URL', () => {
    const report = validateEnv({
      ...PRODUCTION_ENV,
      NEXT_PUBLIC_SUPABASE_URL: 'project.supabase.co',
    })

    expect(report.ok).toBe(false)
    expect(names(report.errors)).toEqual(['NEXT_PUBLIC_SUPABASE_URL'])
    expect(report.errors[0].message).toContain('absolute http(s) URL')
  })

  it('treats whitespace-only values as unset', () => {
    const report = validateEnv({ ...PRODUCTION_ENV, CRON_SECRET: '   ' })

    expect(report.ok).toBe(false)
    expect(names(report.errors)).toEqual(['CRON_SECRET'])
  })

  it('does not mark OPENAI_API_KEY as required, matching .env.example', () => {
    const report = validateEnv({ ...PRODUCTION_ENV, OPENAI_API_KEY: undefined })

    expect(report.ok).toBe(true)
    expect(names(report.warnings)).toEqual(['OPENAI_API_KEY'])
  })

  it('warns about unset optional features without failing', () => {
    const report = validateEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      NEXT_PUBLIC_APP_URL: 'https://temuulel.app',
      CRON_SECRET: 'cron-secret',
    })

    expect(report.ok).toBe(true)
    expect(names(report.warnings)).toEqual([
      'OPENAI_API_KEY',
      'RESEND_API_KEY',
      'UPSTASH_REDIS_REST_URL',
      'SENTRY_DSN',
    ])
  })

  it('downgrades missing required vars to warnings outside production', () => {
    const report = validateEnv({ NODE_ENV: 'development' })

    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(names(report.warnings)).toContain('SUPABASE_SECRET_KEY')
  })
})

describe('checkEnvOnBoot', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the report without throwing when production is fully configured', () => {
    expect(() => checkEnvOnBoot({ ...PRODUCTION_ENV })).not.toThrow()
  })

  it('throws at production runtime naming the offending variables', () => {
    expect(() =>
      checkEnvOnBoot({ ...PRODUCTION_ENV, SUPABASE_SECRET_KEY: undefined })
    ).toThrow('Environment validation failed: SUPABASE_SECRET_KEY')

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[env] FATAL')
    )
  })

  it('warns instead of throwing during next build, so a local build still works', () => {
    expect(() =>
      checkEnvOnBoot({
        ...PRODUCTION_ENV,
        SUPABASE_SECRET_KEY: undefined,
        NEXT_PHASE: 'phase-production-build',
      })
    ).not.toThrow()

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing during build')
    )
  })

  it('never throws in development', () => {
    expect(() => checkEnvOnBoot({ NODE_ENV: 'development' })).not.toThrow()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('logs the redeploy hint for NEXT_PUBLIC_* vars', () => {
    expect(() =>
      checkEnvOnBoot({ ...PRODUCTION_ENV, NEXT_PUBLIC_SUPABASE_URL: undefined })
    ).toThrow()

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REDEPLOY'))
  })
})
