/**
 * Circuit breaker pattern for OpenAI API calls
 * States: closed (normal), open (failing), half-open (testing)
 */

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
}

class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime?: number
  private readonly config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open'
      } else {
        throw new CircuitOpenError()
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false
    return (Date.now() - this.lastFailureTime) >= this.config.resetTimeoutMs
  }

  // For testing
  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failureCount
  }

  // Reset for testing
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = undefined
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 30000 // 30 seconds
})

/**
 * Wrap a function with circuit breaker protection
 * @param fn Function to execute with circuit breaker
 * @returns Promise that resolves to the function result
 * @throws CircuitOpenError when circuit is open
 */
export async function withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
  return circuitBreaker.execute(fn)
}

// Export for testing
export const _internal = {
  circuitBreaker,
  CircuitBreaker
}