import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env-check', () => {
  let originalEnv: NodeJS.ProcessEnv
  let originalConsoleWarn: any
  let originalConsoleError: any
  let mockWarn: any
  let mockError: any

  beforeEach(() => {
    // Store original environment and console methods
    originalEnv = process.env
    originalConsoleWarn = console.warn
    originalConsoleError = console.error
    
    // Mock console methods
    mockWarn = vi.fn()
    mockError = vi.fn()
    console.warn = mockWarn
    console.error = mockError

    // Clear module cache to allow re-importing
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original environment and console
    process.env = originalEnv
    console.warn = originalConsoleWarn
    console.error = originalConsoleError
  })

  it('validates all required environment variables are present', async () => {
    // Set all required env vars
    process.env = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    }

    const { validateEnv, isProduction } = await import('./env-check')
    
    const result = validateEnv()
    
    expect(result.valid).toBe(true)
    expect(result.missingRequired).toEqual([])
    expect(isProduction).toBe(false)
    expect(mockError).not.toHaveBeenCalled()
  })

  it('warns about missing required vars in development', async () => {
    // Set incomplete environment - explicitly clear the missing vars
    process.env = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
      // Explicitly missing: NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
    }

    const { validateEnv } = await import('./env-check')
    
    const result = validateEnv()
    
    expect(result.valid).toBe(false)
    expect(result.missingRequired).toEqual([
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ])
    expect(mockWarn).toHaveBeenCalledWith(
      'Missing required environment variables: NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
    )
    expect(mockError).not.toHaveBeenCalled()
  })

  it('throws in production when required vars are missing', async () => {
    // Set incomplete environment in production
    process.env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
      // Missing required keys
    }

    // Import should throw due to auto-validation
    await expect(async () => {
      await import('./env-check')
    }).rejects.toThrow('Missing required environment variables')
  })

  it('warns about missing optional vars', async () => {
    // Set required but not optional vars
    process.env = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
      // Missing all optional vars
    }

    const { validateEnv } = await import('./env-check')
    
    const result = validateEnv()
    
    expect(result.valid).toBe(true)
    expect(result.missingOptional).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'OPENAI_API_KEY',
      'SENTRY_DSN'
    ])
    expect(mockWarn).toHaveBeenCalledWith(
      'Missing optional environment variables: UPSTASH_REDIS_REST_URL, OPENAI_API_KEY, SENTRY_DSN'
    )
  })

  it('correctly identifies production environment', async () => {
    process.env = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://prod.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-key'
    }

    const { isProduction } = await import('./env-check')
    
    expect(isProduction).toBe(true)
  })

  it('handles partial optional variables correctly', async () => {
    process.env = {
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      OPENAI_API_KEY: 'test-openai-key'
      // Missing UPSTASH_REDIS_REST_URL and SENTRY_DSN
    }

    const { validateEnv } = await import('./env-check')
    
    const result = validateEnv()
    
    expect(result.valid).toBe(true)
    expect(result.missingOptional).toEqual([
      'UPSTASH_REDIS_REST_URL',
      'SENTRY_DSN'
    ])
  })
})