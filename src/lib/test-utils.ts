import { NextRequest } from 'next/server'

/**
 * Create a NextRequest for use in API route handler tests.
 * Replaces `new Request(url) as never` pattern.
 */
export function createTestRequest(url: string, init?: RequestInit): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`
  return new NextRequest(new URL(fullUrl), init)
}

/**
 * Create a NextRequest with a JSON body for POST/PUT/PATCH tests.
 * Replaces `makeRequest(url, body) as never` pattern.
 */
export function createTestJsonRequest(url: string, body: unknown, method = 'POST'): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`
  return new NextRequest(new URL(fullUrl), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
