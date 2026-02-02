/**
 * Tests for booking conflict detection (checkConflicts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkConflicts } from './booking-conflict'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a chainable mock that mimics a Supabase PostgREST query builder.
 * When the chain is awaited it resolves to `{ data }`.
 */
function createMockQuery(data: unknown[] | null = []) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'not', 'lt', 'gt']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  // Make the chain thenable so `await query` resolves to { data }
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => resolve({ data }),
    configurable: true,
  })
  return chain
}

/**
 * Build a minimal mock SupabaseClient whose `.from()` delegates
 * to the provided `tableMap`.  Each key is a table name and each value
 * is the query builder that `.from(tableName)` should return.
 *
 * Because `checkConflicts` may call `.from('appointments')` more than once
 * (staff + resource), `tableMap` values can be arrays to return different
 * builders on successive calls.
 */
function createMockSupabase(
  tableMap: Record<string, ReturnType<typeof createMockQuery> | ReturnType<typeof createMockQuery>[]>,
) {
  const callCounts: Record<string, number> = {}

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] || 0) + 1
    const entry = tableMap[table]
    if (Array.isArray(entry)) {
      // Return successive builders on each call
      return entry[callCounts[table] - 1] ?? entry[entry.length - 1]
    }
    return entry ?? createMockQuery(null)
  })

  return { from: mockFrom } as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const STORE_ID = 'store_1'
const STAFF_ID = 'staff_1'
const RESOURCE_ID = 'resource_1'

