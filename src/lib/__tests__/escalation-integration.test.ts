/**
 * Integration tests for processEscalation function.
 * Tests the complete escalation flow with mocked Supabase and AI dependencies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatbotSettings } from '../chat-ai'
import { processEscalation } from '../escalation'

// Mock the notification module
vi.mock('../notifications', () => ({
  dispatchNotification: vi.fn(),
}))

// Mock the AI modules
vi.mock('../ai/complaint-summarizer', () => ({
  summarizeComplaint: vi.fn(),
}))

vi.mock('../ai/complaint-classifier', () => ({
  classifyComplaint: vi.fn(),
}))

describe('processEscalation', () => {
  let chatbotSettings: ChatbotSettings

  beforeEach(() => {
    vi.clearAllMocks()

    chatbotSettings = {
      escalation_enabled: true,
      escalation_threshold: 60,
      escalation_message: 'Манай менежер тантай холбогдоно.',
    } as ChatbotSettings
  })

  it('returns early when escalation is disabled in settings', async () => {
    chatbotSettings.escalation_enabled = false

    // Don't need a mock since it should return early
    const mockSupabase = {} as any

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'test message',
      'store-1',
      chatbotSettings
    )

    expect(result).toEqual({
      escalated: false,
      level: 'low',
    })
  })

  it('handles basic escalation flow: low score → evaluates → updates conversation', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 10, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] })
                })
              })
            })
          }
        }
        return {}
      })
    } as any

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'regular message',
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(false)
    expect(result.level).toBe('low')

    // Verify database calls
    expect(mockSupabase.from).toHaveBeenCalledWith('conversations')
    expect(mockSupabase.from).toHaveBeenCalledWith('messages')
  })

  it('triggers escalation when high score is reached', async () => {
    const { dispatchNotification } = await import('../notifications')

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 50, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ content: 'previous message', is_from_customer: true, is_ai_response: false }]
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ data: null })
          }
        }
        return {}
      })
    } as any

    // Use a complaint message that will trigger high score
    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'гомдол байна уурласан байна', // Contains complaint + frustration keywords
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(true)
    expect(result.level).toBe('critical') // Should be critical level (score ~95)
    expect(result.escalationMessage).toBe('Манай менежер тантай холбогдоно.')

    // Verify notification was dispatched
    expect(dispatchNotification).toHaveBeenCalledWith(
      'store-1',
      'escalation',
      expect.objectContaining({
        conversation_id: 'conv-1',
        level: 'critical',
        score: expect.any(Number),
        signals: expect.any(String),
      })
    )
  })

  it('creates compensation voucher when policy exists', async () => {
    const { classifyComplaint } = await import('../ai/complaint-classifier')
    const { dispatchNotification } = await import('../notifications')

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 50, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ content: 'previous message', is_from_customer: true, is_ai_response: false }]
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ data: null })
          }
        } else if (table === 'compensation_policies') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: 'policy-1',
                        compensation_type: 'percent_discount',
                        compensation_value: 20,
                        max_discount_amount: 50000,
                        valid_days: 30,
                        auto_approve: true,
                      }
                    })
                  })
                })
              })
            })
          }
        } else if (table === 'vouchers') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'voucher-1', voucher_code: 'COMP-12345' }
                })
              })
            })
          }
        }
        return {}
      })
    } as any

    // Mock AI classifier
    vi.mocked(classifyComplaint).mockResolvedValue({
      category: 'food_quality',
      confidence: 0.8,
      suggested_response: 'Sorry about the food quality issue',
    })

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'хоолны чанар муу гомдол байна',
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(true)

    // Verify AI classifier was called
    expect(classifyComplaint).toHaveBeenCalledWith({
      complaint_text: expect.stringContaining('хоолны чанар муу гомдол байна'),
    })

    // Verify compensation notification was dispatched
    expect(dispatchNotification).toHaveBeenCalledWith(
      'store-1',
      'compensation_suggested',
      expect.objectContaining({
        voucher_id: 'voucher-1',
        voucher_code: 'COMP-12345',
        compensation_label: '20% хөнгөлөлт',
        complaint_category_label: 'Хоолны чанар',
        auto_approved: true,
      })
    )
  })

  it('handles AI failures gracefully', async () => {
    const { summarizeComplaint } = await import('../ai/complaint-summarizer')
    const { classifyComplaint } = await import('../ai/complaint-classifier')

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 50, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ data: null })
          }
        }
        return {}
      })
    } as any

    // Mock AI failures
    vi.mocked(summarizeComplaint).mockRejectedValue(new Error('AI service down'))
    vi.mocked(classifyComplaint).mockRejectedValue(new Error('AI service down'))

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'гомдол байна муу байна уурласан',
      'store-1',
      chatbotSettings
    )

    // Should still escalate despite AI failures
    expect(result.escalated).toBe(true)
    expect(result.level).toBe('critical')
  })

  it('handles database errors gracefully', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation(() => {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
            })
          })
        }
      })
    } as any

    await expect(
      processEscalation(
        mockSupabase,
        'conv-1',
        'test message',
        'store-1',
        chatbotSettings
      )
    ).rejects.toThrow('Database connection failed')
  })

  it('uses default escalation message when not configured', async () => {
    // Remove custom escalation message
    delete (chatbotSettings as any).escalation_message

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 50, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ data: null })
          }
        }
        return {}
      })
    } as any

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'гомдол байна уурласан',
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(true)
    expect(result.escalationMessage).toBe(
      'Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно. Түр хүлээнэ үү!'
    )
  })

  it('handles missing customer_id gracefully', async () => {
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 50, customer_id: null }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ data: null })
          }
        }
        return {}
      })
    } as any

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'гомдол байна уурласан',
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(true)
    expect(result.level).toBe('critical')
    // Should not attempt compensation without customer_id
    // (compensation logic is wrapped in if (conv?.customer_id) check)
  })

  it('works with different escalation thresholds', async () => {
    // Set very high threshold
    chatbotSettings.escalation_threshold = 90

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'conversations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { escalation_score: 60, customer_id: 'cust-1' }
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null })
            })
          }
        } else if (table === 'messages') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [] })
                })
              })
            })
          }
        }
        return {}
      })
    } as any

    const result = await processEscalation(
      mockSupabase,
      'conv-1',
      'гомдол байна', // Should add ~25 points, total ~85, below threshold
      'store-1',
      chatbotSettings
    )

    expect(result.escalated).toBe(false) // Below 90 threshold
    expect(result.level).toBe('critical') // But level is still critical
  })
})