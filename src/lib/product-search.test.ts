import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchProducts } from './product-search'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock Redis to avoid dependency issues in tests
vi.mock('./redis', () => ({
  getRedis: () => null
}))

describe('Product Search Security', () => {
  let mockSupabase: any
  let mockQuery: any

  beforeEach(() => {
    // Create mock query builder
    mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] })
    }

    // Create mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQuery)
    } as unknown as SupabaseClient<any>
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sanitizes array literal injection attempts', async () => {
    // Arrange - malicious input with array literal injection
    const maliciousQuery = 'test},"evil_injection",{"malicious'
    const storeId = 'store-123'
    
    // Act
    await searchProducts(mockSupabase, maliciousQuery, storeId)

    // Assert - Check that or() was called with sanitized conditions
    expect(mockQuery.or).toHaveBeenCalled()
    
    // Get the actual conditions passed to or()
    const orConditions = mockQuery.or.mock.calls[0][0]
    
    // Should not contain the dangerous characters in any array literal
    expect(orConditions).not.toContain('},"')
    expect(orConditions).not.toContain('",{')
    expect(orConditions).not.toContain('{","')
    
    // Should contain properly formed array literals without malicious chars
    expect(orConditions).toMatch(/search_aliases\.cs\.\{[^{},"]*\}/)
  })

  it('removes curly braces from search terms', async () => {
    // Arrange
    const queryWithBraces = 'search{term}'
    
    // Act
    await searchProducts(mockSupabase, queryWithBraces, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    // Should not contain nested braces which would break array syntax
    expect(orConditions).not.toContain('search_aliases.cs.{search{term}}')
    expect(orConditions).not.toContain('{{')
    expect(orConditions).not.toContain('}}')
  })

  it('removes commas from search terms', async () => {
    // Arrange  
    const queryWithCommas = 'search,term'
    
    // Act
    await searchProducts(mockSupabase, queryWithCommas, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    // Should not contain commas inside array literals which would create multiple elements
    expect(orConditions).not.toMatch(/search_aliases\.cs\.\{[^}]*,[^}]*\}/)
  })

  it('removes quotes from search terms', async () => {
    // Arrange
    const queryWithQuotes = 'search"term'
    
    // Act
    await searchProducts(mockSupabase, queryWithQuotes, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    // Should not contain quotes inside array literals
    expect(orConditions).not.toMatch(/search_aliases\.cs\.\{[^}]*"[^}]*\}/)
  })

  it('handles multiple malicious characters in one term', async () => {
    // Arrange
    const complexMaliciousQuery = '{"test,malicious"}'
    
    // Act
    await searchProducts(mockSupabase, complexMaliciousQuery, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    // Should not contain the original malicious pattern
    expect(orConditions).not.toContain('{"test,malicious"}')
    // Should not contain malicious structure even after normalization  
    expect(orConditions).not.toContain('{test,malicious}')
    // All array literals should have clean content (excluding the proper braces)
    const arrayLiterals = orConditions.match(/search_aliases\.cs\.\{[^}]*\}/g) || []
    for (const literal of arrayLiterals) {
      const content = literal.match(/search_aliases\.cs\.\{([^}]*)\}/)?.[1] || ''
      // The content inside braces should not contain dangerous characters
      expect(content).not.toMatch(/[{},"']/)
    }
  })

  it('applies different escaping for LIKE vs array literal conditions', async () => {
    // Arrange - Query that will trigger both LIKE and array literal conditions
    const query = 'test_search'
    
    // Act
    await searchProducts(mockSupabase, query, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    
    // Should have both LIKE conditions (with ilike) and array literal conditions
    expect(orConditions).toMatch(/name\.ilike\./)
    expect(orConditions).toMatch(/description\.ilike\./)
    expect(orConditions).toMatch(/search_aliases\.cs\./)
    
    // The implementation uses different escaping functions for different contexts
    // This test verifies that both types of conditions are generated
    expect(orConditions.split(',').length).toBeGreaterThan(3) // Multiple conditions
  })

  it('works with empty search terms', async () => {
    // Arrange
    const emptyQuery = ''
    
    // Act  
    await searchProducts(mockSupabase, emptyQuery, 'store-123')
    
    // Assert - Should not call or() for empty search
    expect(mockQuery.or).not.toHaveBeenCalled()
  })

  it('handles normal search terms without modification', async () => {
    // Arrange
    const normalQuery = 'cashmere wool'
    
    // Act
    await searchProducts(mockSupabase, normalQuery, 'store-123')
    
    // Assert
    const orConditions = mockQuery.or.mock.calls[0][0]
    expect(orConditions).toContain('search_aliases.cs.{cashmere}')
    expect(orConditions).toContain('search_aliases.cs.{wool}')
  })
})