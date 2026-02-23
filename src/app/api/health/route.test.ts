import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('returns healthy when database is reachable', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      })
    } as any)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.checks.app.status).toBe('ok')
    expect(data.checks.database.status).toBe('ok')
    expect(data.timestamp).toBeDefined()
  })

  it('returns degraded when database fails', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Connection failed'))
        })
      })
    } as any)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('degraded')
    expect(data.checks.database.status).toBe('error')
  })

  it('includes service availability checks', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      })
    } as any)

    const response = await GET()
    const data = await response.json()

    expect(data.services).toBeDefined()
    expect(typeof data.services.facebook).toBe('boolean')
    expect(typeof data.services.openai).toBe('boolean')
  })

  it('includes cache-control headers', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      })
    } as any)

    const response = await GET()
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate')
  })
})
