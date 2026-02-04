/**
 * Tests for PATCH/GET /api/stores/busy-mode
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestJsonRequest, createTestRequest } from '@/lib/test-utils'

let mockUser: { id: string } | null = null
let mockStore: Record<string, unknown> | null = null
let mockUpdatedStore: Record<string, unknown> | null = null
let mockUpdateError: { message: string } | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { PATCH, GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001', busy_mode: false, busy_message: null, estimated_wait_minutes: null }
  mockUpdatedStore = { id: 'store-001', busy_mode: true, busy_message: 'Түр хаалттай', estimated_wait_minutes: 20, updated_at: '2026-01-30T00:00:00Z' }
  mockUpdateError = null

  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockStore }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedStore, error: mockUpdateError }),
            })),
          })),
        })),
      }
    }
    return {}
  })
})

describe('PATCH /api/stores/busy-mode', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', { busy_mode: true }, 'PATCH')
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store found', async () => {
    mockStore = null
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', { busy_mode: true }, 'PATCH')
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 if busy_mode is missing', async () => {
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', {}, 'PATCH')
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('toggles busy mode on with message and wait time', async () => {
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', {
      busy_mode: true,
      busy_message: 'Түр хаалттай',
      estimated_wait_minutes: 20,
    }, 'PATCH')
    const res = await PATCH(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.busy_mode).toBe(true)
    expect(json.busy_message).toBe('Түр хаалттай')
    expect(json.estimated_wait_minutes).toBe(20)
  })

  it('toggles busy mode off', async () => {
    mockUpdatedStore = { id: 'store-001', busy_mode: false, busy_message: null, estimated_wait_minutes: null, updated_at: '2026-01-30T00:00:00Z' }
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', { busy_mode: false }, 'PATCH')
    const res = await PATCH(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.busy_mode).toBe(false)
  })

  it('returns 500 on update error', async () => {
    mockUpdateError = { message: 'DB error' }
    mockUpdatedStore = null
    const req = createTestJsonRequest('http://localhost/api/stores/busy-mode', { busy_mode: true }, 'PATCH')
    const res = await PATCH(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/stores/busy-mode', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns store busy mode status', async () => {
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.busy_mode).toBe(false)
  })
})
