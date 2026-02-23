import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withCircuitBreaker, CircuitOpenError, _internal } from './circuit-breaker'

describe('Circuit Breaker', () => {
  let mockFn: vi.MockedFunction<() => Promise<string>>
  
  beforeEach(() => {
    mockFn = vi.fn()
    _internal.circuitBreaker.reset()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles normal flow successfully', async () => {
    // Arrange
    mockFn.mockResolvedValue('success')
    
    // Act
    const result = await withCircuitBreaker(mockFn)
    
    // Assert
    expect(result).toBe('success')
    expect(_internal.circuitBreaker.getState()).toBe('closed')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(0)
  })

  it('opens circuit after failure threshold', async () => {
    // Arrange - Mock function that always fails
    const error = new Error('API failure')
    mockFn.mockRejectedValue(error)
    
    // Act - Trigger 3 failures
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('API failure')
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('API failure')
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('API failure')
    
    // Assert - Circuit should now be open
    expect(_internal.circuitBreaker.getState()).toBe('open')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(3)
    
    // Next call should throw CircuitOpenError
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow(CircuitOpenError)
  })

  it('resets after timeout and moves to half-open', async () => {
    // Arrange - Open the circuit first
    const error = new Error('API failure')
    mockFn.mockRejectedValue(error)
    
    // Trigger failures to open circuit
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    
    expect(_internal.circuitBreaker.getState()).toBe('open')
    
    // Mock time passing (30+ seconds)
    vi.useFakeTimers()
    vi.advanceTimersByTime(31000)
    
    // Act - Try again after timeout (should move to half-open)
    mockFn.mockResolvedValue('success')
    const result = await withCircuitBreaker(mockFn)
    
    // Assert
    expect(result).toBe('success')
    expect(_internal.circuitBreaker.getState()).toBe('closed')
    
    vi.useRealTimers()
  })

  it('closes circuit when half-open call succeeds', async () => {
    // Arrange - Get circuit to open state
    const error = new Error('API failure')
    mockFn.mockRejectedValue(error)
    
    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    }
    
    expect(_internal.circuitBreaker.getState()).toBe('open')
    
    // Simulate timeout passing
    vi.useFakeTimers()
    vi.advanceTimersByTime(31000)
    
    // Act - Successful call in half-open state
    mockFn.mockResolvedValue('recovery')
    const result = await withCircuitBreaker(mockFn)
    
    // Assert - Should close the circuit
    expect(result).toBe('recovery')
    expect(_internal.circuitBreaker.getState()).toBe('closed')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(0)
    
    vi.useRealTimers()
  })

  it('reopens circuit when half-open call fails', async () => {
    // Arrange - Get circuit to open state  
    const error = new Error('API failure')
    mockFn.mockRejectedValue(error)
    
    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    }
    
    expect(_internal.circuitBreaker.getState()).toBe('open')
    
    // Simulate timeout passing
    vi.useFakeTimers()
    vi.advanceTimersByTime(31000)
    
    // Act - Failed call in half-open state
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('API failure')
    
    // Assert - Should reopen the circuit
    expect(_internal.circuitBreaker.getState()).toBe('open')
    
    vi.useRealTimers()
  })

  it('handles concurrent calls correctly', async () => {
    // Arrange - Create promises that we can control
    let resolveFirst: (value: string) => void
    let rejectSecond: (error: Error) => void
    let resolveThird: (value: string) => void
    
    const firstPromise = new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
    const secondPromise = new Promise<string>((_, reject) => {
      rejectSecond = reject
    })
    const thirdPromise = new Promise<string>((resolve) => {
      resolveThird = resolve
    })
    
    mockFn
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise)
      .mockReturnValueOnce(thirdPromise)
    
    // Act - Start concurrent calls
    const call1 = withCircuitBreaker(mockFn)
    const call2 = withCircuitBreaker(mockFn)
    const call3 = withCircuitBreaker(mockFn)
    
    // Resolve/reject in different orders
    resolveFirst('first')
    rejectSecond(new Error('second failed'))
    resolveThird('third')
    
    // Wait for all to complete
    const results = await Promise.allSettled([call1, call2, call3])
    
    // Assert
    expect(results[0].status).toBe('fulfilled')
    expect((results[0] as PromiseFulfilledResult<string>).value).toBe('first')
    
    expect(results[1].status).toBe('rejected')
    expect((results[1] as PromiseRejectedResult).reason.message).toBe('second failed')
    
    expect(results[2].status).toBe('fulfilled')
    expect((results[2] as PromiseFulfilledResult<string>).value).toBe('third')
    
    // Circuit should be closed (success resets failure count)
    expect(_internal.circuitBreaker.getState()).toBe('closed')
    // The last success resets the failure count to 0
    expect(_internal.circuitBreaker.getFailureCount()).toBe(0)
  })

  it('throws CircuitOpenError with correct message', async () => {
    // Arrange - Open the circuit
    mockFn.mockRejectedValue(new Error('API failure'))
    
    for (let i = 0; i < 3; i++) {
      await expect(withCircuitBreaker(mockFn)).rejects.toThrow()
    }
    
    // Act & Assert
    await expect(withCircuitBreaker(mockFn))
      .rejects
      .toThrow(CircuitOpenError)
      
    try {
      await withCircuitBreaker(mockFn)
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError)
      expect(error.name).toBe('CircuitOpenError')
      expect(error.message).toBe('Circuit breaker is open')
    }
  })

  it('resets failure count on successful call', async () => {
    // Arrange - Cause some failures but not enough to open
    mockFn
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success')
    
    // Act
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('fail 1')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(1)
    
    await expect(withCircuitBreaker(mockFn)).rejects.toThrow('fail 2')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(2)
    
    const result = await withCircuitBreaker(mockFn)
    
    // Assert
    expect(result).toBe('success')
    expect(_internal.circuitBreaker.getFailureCount()).toBe(0)
    expect(_internal.circuitBreaker.getState()).toBe('closed')
  })
})