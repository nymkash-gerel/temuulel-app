/**
 * Tests for GET /api/availability
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockStoreHours: { open_time: string; close_time: string; is_closed: boolean } | null = null
let mockClosure: { id: string } | null = null

const mockCheckConflicts = vi.fn()

vi.mock('@/lib/booking-conflict', () => ({
  checkConflicts: (...args: unknown[]) => mockCheckConflicts(...args),
}))

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { GET } from './route'

function makeRequest(url: string): Request {
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockStoreHours = { open_time: '09:00', close_time: '18:00', is_closed: false }
  mockClosure = null

  mockCheckConflicts.mockResolvedValue({ hasConflict: false, conflicts: [] })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockStore }),
          })),
        })),
      }
    }
    if (table === 'store_hours') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockStoreHours }),
        })),
      }
    }
    if (table === 'store_closures') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockClosure }),
        })),
      }
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    }
  })
})

describe('GET /api/availability', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store not found', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns 400 when neither staff_id nor resource_id provided', async () => {
    const res = await GET(makeRequest('http://localhost/api/availability?date=2026-03-15') as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('staff_id or resource_id is required')
  })

  it('returns 400 when date is missing', async () => {
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1') as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid date (YYYY-MM-DD) is required')
  })

  it('returns 400 when date is invalid format', async () => {
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=15-03-2026') as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Valid date (YYYY-MM-DD) is required')
  })

  it('returns empty slots when store is closed (is_closed=true)', async () => {
    mockStoreHours = { open_time: '09:00', close_time: '18:00', is_closed: true }
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots).toEqual([])
    expect(json.message).toBe('Store is closed on this day')
  })

  it('returns empty slots when store has closure on that date', async () => {
    mockClosure = { id: 'closure-001' }
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots).toEqual([])
    expect(json.message).toBe('Store is closed on this date')
  })

  it('returns available slots when no conflicts exist', async () => {
    // 09:00 to 18:00 with 30-min default duration, 30-min step = 18 slots
    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.date).toBe('2026-03-15')
    expect(json.staff_id).toBe('s1')
    expect(json.duration_minutes).toBe(30)
    expect(json.open_time).toBe('09:00')
    expect(json.close_time).toBe('18:00')
    expect(json.slots.length).toBe(18)
    expect(json.slots.every((s: { available: boolean }) => s.available === true)).toBe(true)
    // Verify each slot has start and end
    for (const slot of json.slots) {
      expect(slot.start).toBeDefined()
      expect(slot.end).toBeDefined()
      expect(slot.available).toBe(true)
    }
    expect(mockCheckConflicts).toHaveBeenCalledTimes(18)
  })

  it('marks slots as unavailable when conflicts detected', async () => {
    // Make the first call return a conflict, rest return no conflict
    mockCheckConflicts
      .mockResolvedValueOnce({
        hasConflict: true,
        conflicts: [{ type: 'appointment', id: 'apt-1', startAt: '2026-03-15T09:00:00.000Z', endAt: '2026-03-15T09:30:00.000Z' }],
      })
      .mockResolvedValue({ hasConflict: false, conflicts: [] })

    const res = await GET(makeRequest('http://localhost/api/availability?staff_id=s1&date=2026-03-15') as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.slots.length).toBe(18)
    // First slot should be unavailable
    expect(json.slots[0].available).toBe(false)
    // Remaining slots should be available
    for (let i = 1; i < json.slots.length; i++) {
      expect(json.slots[i].available).toBe(true)
    }
  })
})