// 10:00 - 11:00 window
const START = '2026-03-01T10:00:00.000Z'
const END = '2026-03-01T11:00:00.000Z'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // 1. No conflicts when tables return empty arrays
  // -----------------------------------------------------------------------
  it('returns no conflicts when no overlapping records exist', async () => {
    const supabase = createMockSupabase({
      appointments: createMockQuery([]),
      blocks: createMockQuery([]),
      booking_items: createMockQuery([]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(false)
    expect(result.conflicts).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // 2. Detects appointment conflicts for staff
  // -----------------------------------------------------------------------
  it('detects appointment conflicts for staff', async () => {
    const overlappingAppointment = {
      id: 'apt_1',
      scheduled_at: '2026-03-01T10:15:00.000Z',
      duration_minutes: 30, // ends at 10:45 -- overlaps 10:00-11:00
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([overlappingAppointment]),
      blocks: createMockQuery([]),
      booking_items: createMockQuery([]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toMatchObject({
      type: 'appointment',
      id: 'apt_1',
      startAt: '2026-03-01T10:15:00.000Z',
    })
    // Verify computed endAt = scheduled_at + 30 minutes
    const expectedEnd = new Date(
      new Date('2026-03-01T10:15:00.000Z').getTime() + 30 * 60000,
    ).toISOString()
    expect(result.conflicts[0].endAt).toBe(expectedEnd)
  })

  // -----------------------------------------------------------------------
  // 3. Detects block conflicts for staff
  // -----------------------------------------------------------------------
  it('detects block conflicts for staff', async () => {
    const block = {
      id: 'block_1',
      start_at: '2026-03-01T09:30:00.000Z',
      end_at: '2026-03-01T10:30:00.000Z',
      reason: 'Lunch break',
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([]),
      blocks: createMockQuery([block]),
      booking_items: createMockQuery([]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toMatchObject({
      type: 'block',
      id: 'block_1',
      startAt: '2026-03-01T09:30:00.000Z',
      endAt: '2026-03-01T10:30:00.000Z',
      reason: 'Lunch break',
    })
  })

  // -----------------------------------------------------------------------
  // 4. Detects booking_item conflicts for staff
  // -----------------------------------------------------------------------
  it('detects booking_item conflicts for staff', async () => {
    const item = {
      id: 'bi_1',
      start_at: '2026-03-01T10:00:00.000Z',
      end_at: '2026-03-01T10:45:00.000Z',
      appointment_id: 'apt_99',
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([]),
      blocks: createMockQuery([]),
      booking_items: createMockQuery([item]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]).toMatchObject({
      type: 'booking_item',
      id: 'bi_1',
      startAt: '2026-03-01T10:00:00.000Z',
      endAt: '2026-03-01T10:45:00.000Z',
    })
  })

  // -----------------------------------------------------------------------
  // 5. Detects resource conflicts (appointments, blocks, booking_items)
  // -----------------------------------------------------------------------
  it('detects resource conflicts (appointments, blocks, booking_items)', async () => {
    const resourceAppointment = {
      id: 'rapt_1',
      scheduled_at: '2026-03-01T10:00:00.000Z',
      duration_minutes: 60,
    }
    const resourceBlock = {
      id: 'rblk_1',
      start_at: '2026-03-01T10:00:00.000Z',
      end_at: '2026-03-01T10:30:00.000Z',
      reason: null,
    }
    const resourceItem = {
      id: 'rbi_1',
      start_at: '2026-03-01T10:30:00.000Z',
      end_at: '2026-03-01T11:00:00.000Z',
      appointment_id: 'apt_x',
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([resourceAppointment]),
      blocks: createMockQuery([resourceBlock]),
      booking_items: createMockQuery([resourceItem]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      resourceId: RESOURCE_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    expect(result.conflicts).toHaveLength(3)

    const types = result.conflicts.map((c) => c.type)
    expect(types).toContain('appointment')
    expect(types).toContain('block')
    expect(types).toContain('booking_item')

    // Block with null reason should have reason as undefined
    const blockConflict = result.conflicts.find((c) => c.type === 'block')!
    expect(blockConflict.reason).toBeUndefined()
  })

  // -----------------------------------------------------------------------
  // 6. Excludes appointment by ID when excludeAppointmentId provided
  // -----------------------------------------------------------------------
  it('excludes appointment by ID when excludeAppointmentId provided', async () => {
    const neqSpy = vi.fn()

    // Build a custom chain where we can inspect .neq() calls
    function createTrackedQuery(data: unknown[] | null = []) {
      const chain: Record<string, unknown> = {}
      const methods = ['select', 'eq', 'not', 'lt', 'gt']
      for (const method of methods) {
        chain[method] = vi.fn().mockReturnValue(chain)
      }
      chain['neq'] = neqSpy.mockReturnValue(chain)
      Object.defineProperty(chain, 'then', {
        value: (resolve: (v: unknown) => void) => resolve({ data }),
        configurable: true,
      })
      return chain
    }

    const supabase = createMockSupabase({
      appointments: createTrackedQuery([]),
      blocks: createTrackedQuery([]),
      booking_items: createTrackedQuery([]),
    })

    await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
      excludeAppointmentId: 'apt_to_exclude',
    })

    // neq should have been called for appointments (.neq('id', ...))
    // and for booking_items (.neq('appointment_id', ...))
    expect(neqSpy).toHaveBeenCalledWith('id', 'apt_to_exclude')
    expect(neqSpy).toHaveBeenCalledWith('appointment_id', 'apt_to_exclude')
  })

  // -----------------------------------------------------------------------
  // 7. Returns empty when neither staffId nor resourceId provided
  // -----------------------------------------------------------------------
  it('returns empty when neither staffId nor resourceId provided', async () => {
    const supabase = createMockSupabase({})

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(false)
    expect(result.conflicts).toHaveLength(0)
    // from() should never have been called
    expect(supabase.from).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // 8. Correctly handles multiple simultaneous conflicts
  // -----------------------------------------------------------------------
  it('correctly handles multiple simultaneous conflicts', async () => {
    const appointments = [
      { id: 'apt_1', scheduled_at: '2026-03-01T10:00:00.000Z', duration_minutes: 30 },
      { id: 'apt_2', scheduled_at: '2026-03-01T10:30:00.000Z', duration_minutes: 45 },
    ]
    const blocks = [
      {
        id: 'blk_1',
        start_at: '2026-03-01T09:45:00.000Z',
        end_at: '2026-03-01T10:15:00.000Z',
        reason: 'Setup time',
      },
    ]
    const bookingItems = [
      {
        id: 'bi_1',
        start_at: '2026-03-01T10:50:00.000Z',
        end_at: '2026-03-01T11:20:00.000Z',
        appointment_id: 'apt_other',
      },
    ]

    const supabase = createMockSupabase({
      appointments: createMockQuery(appointments),
      blocks: createMockQuery(blocks),
      booking_items: createMockQuery(bookingItems),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    // 2 appointments + 1 block + 1 booking_item = 4 total
    expect(result.conflicts).toHaveLength(4)

    const ids = result.conflicts.map((c) => c.id)
    expect(ids).toContain('apt_1')
    expect(ids).toContain('apt_2')
    expect(ids).toContain('blk_1')
    expect(ids).toContain('bi_1')
  })

  // -----------------------------------------------------------------------
  // Additional edge cases
  // -----------------------------------------------------------------------

  it('defaults duration to 60 minutes when duration_minutes is null', async () => {
    const appointmentNoDuration = {
      id: 'apt_no_dur',
      scheduled_at: '2026-03-01T10:00:00.000Z',
      duration_minutes: null, // should default to 60
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([appointmentNoDuration]),
      blocks: createMockQuery([]),
      booking_items: createMockQuery([]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    // endAt should be scheduled_at + 60 minutes (default)
    const expectedEnd = new Date(
      new Date('2026-03-01T10:00:00.000Z').getTime() + 60 * 60000,
    ).toISOString()
    expect(result.conflicts[0].endAt).toBe(expectedEnd)
  })

  it('filters out appointment that ends before the query window starts', async () => {
    // This appointment ends at 10:00 exactly -- should NOT overlap [10:00, 11:00)
    // because the condition is aptEnd > params.startAt (strictly greater)
    const nonOverlapping = {
      id: 'apt_before',
      scheduled_at: '2026-03-01T09:00:00.000Z',
      duration_minutes: 60, // ends at exactly 10:00
    }

    const supabase = createMockSupabase({
      appointments: createMockQuery([nonOverlapping]),
      blocks: createMockQuery([]),
      booking_items: createMockQuery([]),
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      startAt: START,
      endAt: END,
    })

    // aptEnd = 10:00:00 which is NOT > startAt (10:00:00), so no conflict
    expect(result.hasConflict).toBe(false)
    expect(result.conflicts).toHaveLength(0)
  })

  it('includes conflicts from both staff and resource when both are provided', async () => {
    // When both staffId and resourceId are given, the function queries
    // all three tables twice (once for staff, once for resource).
    // We need each .from() call to return separate query builders.

    const staffAppointment = {
      id: 'staff_apt_1',
      scheduled_at: '2026-03-01T10:00:00.000Z',
      duration_minutes: 30,
    }
    const resourceAppointment = {
      id: 'resource_apt_1',
      scheduled_at: '2026-03-01T10:15:00.000Z',
      duration_minutes: 30,
    }

    const supabase = createMockSupabase({
      // First call = staff appointments, second call = resource appointments
      appointments: [
        createMockQuery([staffAppointment]),
        createMockQuery([resourceAppointment]),
      ],
      // First call = staff blocks, second call = resource blocks
      blocks: [createMockQuery([]), createMockQuery([])],
      // First call = staff booking_items, second call = resource booking_items
      booking_items: [createMockQuery([]), createMockQuery([])],
    })

    const result = await checkConflicts(supabase, {
      storeId: STORE_ID,
      staffId: STAFF_ID,
      resourceId: RESOURCE_ID,
      startAt: START,
      endAt: END,
    })

    expect(result.hasConflict).toBe(true)
    expect(result.conflicts).toHaveLength(2)

    const ids = result.conflicts.map((c) => c.id)
    expect(ids).toContain('staff_apt_1')
    expect(ids).toContain('resource_apt_1')
  })
})
