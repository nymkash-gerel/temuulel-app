import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}))

// Mock env-check to prevent auto-validation
vi.mock('@/lib/env-check', () => ({
  validateEnv: vi.fn(),
  isProduction: false
}))

describe('GET /api/health', () => {
  let mockSupabaseClient: any
  let originalProcessUptime: () => number

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock process.uptime
    originalProcessUptime = process.uptime
    process.uptime = vi.fn().mockReturnValue(3600) // 1 hour
    
    // Create mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn()
    }
  })
  
  afterEach(() => {
    process.uptime = originalProcessUptime
  })

  it('returns basic health information', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null })
    
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      status: 'ok',
      uptime: 3600,
      db: 'ok'
    })
    expect(data.timestamp).toBeDefined()
    expect(new Date(data.timestamp)).toBeInstanceOf(Date)
  })

  it('returns degraded status when database fails', async () => {
    mockSupabaseClient.single.mockRejectedValue(new Error('Database connection failed'))
    
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      status: 'degraded',
      uptime: 3600,
      db: 'error'
    })
  })

  it('handles errors gracefully', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockRejectedValue(new Error('Supabase creation failed'))

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.db).toBe('error')
  })

  it('includes proper cache headers', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null })
    
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })

  it('handles database query with no results gracefully', async () => {
    mockSupabaseClient.single.mockResolvedValue({ 
      data: null, 
      error: { code: 'PGRST116', message: 'No rows found' }
    })
    
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.db).toBe('ok')
    expect(data.status).toBe('ok')
  })
})
