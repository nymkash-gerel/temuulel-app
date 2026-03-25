/**
 * Shared PII scrubbing utilities for Sentry configs.
 *
 * Used by sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts
 * to consistently filter sensitive customer data before sending to Sentry.
 */

// ---------------------------------------------------------------------------
// PII Patterns
// ---------------------------------------------------------------------------

/** Mongolian phone numbers: 8 digits starting with 7, 8, 9, or 6 */
const MN_PHONE_RE = /\b[6-9]\d{7}\b/g

/** International phone: +976 XXXXXXXX */
const INTL_PHONE_RE = /\+?976[\s-]?\d{8}/g

/** Email addresses */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/** Mongolian national ID (register number): 2 letters + 8 digits */
const REGISTER_RE = /\b[А-ЯA-Z]{2}\d{8}\b/gi

/** Credit card numbers (13-19 digits, with optional spaces/dashes) */
const CARD_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g

/** All PII patterns */
const PII_PATTERNS = [
  { re: INTL_PHONE_RE, label: '[PHONE]' },
  { re: MN_PHONE_RE, label: '[PHONE]' },
  { re: EMAIL_RE, label: '[EMAIL]' },
  { re: REGISTER_RE, label: '[REGISTER]' },
  { re: CARD_RE, label: '[CARD]' },
]

// ---------------------------------------------------------------------------
// Scrub functions
// ---------------------------------------------------------------------------

/**
 * Scrub PII from a string. Replaces phone numbers, emails, card numbers, etc.
 */
export function scrubPII(text: string): string {
  let result = text
  for (const { re, label } of PII_PATTERNS) {
    result = result.replace(re, label)
  }
  return result
}

/**
 * Scrub PII from an object's string values (shallow).
 */
export function scrubObjectPII(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'phone', 'password', 'address', 'credit_card', 'card_number',
    'cvv', 'token', 'secret', 'customer_phone', 'customer_name',
    'shipping_address', 'delivery_address',
  ]
  const result = { ...obj }
  for (const key of Object.keys(result)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else if (typeof result[key] === 'string') {
      result[key] = scrubPII(result[key] as string)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Sentry hooks
// ---------------------------------------------------------------------------

import type { Breadcrumb, BreadcrumbHint, ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * beforeBreadcrumb — scrub PII from breadcrumb messages and URLs.
 * Prevents phone numbers, emails, addresses from leaking via:
 * - console.log breadcrumbs
 * - XHR/fetch URL breadcrumbs (query params)
 * - navigation breadcrumbs
 */
export function beforeBreadcrumb(
  breadcrumb: Breadcrumb,
  _hint?: BreadcrumbHint,
): Breadcrumb | null {
  // Scrub message
  if (breadcrumb.message) {
    breadcrumb.message = scrubPII(breadcrumb.message)
  }

  // Scrub URL-based breadcrumbs (fetch, xhr, navigation)
  if (breadcrumb.data) {
    if (typeof breadcrumb.data.url === 'string') {
      breadcrumb.data.url = scrubPII(breadcrumb.data.url)
    }
    if (typeof breadcrumb.data.from === 'string') {
      breadcrumb.data.from = scrubPII(breadcrumb.data.from)
    }
    if (typeof breadcrumb.data.to === 'string') {
      breadcrumb.data.to = scrubPII(breadcrumb.data.to)
    }
  }

  return breadcrumb
}

/**
 * beforeSend — scrub PII from error events.
 * Handles request data, headers, and exception messages.
 */
export function beforeSend(
  event: ErrorEvent,
  _hint?: EventHint,
): ErrorEvent | null {
  // Scrub request data
  if (event.request?.data && typeof event.request.data === 'object') {
    event.request.data = scrubObjectPII(event.request.data as Record<string, unknown>)
  }

  // Scrub request query string
  if (event.request?.query_string) {
    event.request.query_string = scrubPII(
      typeof event.request.query_string === 'string'
        ? event.request.query_string
        : String(event.request.query_string),
    )
  }

  // Scrub sensitive headers
  if (event.request?.headers) {
    delete event.request.headers['authorization']
    delete event.request.headers['cookie']
  }

  // Scrub exception messages (may contain user input)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubPII(ex.value)
    }
  }

  return event
}
