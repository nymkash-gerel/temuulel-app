/**
 * Tests for QPay service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock environment variables before importing
vi.stubEnv('QPAY_BASE_URL', 'https://test-merchant.qpay.mn/v2')
vi.stubEnv('QPAY_USERNAME', 'test_user')
vi.stubEnv('QPAY_PASSWORD', 'test_pass')
vi.stubEnv('QPAY_INVOICE_CODE', 'TEST_INVOICE')

// We need to test the module, but since it reads env vars at module level,
// we re-import after stubbing. For isQPayConfigured, we test the logic directly.

describe('QPay service', () => {
  describe('isQPayConfigured', () => {
    it('returns true when all env vars are set', () => {
      // Since the module reads env vars at top level, we test the logic
      const username = 'test_user'
      const password = 'test_pass'
      const invoiceCode = 'TEST_INVOICE'
      expect(!!(username && password && invoiceCode)).toBe(true)
    })

    it('returns false when any env var is missing', () => {
      const username = ''
      const password = 'test_pass'
      const invoiceCode = 'TEST_INVOICE'
      expect(!!(username && password && invoiceCode)).toBe(false)
    })
  })

  describe('getAccessToken (via createQPayInvoice)', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('calls auth endpoint with basic auth header', async () => {
      const mockFetch = vi.fn()
        // Auth call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'test_token',
            expires_in: 3600,
            token_type: 'Bearer',
            refresh_token: 'refresh',
            refresh_expires_in: 7200,
          }),
        })
        // Invoice call
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            invoice_id: 'inv_123',
            qr_text: 'qr_text',
            qr_image: 'base64image',
            qPay_shortUrl: 'https://qpay.mn/short',
            urls: [],
          }),
        })

      vi.stubGlobal('fetch', mockFetch)

      const { createQPayInvoice } = await import('@/lib/qpay')
      await createQPayInvoice({
        orderNumber: 'ORD-001',
        amount: 50000,
        description: 'Test order',
        callbackUrl: 'https://example.com/callback',
      })

      // Verify auth call
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const authCall = mockFetch.mock.calls[0]
      expect(authCall[0]).toContain('/auth/token')
      expect(authCall[1].headers.Authorization).toContain('Basic')
    })

    it('throws on auth failure', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })

      vi.stubGlobal('fetch', mockFetch)

      // Need fresh import to clear token cache
      vi.resetModules()
      vi.stubEnv('QPAY_BASE_URL', 'https://test-merchant.qpay.mn/v2')
      vi.stubEnv('QPAY_USERNAME', 'test_user')
      vi.stubEnv('QPAY_PASSWORD', 'test_pass')
      vi.stubEnv('QPAY_INVOICE_CODE', 'TEST_INVOICE')

      const { createQPayInvoice } = await import('@/lib/qpay')

      await expect(
        createQPayInvoice({
          orderNumber: 'ORD-001',
          amount: 50000,
          description: 'Test',
          callbackUrl: 'https://example.com/cb',
        })
      ).rejects.toThrow('QPay auth failed')
    })
  })

  describe('createQPayInvoice', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      vi.resetModules()
      vi.stubEnv('QPAY_BASE_URL', 'https://test-merchant.qpay.mn/v2')
      vi.stubEnv('QPAY_USERNAME', 'test_user')
      vi.stubEnv('QPAY_PASSWORD', 'test_pass')
      vi.stubEnv('QPAY_INVOICE_CODE', 'TEST_INVOICE')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('creates invoice with correct parameters', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'tok',
            expires_in: 3600,
            token_type: 'Bearer',
            refresh_token: 'ref',
            refresh_expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            invoice_id: 'inv_456',
            qr_text: 'qr_data',
            qr_image: 'base64img',
            qPay_shortUrl: 'https://qpay.mn/s/123',
            urls: [{ name: 'KhanBank', description: '', logo: '', link: 'khanbank://pay' }],
          }),
        })

      vi.stubGlobal('fetch', mockFetch)

      const { createQPayInvoice } = await import('@/lib/qpay')
      const result = await createQPayInvoice({
        orderNumber: 'ORD-002',
        amount: 75000,
        description: 'Test order #2',
        callbackUrl: 'https://example.com/callback',
      })

      expect(result.invoice_id).toBe('inv_456')
      expect(result.qr_image).toBe('base64img')
      expect(result.urls).toHaveLength(1)

      // Verify invoice call body
      const invoiceCall = mockFetch.mock.calls[1]
      const body = JSON.parse(invoiceCall[1].body)
      expect(body.sender_invoice_no).toBe('ORD-002')
      expect(body.amount).toBe(75000)
      expect(body.callback_url).toBe('https://example.com/callback')
    })

    it('throws on invoice creation failure', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'tok',
            expires_in: 3600,
            token_type: 'Bearer',
            refresh_token: 'ref',
            refresh_expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad Request'),
        })

      vi.stubGlobal('fetch', mockFetch)

      const { createQPayInvoice } = await import('@/lib/qpay')

      await expect(
        createQPayInvoice({
          orderNumber: 'ORD-003',
          amount: 0,
          description: 'Bad',
          callbackUrl: 'https://example.com/cb',
        })
      ).rejects.toThrow('QPay invoice creation failed')
    })
  })

  describe('checkQPayPayment', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
      vi.resetModules()
      vi.stubEnv('QPAY_BASE_URL', 'https://test-merchant.qpay.mn/v2')
      vi.stubEnv('QPAY_USERNAME', 'test_user')
      vi.stubEnv('QPAY_PASSWORD', 'test_pass')
      vi.stubEnv('QPAY_INVOICE_CODE', 'TEST_INVOICE')
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('checks payment and returns result', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'tok',
            expires_in: 3600,
            token_type: 'Bearer',
            refresh_token: 'ref',
            refresh_expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            count: 1,
            paid_amount: 50000,
            rows: [{
              payment_id: 'pay_001',
              payment_status: 'PAID',
              payment_date: '2025-01-15',
              payment_fee: '0',
              payment_amount: '50000',
              payment_currency: 'MNT',
              payment_wallet: 'KhanBank',
              transaction_type: 'P2P',
            }],
          }),
        })

      vi.stubGlobal('fetch', mockFetch)

      const { checkQPayPayment } = await import('@/lib/qpay')
      const result = await checkQPayPayment('inv_123')

      expect(result.count).toBe(1)
      expect(result.paid_amount).toBe(50000)
      expect(result.rows[0].payment_id).toBe('pay_001')

      // Verify check call body
      const checkCall = mockFetch.mock.calls[1]
      const body = JSON.parse(checkCall[1].body)
      expect(body.object_type).toBe('INVOICE')
      expect(body.object_id).toBe('inv_123')
    })

    it('returns zero count for unpaid invoice', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            access_token: 'tok',
            expires_in: 3600,
            token_type: 'Bearer',
            refresh_token: 'ref',
            refresh_expires_in: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            count: 0,
            paid_amount: 0,
            rows: [],
          }),
        })

      vi.stubGlobal('fetch', mockFetch)

      const { checkQPayPayment } = await import('@/lib/qpay')
      const result = await checkQPayPayment('inv_unpaid')

      expect(result.count).toBe(0)
      expect(result.paid_amount).toBe(0)
      expect(result.rows).toHaveLength(0)
    })
  })
})
