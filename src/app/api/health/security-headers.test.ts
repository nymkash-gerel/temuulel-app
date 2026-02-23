import { describe, it, expect } from 'vitest'

/**
 * Verify security headers are configured in next.config.ts.
 * These tests parse the config file to ensure headers aren't accidentally removed.
 */

// Read the config as a string for static analysis
import { readFileSync } from 'fs'
import { resolve } from 'path'

const configPath = resolve(__dirname, '../../../../next.config.ts')
const configContent = readFileSync(configPath, 'utf-8')

describe('Security Headers Configuration', () => {
  it('sets Content-Security-Policy', () => {
    expect(configContent).toContain("Content-Security-Policy")
    expect(configContent).toContain("default-src 'self'")
    expect(configContent).toContain("frame-ancestors 'none'")
  })

  it('sets Strict-Transport-Security with preload', () => {
    expect(configContent).toContain('Strict-Transport-Security')
    expect(configContent).toContain('max-age=63072000')
    expect(configContent).toContain('includeSubDomains')
    expect(configContent).toContain('preload')
  })

  it('sets X-Frame-Options to DENY', () => {
    expect(configContent).toContain('X-Frame-Options')
    expect(configContent).toContain('DENY')
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    expect(configContent).toContain('X-Content-Type-Options')
    expect(configContent).toContain('nosniff')
  })

  it('sets Referrer-Policy', () => {
    expect(configContent).toContain('Referrer-Policy')
    expect(configContent).toContain('strict-origin-when-cross-origin')
  })

  it('sets restrictive Permissions-Policy', () => {
    expect(configContent).toContain('Permissions-Policy')
    expect(configContent).toContain('camera=()')
    expect(configContent).toContain('microphone=()')
    expect(configContent).toContain('payment=()')
  })

  it('applies security headers to all routes', () => {
    // The headers() function should have a catch-all source pattern
    expect(configContent).toContain("source: '/(.*)'")
  })

  it('CSP connect-src includes required domains', () => {
    expect(configContent).toContain('supabase.co')
    expect(configContent).toContain('api.openai.com')
    expect(configContent).toContain('sentry.io')
  })

  it('embed pages override frame-ancestors for iframe embedding', () => {
    expect(configContent).toContain("source: '/embed/:path*'")
    expect(configContent).toContain('frame-ancestors *')
  })

  it('driver portal enables geolocation', () => {
    expect(configContent).toContain("source: '/driver/:path*'")
    expect(configContent).toContain('geolocation=(self)')
  })
})
