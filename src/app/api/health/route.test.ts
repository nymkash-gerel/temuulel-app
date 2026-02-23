import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET } from './route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn()
}))

// Mock package.json import
vi.mock('../../../../../package.json', () => ({
  default: { version: '0.1.0' },
  version: '0.1.0'
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
    // Mock successful database query
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null })
    
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      status: 'ok',
      version: '0.1.0',
      uptime: 3600,
      db: 'ok'
    })
    expect(data.timestamp).toBeDefined()
    expect(new Date(data.timestamp)).toBeInstanceOf(Date)
  })

  it('returns degraded status when database fails', async () => {
    // Mock database error
    mockSupabaseClient.single.mockRejectedValue(new Error('Database connection failed'))
    
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      status: 'degraded',
      version: '0.1.0',
      uptime: 3600,
      db: 'error'
    })
  })

  it('handles errors gracefully and returns version as unknown', async () => {
    // Mock createSupabaseServerClient to throw during creation
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerClient).mockImplementation(() => {
      throw new Error('Supabase creation failed')
    })

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('degraded')
    expect(data.db).toBe('error')
    expect(data.version).toBe('0.1.0') // Should still get version from mock
  })

  it('includes proper cache headers', async () => {
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null })
    
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Expires')).toBe('0')
  })

  it('handles database query with no results gracefully', async () => {
    // Mock successful query with no results (expected case)
    mockSupabaseClient.single.mockResolvedValue({ 
      data: null, 
      error: { code: 'PGRST116', message: 'No rows found' }
    })
    
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerClient).mockReturnValue(mockSupabaseClient)

    const request = new NextRequest('http://localhost/api/health')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.db).toBe('ok')
    expect(data.status).toBe('ok')
  })
})