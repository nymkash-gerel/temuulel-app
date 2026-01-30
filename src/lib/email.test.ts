import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Resend module before importing
const mockSend = vi.fn()
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: mockSend }
    },
  }
})

import { sendEmail, sendOrderEmail, sendMessageEmail, sendLowStockEmail, sendTeamInviteEmail } from './email'

describe('email module', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('NOTIFICATION_FROM_EMAIL', 'test@temuulel.com')
    mockSend.mockReset()
  })

  describe('sendEmail', () => {
    it('returns true on successful send', async () => {
      mockSend.mockResolvedValue({ data: { id: '123' }, error: null })
      const result = await sendEmail('user@test.com', 'Test', '<p>Hello</p>')
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          subject: 'Test',
          html: '<p>Hello</p>',
        })
      )
    })

    it('returns false when Resend returns an error', async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: 'fail' } })
      const result = await sendEmail('user@test.com', 'Test', '<p>Hello</p>')
      expect(result).toBe(false)
    })

    it('returns false when send throws', async () => {
      mockSend.mockRejectedValue(new Error('network error'))
      const result = await sendEmail('user@test.com', 'Test', '<p>Hello</p>')
      expect(result).toBe(false)
    })

    it('returns false when RESEND_API_KEY is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', '')
      const result = await sendEmail('user@test.com', 'Test', '<p>Hello</p>')
      expect(result).toBe(false)
    })
  })

  describe('sendOrderEmail', () => {
    it('formats order email correctly', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })

      const result = await sendOrderEmail('shop@test.com', {
        order_number: 'ORD-001',
        total_amount: 50000,
        payment_method: 'qpay',
      })

      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'shop@test.com',
          subject: expect.stringContaining('ORD-001'),
        })
      )
    })

    it('handles bank payment method label', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })
      await sendOrderEmail('test@test.com', {
        order_number: 'ORD-002',
        total_amount: 10000,
        payment_method: 'bank',
      })
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Банк шилжүүлэг'),
        })
      )
    })

    it('handles cash payment method label', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })
      await sendOrderEmail('test@test.com', {
        order_number: 'ORD-003',
        total_amount: 10000,
        payment_method: 'cash',
      })
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Бэлэн мөнгө'),
        })
      )
    })

    it('handles null payment method', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })
      await sendOrderEmail('test@test.com', {
        order_number: 'ORD-004',
        total_amount: 10000,
        payment_method: null,
      })
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Тодорхойгүй'),
        })
      )
    })
  })

  describe('sendMessageEmail', () => {
    it('sends message notification email', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })

      const result = await sendMessageEmail('owner@test.com', 'Бат', 'Сайн байна уу')
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@test.com',
          subject: expect.stringContaining('Бат'),
          html: expect.stringContaining('Сайн байна уу'),
        })
      )
    })

    it('truncates long messages', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })
      const longMessage = 'А'.repeat(300)

      await sendMessageEmail('owner@test.com', 'Test', longMessage)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('...'),
        })
      )
    })
  })

  describe('sendLowStockEmail', () => {
    it('sends low stock warning', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })

      const result = await sendLowStockEmail('owner@test.com', 'Цамц', 3)
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Цамц'),
          html: expect.stringContaining('3 ширхэг'),
        })
      )
    })
  })

  describe('sendTeamInviteEmail', () => {
    it('sends team invite with admin role', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })

      const result = await sendTeamInviteEmail('new@test.com', 'Миний дэлгүүр', 'admin', 'Бат')
      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@test.com',
          subject: expect.stringContaining('Миний дэлгүүр'),
          html: expect.stringContaining('Админ'),
        })
      )
    })

    it('sends team invite with staff role', async () => {
      mockSend.mockResolvedValue({ data: { id: '1' }, error: null })

      await sendTeamInviteEmail('new@test.com', 'Shop', 'staff', 'Сараа')
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Ажилтан'),
        })
      )
    })
  })
})
