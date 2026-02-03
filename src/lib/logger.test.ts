/**
 * Tests for the structured logger.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logger, createRequestLogger } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('logger.info outputs to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('test message', { key: 'value' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain('test message')
  })

  it('logger.warn outputs to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('warning message')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain('warning message')
  })

  it('logger.error outputs to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('error occurred', new Error('test error'))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain('error occurred')
  })

  it('logger.error handles non-Error objects', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('something failed', 'string error')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('logger.error handles undefined error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('no error object')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('createRequestLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('includes requestId and route in all log levels', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const reqLogger = createRequestLogger('req-123', '/api/test')
    reqLogger.info('request started')
    expect(spy).toHaveBeenCalledTimes(1)
    const output = spy.mock.calls[0][0]
    expect(output).toContain('request started')
    expect(output).toContain('req-123')
    expect(output).toContain('/api/test')
  })

  it('merges additional context with base context', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const reqLogger = createRequestLogger('req-456', '/api/orders')
    reqLogger.warn('slow query', { duration_ms: 500 })
    expect(spy).toHaveBeenCalledTimes(1)
    const output = spy.mock.calls[0][0]
    expect(output).toContain('slow query')
    expect(output).toContain('500')
  })

  it('accepts optional options parameter with userId and storeId', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const reqLogger = createRequestLogger('req-789', '/api/pos/checkout', {
      userId: 'user-001',
      storeId: 'store-001',
    })
    reqLogger.info('checkout started')
    expect(spy).toHaveBeenCalledTimes(1)
    const output = spy.mock.calls[0][0]
    expect(output).toContain('checkout started')
    expect(output).toContain('req-789')
  })
})
