import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for handleFeedChange.
 * Mocks Supabase + global fetch (for Graph API calls).
 */

// Mock fetch globally before any imports
global.fetch = vi.fn()

// Mock Supabase — must return chainable query builder
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { handleFeedChange } from './comment-auto-reply'

// Helper to build chainable query mock
function mockQuery(result: unknown) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve({ data: result, error: null }),
    limit: () => chain,
    insert: () => chain,
    update: () => chain,
    order: () => chain,
  }
  return chain
}

describe('handleFeedChange — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('skips non-comment events (reactions, posts)', async () => {
    await handleFeedChange('page-123', {
      item: 'reaction',
      verb: 'add',
      from: { id: 'user-1' },
    })
    // mockFrom should not even be called since we return early
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('skips comment edit events', async () => {
    await handleFeedChange('page-123', {
      item: 'comment',
      verb: 'edit',
      from: { id: 'user-1' },
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('skips replies to comments (parent_id set)', async () => {
    await handleFeedChange('page-123', {
      item: 'comment',
      verb: 'add',
      comment_id: 'c-1',
      post_id: 'p-1',
      parent_id: 'c-0', // reply to another comment
      from: { id: 'user-1' },
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('skips when comment_id is missing', async () => {
    await handleFeedChange('page-123', {
      item: 'comment',
      verb: 'add',
      post_id: 'p-1',
      from: { id: 'user-1' },
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('skips when store not found for pageId', async () => {
    mockFrom.mockImplementation(() => mockQuery(null))

    await handleFeedChange('unknown-page', {
      item: 'comment',
      verb: 'add',
      comment_id: 'c-1',
      post_id: 'p-1',
      from: { id: 'user-1' },
      message: 'Үнэ хэд вэ?',
    })

    // Should lookup store but find nothing
    expect(mockFrom).toHaveBeenCalledWith('stores')
  })

  it('uses facebook_page_id for messenger platform', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') return mockQuery(null)
      return mockQuery([])
    })

    await handleFeedChange('fb-page-1', {
      item: 'comment', verb: 'add',
      comment_id: 'c-1', post_id: 'p-1',
      from: { id: 'user-1' }, message: 'test',
    }, 'facebook')

    expect(mockFrom).toHaveBeenCalledWith('stores')
  })

  it('uses instagram_business_account_id for instagram platform', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') return mockQuery(null)
      return mockQuery([])
    })

    await handleFeedChange('ig-biz-1', {
      item: 'comment', verb: 'add',
      comment_id: 'c-1', post_id: 'p-1',
      from: { id: 'user-1' }, message: 'test',
    }, 'instagram')

    expect(mockFrom).toHaveBeenCalledWith('stores')
  })
})
