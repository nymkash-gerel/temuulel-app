import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

// Mock Telegram
const mockSendInlineKeyboard = vi.fn().mockResolvedValue({ ok: true })
const mockSendMessage = vi.fn().mockResolvedValue({ ok: true })

vi.mock('./telegram', () => ({
  sendTelegramInlineKeyboard: (...args: unknown[]) => mockSendInlineKeyboard(...args),
  sendTelegramMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

// Mock Messenger
vi.mock('./messenger', () => ({
  sendTextMessage: vi.fn().mockResolvedValue(undefined),
}))

// Mock Email
const mockSendEmail = vi.fn().mockResolvedValue(true)
vi.mock('./email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

// Set env
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token')

import { notifyStaff, type StaffNotificationPayload } from './staff-notify'

const basePayload: StaffNotificationPayload = {
  appointmentId: 'apt-123',
  customerName: 'Батбаяр',
  serviceName: 'Үс засалт',
  scheduledAt: '2025-02-15T14:00:00Z',
  eventType: 'appointment_created',
}

describe('staff-notify', () => {
  beforeEach(() => {
    mockSendInlineKeyboard.mockClear()
    mockSendMessage.mockClear()
    mockSendEmail.mockClear()
    mockFrom.mockClear()
    mockSelect.mockClear()
    mockEq.mockClear()
    mockSingle.mockClear()
  })

  it('sends Telegram notification with inline buttons for new appointments', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-1',
        name: 'Ажилтан',
        telegram_chat_id: '12345',
        messenger_psid: null,
        email: null,
      },
      error: null,
    })

    const result = await notifyStaff('staff-1', basePayload)

    expect(result).toBe('telegram')
    expect(mockSendInlineKeyboard).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Шинэ захиалга'),
      expect.arrayContaining([
        expect.objectContaining({ callback_data: 'confirm_appointment:apt-123' }),
        expect.objectContaining({ callback_data: 'reject_appointment:apt-123' }),
      ])
    )
  })

  it('sends plain Telegram message for confirmed/cancelled events', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-1',
        name: 'Ажилтан',
        telegram_chat_id: '12345',
        messenger_psid: null,
        email: null,
      },
      error: null,
    })

    const result = await notifyStaff('staff-1', {
      ...basePayload,
      eventType: 'appointment_confirmed',
    })

    expect(result).toBe('telegram')
    expect(mockSendMessage).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Захиалга баталгаажсан')
    )
  })

  it('falls back to email when no telegram or messenger', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-2',
        name: 'Ажилтан 2',
        telegram_chat_id: null,
        messenger_psid: null,
        email: 'test@example.com',
      },
      error: null,
    })

    const result = await notifyStaff('staff-2', basePayload)
    expect(result).toBe('email')
    expect(mockSendEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('Шинэ захиалга'),
      expect.stringContaining('Батбаяр')
    )
  })

  it('returns none when email send fails', async () => {
    mockSendEmail.mockResolvedValueOnce(false)
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-2',
        name: 'Ажилтан 2',
        telegram_chat_id: null,
        messenger_psid: null,
        email: 'test@example.com',
      },
      error: null,
    })

    const result = await notifyStaff('staff-2', basePayload)
    expect(result).toBe('none')
  })

  it('returns none when staff has no channels', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-3',
        name: 'Ажилтан 3',
        telegram_chat_id: null,
        messenger_psid: null,
        email: null,
      },
      error: null,
    })

    const result = await notifyStaff('staff-3', basePayload)
    expect(result).toBe('none')
  })

  it('returns none when staff not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })

    const result = await notifyStaff('nonexistent', basePayload)
    expect(result).toBe('none')
  })

  it('includes resource name in message when provided', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 'staff-1',
        name: 'Ажилтан',
        telegram_chat_id: '12345',
        messenger_psid: null,
        email: null,
      },
      error: null,
    })

    await notifyStaff('staff-1', {
      ...basePayload,
      resourceName: 'Ширээ 4',
    })

    expect(mockSendInlineKeyboard).toHaveBeenCalledWith(
      '12345',
      expect.stringContaining('Ширээ 4'),
      expect.anything()
    )
  })
})
