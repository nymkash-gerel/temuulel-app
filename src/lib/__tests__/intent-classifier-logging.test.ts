/**
 * Tests for intent classification confidence logging functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyIntentWithConfidence, logClassification } from '../intent-classifier'

describe('Intent Classification Logging', () => {
  let consoleSpy: any

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('logs classification when options.log is true', () => {
    const result = classifyIntentWithConfidence('Сайн байна уу', { log: true })
    
    expect(result.intent).toBe('greeting')
    expect(result.confidence).toBeGreaterThan(0)
    
    // Verify logging was called
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    
    const logCall = consoleSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logCall)
    
    expect(logEntry).toMatchObject({
      timestamp: expect.any(String),
      message: 'Сайн байна уу',
      intent: 'greeting',
      confidence: expect.any(Number),
      processing_time_ms: expect.any(Number),
    })
    
    expect(logEntry.processing_time_ms).toBeGreaterThanOrEqual(0)
    expect(new Date(logEntry.timestamp).toString()).not.toBe('Invalid Date')
  })

  it('does not log when options.log is false', () => {
    classifyIntentWithConfidence('Сайн байна уу', { log: false })
    
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('does not log when no options are provided', () => {
    classifyIntentWithConfidence('Сайн байна уу')
    
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('truncates long messages to 100 chars', () => {
    const longMessage = 'Сайн байна уу '.repeat(20) // > 100 chars
    
    classifyIntentWithConfidence(longMessage, { log: true })
    
    const logCall = consoleSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logCall)
    
    expect(logEntry.message).toHaveLength(100)
    expect(longMessage.slice(0, 100)).toBe(logEntry.message)
  })

  it('logClassification function works standalone', () => {
    logClassification('test message', 'greeting', 2.5, 42)
    
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    
    const logCall = consoleSpy.mock.calls[0][0]
    const logEntry = JSON.parse(logCall)
    
    expect(logEntry).toMatchObject({
      timestamp: expect.any(String),
      message: 'test message',
      intent: 'greeting',
      confidence: 2.5,
      processing_time_ms: 42,
    })
  })

  it('handles edge cases in logging', () => {
    // Empty message
    logClassification('', 'general', 0, 1)
    
    let logEntry = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(logEntry.message).toBe('')
    
    // Very short message
    logClassification('a', 'general', 0.1, 0)
    
    logEntry = JSON.parse(consoleSpy.mock.calls[1][0])
    expect(logEntry.message).toBe('a')
    expect(logEntry.processing_time_ms).toBe(0)
  })
})