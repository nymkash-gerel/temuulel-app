# Temuulel Commerce -- API Reference

> Complete API documentation for the Temuulel ecommerce chatbot platform.
> Base URL: `/api/`
> Version: 0.1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Sessions](#authentication--sessions)
3. [Common Conventions](#common-conventions)
4. [API Routes by Domain](#api-routes-by-domain)
   - [1. Authentication](#1-authentication)
   - [2. Chat & Messaging](#2-chat--messaging)
   - [3. Comment Auto-Reply](#3-comment-auto-reply)
   - [4. Webhooks](#4-webhooks)
   - [5. Orders](#5-orders)
   - [6. Payments](#6-payments)
   - [7. Products](#7-products)
   - [8. Customers](#8-customers)
   - [9. Staff](#9-staff)
   - [10. Workflows / Flows](#10-workflows--flows)
   - [11. Services & Appointments](#11-services--appointments)
   - [12. Bookable Resources](#12-bookable-resources)
   - [13. Deliveries](#13-deliveries)
   - [14. Delivery Drivers](#14-delivery-drivers)
   - [15. Driver Portal](#15-driver-portal)
   - [16. Driver Push Notifications](#16-driver-push-notifications)
   - [17. Driver Payouts](#17-driver-payouts)
   - [18. Tracking (Public)](#18-tracking-public)
   - [19. Vouchers](#19-vouchers)
   - [20. Returns](#20-returns)
   - [21. Team](#21-team)
   - [22. Notifications](#22-notifications)
   - [23. Analytics](#23-analytics)
   - [24. Templates & System](#24-templates--system)
5. [Pagination](#pagination)
6. [Rate Limiting](#rate-limiting)
7. [Error Responses](#error-responses)
8. [Webhook Signature Verification](#webhook-signature-verification)

---

## Overview

Temuulel is an ecommerce chatbot platform built with Next.js 16, Supabase, and OpenAI. The API powers a multi-tenant system where each authenticated user owns a store. All API routes live under `/api/` and follow RESTful conventions.

The platform spans several domains: AI-powered chat, order management, payments (QPay), delivery logistics with driver management, appointment booking, Facebook/Instagram/Telegram integrations, and analytics.

**Total routes: 69** across 24 domains.

---

## Authentication & Sessions

Authentication is handled by **Supabase Auth**. Sessions are stored as HTTP-only cookies managed by `@supabase/ssr`.

| Mechanism | Description |
|-----------|-------------|
| **Session cookie** | Supabase JWT token stored in cookies. Automatically refreshed by the middleware. Required by all "Session" auth routes. |
| **Driver session** | Drivers authenticate separately via `/api/driver/auth/*` and use the same Supabase cookie mechanism. Driver routes are protected by the middleware for `/driver/*` paths. |
| **HMAC signature** | Webhook endpoints verify payloads using HMAC-SHA256 signatures (e.g., QStash, Facebook). |
| **CRON_SECRET** | Cron endpoints validate via a shared secret in the `Authorization` header. |
| **Public** | Some endpoints require no authentication (widget chat, tracking, health check, order creation). |

The Next.js middleware (`src/middleware.ts`) enforces authentication for:
- `/dashboard/*` routes -- redirects to `/login` if unauthenticated
- `/driver/*` routes (excluding `/driver/login` and `/driver/register`) -- redirects to `/driver/login`
- Public paths (`/embed/*`, `/track/*`, static assets) are excluded from middleware checks

---

## Common Conventions

### Request Format

- **Content-Type**: `application/json` for all POST/PATCH/PUT requests
- **File uploads**: `multipart/form-data` (proof photo upload only)
- **Query parameters**: Used for filtering, searching, and pagination on GET requests

### Response Format

All successful responses return JSON:

```json
{
  "data": [ ... ],
  "count": 42,
  "limit": 20,
  "offset": 0
}
```

Single-resource responses return the object directly:

```json
{
  "id": "uuid",
  "field": "value",
  ...
}
```

### Store Scoping

Most authenticated endpoints automatically scope data to the current user's store. The server resolves the store from `stores.owner_id = user.id`. There is no need to pass a `store_id` for authenticated routes.

Public-facing endpoints (widget, order creation) require an explicit `store_id` in the request body.

---

## API Routes by Domain

### 1. Authentication

7 routes for user sign-in/sign-out, OAuth flows, and driver authentication.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signout` | Session | Sign out the current user and redirect to login page |
| GET | `/api/auth/callback` | No | Supabase OAuth callback; exchanges authorization code for a session |
| GET | `/api/auth/facebook` | Session | Initiates Facebook OAuth flow for page integration |
| GET | `/api/auth/facebook/callback` | No | Handles Facebook OAuth response; exchanges short-lived token for a long-lived token and stores it |
| POST | `/api/auth/facebook/select-page` | Session | Select a Facebook page to connect to the store and subscribe to webhooks |
| POST | `/api/driver/auth/register` | No | Register a new delivery driver account |
| POST | `/api/driver/auth/signout` | Session | Sign out the current driver |

---

### 2. Chat & Messaging

6 routes covering AI chat responses, the embeddable widget, dashboard conversations, and driver-store messaging.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/ai` | Session | Generate an AI response: intent classification, product/order search, and response generation |
| POST | `/api/chat/widget` | No | Customer-facing widget chat endpoint; handles escalation, voucher delivery, and conversation memory |
| GET | `/api/chat` | Session | Retrieve conversations for the current store with sentiment tags |
| POST | `/api/chat` | Session | Save a message to a conversation; creates the conversation if it does not exist |
| GET | `/api/driver/chat` | Session (driver) | Driver-to-store messaging; fetch messages for a conversation |
| POST | `/api/driver/chat` | Session (driver) | Send a message from the driver to the store |
| GET | `/api/driver-chat` | Session | List all driver conversations with unread message counts |
| GET | `/api/driver-chat/[driverId]` | Session | Fetch messages for a specific driver conversation |
| POST | `/api/driver-chat/[driverId]` | Session | Send a message to a specific driver; marks messages as read |

---

### 3. Comment Auto-Reply

2 route groups for managing keyword-based auto-reply rules on Facebook/Instagram comments.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/comment-rules` | Session | List all auto-reply rules for the current store |
| POST | `/api/comment-rules` | Session | Create a new keyword-based auto-reply rule |
| GET | `/api/comment-rules/[id]` | Session | Get a single auto-reply rule by ID |
| PATCH | `/api/comment-rules/[id]` | Session | Update an auto-reply rule |
| DELETE | `/api/comment-rules/[id]` | Session | Delete an auto-reply rule |

---

### 4. Webhooks

4 routes for inbound webhooks from external platforms and internal delivery mechanisms.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhook/deliver` | HMAC (QStash) | QStash callback for asynchronous webhook delivery; verified via HMAC-SHA256 |
| GET | `/api/webhook/messenger` | No | Facebook webhook verification (hub.verify_token challenge) |
| POST | `/api/webhook/messenger` | HMAC (Facebook) | Facebook Messenger webhook: handles DMs, comments, feed events, and triggers AI auto-reply |
| POST | `/api/webhook/telegram` | No | Telegram bot webhook: handles `/start` command for account linking and inline button callbacks |
| POST | `/api/webhook/delivery` | No | External delivery provider callback (HiDel, Delko) for status updates |

---

### 5. Orders

3 routes for creating orders, searching, and updating status.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | No | Create a new order with line items; calculates shipping from store zone config; dispatches new_order notification |
| GET | `/api/orders/search` | Session | Search orders by order number; filter by store |
| PATCH | `/api/orders/status` | Session | Update order status (pending/confirmed/processing/shipped/delivered/cancelled); decrements product stock on confirmation; auto-creates delivery record when shipped |

---

### 6. Payments

3 routes for QPay integration and payment status management.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/payments/callback` | No | QPay callback endpoint for payment verification |
| POST | `/api/payments/create` | Session | Create a QPay QR invoice or return bank transfer details based on store payment configuration |
| POST | `/api/payments/check` | Session | Check current payment status against QPay |
| PATCH | `/api/payments/check` | Session | Manually update payment status |

---

### 7. Products

2 routes for product search and AI enrichment.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products/search` | No | Full-text product search with Mongolian language support and category mapping; used by widget and AI |
| POST | `/api/products/enrich` | Session | AI-enrich products by generating search aliases and FAQ entries from product data |

---

### 8. Customers

3 routes for customer management.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/customers` | Session | List customers with search and filtering |
| POST | `/api/customers` | Session | Create a new customer record |
| GET | `/api/customers/[id]` | Session | Get a single customer by ID |
| PATCH | `/api/customers/[id]` | Session | Update customer details |
| DELETE | `/api/customers/[id]` | Session | Delete a customer record |

---

### 9. Staff

3 routes for staff member management.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/staff` | Session | List staff members with optional status filter |
| POST | `/api/staff` | Session | Create a new staff member |
| GET | `/api/staff/[id]` | Session | Get a single staff member by ID |
| PATCH | `/api/staff/[id]` | Session | Update staff member details |
| DELETE | `/api/staff/[id]` | Session | Delete a staff member |

---

### 10. Workflows / Flows

4 route groups for the visual chat automation flow builder.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/flows` | Session | List all flows for the current store |
| POST | `/api/flows` | Session | Create a new flow with nodes and edges |
| GET | `/api/flows/[id]` | Session | Get a single flow with full node/edge data |
| PATCH | `/api/flows/[id]` | Session | Update a flow: modify nodes, edges, trigger config, or status |
| DELETE | `/api/flows/[id]` | Session | Delete a flow |
| POST | `/api/flows/[id]/duplicate` | Session | Duplicate an existing flow as a new draft |
| GET | `/api/flows/templates` | Session | List pre-built flow templates filtered by business type |

---

### 11. Services & Appointments

6 routes for service-based businesses (salons, clinics, etc.) to manage services and appointments.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/services` | Session | List all services for the current store |
| POST | `/api/services` | Session | Create a new service |
| GET | `/api/services/[id]` | Session | Get a single service by ID |
| PATCH | `/api/services/[id]` | Session | Update a service |
| DELETE | `/api/services/[id]` | Session | Delete a service |
| GET | `/api/appointments` | Session | List appointments with date range and staff filters |
| POST | `/api/appointments` | Session | Create a new appointment |
| GET | `/api/appointments/[id]` | Session | Get a single appointment by ID |
| PATCH | `/api/appointments/[id]` | Session | Update appointment details or status; triggers status-change notifications |
| DELETE | `/api/appointments/[id]` | Session | Delete an appointment |

---

### 12. Bookable Resources

2 route groups for managing bookable resources (rooms, equipment, vehicles, etc.).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bookable-resources` | Session | List bookable resources filtered by type and status |
| POST | `/api/bookable-resources` | Session | Create a new bookable resource |
| GET | `/api/bookable-resources/[id]` | Session | Get a single bookable resource by ID |
| PATCH | `/api/bookable-resources/[id]` | Session | Update a bookable resource |
| DELETE | `/api/bookable-resources/[id]` | Session | Delete a bookable resource |

---

### 13. Deliveries

6 route groups for managing delivery logistics.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/deliveries` | Session | List deliveries with filtering by status, driver, and delivery type |
| POST | `/api/deliveries` | Session | Create a new delivery; auto-calculates delivery fee based on zone configuration |
| GET | `/api/deliveries/[id]` | Session | Get delivery details including driver and order info |
| PATCH | `/api/deliveries/[id]` | Session | Update delivery status with state-machine validation |
| POST | `/api/deliveries/assign` | Session | AI-powered driver assignment based on location proximity, current load, and completion rate |
| GET | `/api/deliveries/calculate-fee` | Session | Calculate delivery fee by address using zone and district configuration |
| POST | `/api/deliveries/calculate-fee` | Session | Calculate delivery fee with full address details in the request body |
| GET | `/api/deliveries/time-slots` | Session | Retrieve the store's configured delivery time slots |

---

### 14. Delivery Drivers

3 routes for store owners to manage their delivery drivers.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/delivery-drivers` | Session | List drivers with optional status and vehicle type filters |
| POST | `/api/delivery-drivers` | Session | Create a new delivery driver |
| GET | `/api/delivery-drivers/[id]` | Session | Get a single driver by ID |
| PATCH | `/api/delivery-drivers/[id]` | Session | Update driver details |
| DELETE | `/api/delivery-drivers/[id]` | Session | Delete a driver |

---

### 15. Driver Portal

8 route groups for the driver-facing mobile portal.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/driver/deliveries` | Session (driver) | List deliveries assigned to the authenticated driver |
| GET | `/api/driver/deliveries/[id]` | Session (driver) | Get details of a specific assigned delivery |
| PATCH | `/api/driver/deliveries/[id]` | Session (driver) | Update delivery status from the driver perspective (picked_up, delivered, etc.) |
| POST | `/api/driver/deliveries/[id]/upload-proof` | Session (driver) | Upload a proof-of-delivery photo; accepts JPEG, PNG, or WebP up to 10 MB |
| POST | `/api/driver/deliveries/optimize` | Session (driver) | AI-powered route optimization; requires 2 or more pending deliveries |
| GET | `/api/driver/profile` | Session (driver) | Get driver profile with delivery statistics |
| PATCH | `/api/driver/profile` | Session (driver) | Update driver profile (name, vehicle info) |
| PATCH | `/api/driver/location` | Session (driver) | Update driver real-time location (latitude/longitude) |
| GET | `/api/driver/earnings` | Session (driver) | Earnings summary grouped by today, this week, this month, and all-time |
| GET | `/api/driver/earnings/history` | Session (driver) | Paginated delivery history with individual fee breakdowns |

---

### 16. Driver Push Notifications

2 routes for managing driver push notification subscriptions.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/driver/push/subscribe` | Session (driver) | Save a push notification subscription for the driver |
| DELETE | `/api/driver/push/unsubscribe` | Session (driver) | Remove a push notification subscription |

---

### 17. Driver Payouts

4 route groups for managing driver payout operations.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/driver-payouts` | Session | List all driver payouts for the store |
| POST | `/api/driver-payouts` | Session | Create a manual payout record |
| PATCH | `/api/driver-payouts/[id]` | Session | Update payout status (pending/processing/completed) |
| POST | `/api/driver-payouts/generate` | Session | Auto-generate payouts from completed deliveries within a date range |
| GET | `/api/driver-store-assignments` | Session | List driver-to-store assignments |
| POST | `/api/driver-store-assignments` | Session | Create a new driver-store assignment |
| DELETE | `/api/driver-store-assignments` | Session | Remove a driver-store assignment |

---

### 18. Tracking (Public)

2 public route groups for customers to track deliveries and rate drivers without authentication.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/track/[deliveryNumber]` | No | Public delivery tracking by delivery number; returns status, driver location, and ETA |
| GET | `/api/track/[deliveryNumber]/rate` | No | Get existing rating for a delivery |
| POST | `/api/track/[deliveryNumber]/rate` | No | Submit a driver rating (1-5 stars) for a completed delivery |

---

### 19. Vouchers

2 route groups for managing promotional vouchers.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/vouchers` | Session | List vouchers with status filter; automatically expires past-due vouchers |
| GET | `/api/vouchers/[id]` | Session | Get a single voucher by ID |
| PATCH | `/api/vouchers/[id]` | Session | Update voucher status or details |

---

### 20. Returns

2 route groups for processing order returns and refunds.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/returns` | Session | List returns with status filter |
| POST | `/api/returns` | Session | Create a full or partial return for an order |
| GET | `/api/returns/[id]` | Session | Get return details including individual return items |
| PATCH | `/api/returns/[id]` | Session | Update return status; triggers refund creation when approved |

---

### 21. Team

2 routes for managing team members within a store.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/team/invite` | Session | Invite a user to the team; validates against the subscription plan's team member limit |
| DELETE | `/api/team/remove` | Session | Remove a team member; the store owner cannot remove themselves |

---

### 22. Notifications

2 route groups plus a push subscription endpoint.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Session | List notifications for the current user, ordered with unread first |
| PATCH | `/api/notifications` | Session | Mark one or more notifications as read |
| POST | `/api/push/subscribe` | Session | Save a browser push notification subscription (Web Push) |

---

### 23. Analytics

3 routes for store analytics and AI-powered insights.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/stats` | Session | Aggregate analytics for a given period; query param `period` accepts `7d`, `30d`, `90d`, or `1y` |
| POST | `/api/analytics/insights` | Session | Generate AI-powered business insights from analytics data |
| GET | `/api/analytics/delivery` | Session | Delivery-specific analytics including driver performance rankings |

---

### 24. Templates & System

4 routes for system operations, templates, health checks, and scheduled jobs.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/templates/apply` | Session | List available store templates |
| POST | `/api/templates/apply` | Session | Apply a template to the current store (products, flows, settings) |
| GET | `/api/health` | No | Health check endpoint; returns status of app and database connectivity |
| GET | `/api/cron/daily-report` | CRON_SECRET | Vercel cron job (daily at 06:00 UTC+8); generates and emails daily reports to store owners |
| POST | `/api/demo/flow-step` | No | Execute a single step of a demo flow; public endpoint for the landing page demo |

---

## Pagination

All list endpoints support pagination via query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 20 | 100 | Number of items to return |
| `offset` | integer | 0 | -- | Number of items to skip |

**Note:** Product search (`/api/products/search`) has a lower maximum of `limit=50`.

Paginated responses include metadata:

```json
{
  "data": [ ... ],
  "count": 142,
  "limit": 20,
  "offset": 0
}
```

---

## Rate Limiting

Rate limiting is applied per IP address using an in-memory sliding window. When a rate limit is exceeded, the API returns `429 Too Many Requests`.

Below are the configured rate limits for endpoints that enforce them:

| Endpoint | Limit |
|----------|-------|
| `/api/chat/widget` | 20 requests / minute |
| `/api/chat/ai` | 20 requests / minute |
| `/api/orders` (POST) | 10 requests / minute |
| `/api/orders/search` | 60 requests / minute |
| `/api/orders/status` | 30 requests / minute |
| `/api/payments/create` | 10 requests / minute |
| `/api/payments/check` | 20 requests / minute |
| `/api/payments/callback` | 10 requests / minute |
| `/api/products/search` | 30 requests / minute |
| `/api/products/enrich` | 5 requests / minute |
| `/api/customers` (POST) | 30 requests / minute |
| `/api/customers` (GET) | 30 requests / minute |
| `/api/staff` (POST) | 30 requests / minute |
| `/api/services` (POST) | 30 requests / minute |
| `/api/appointments` (POST) | 30 requests / minute |
| `/api/flows` (POST) | 30 requests / minute |
| `/api/flows/[id]/duplicate` | 10 requests / minute |
| `/api/comment-rules` (POST) | 30 requests / minute |
| `/api/analytics/stats` | 30 requests / minute |
| `/api/analytics/insights` | 10 requests / minute |
| `/api/notifications` (GET) | 60 requests / minute |
| `/api/team/invite` | 10 requests / minute |
| `/api/team/remove` | 10 requests / minute |

Endpoints not listed above either have no explicit rate limit or inherit a default limit.

---

## Error Responses

All errors return a consistent JSON structure:

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created (used by some POST endpoints) |
| `400` | Bad Request -- validation error or malformed input |
| `401` | Unauthorized -- no valid session |
| `403` | Forbidden -- authenticated but not authorized for this resource |
| `404` | Not Found -- resource does not exist or is not accessible |
| `429` | Too Many Requests -- rate limit exceeded |
| `500` | Internal Server Error |
| `503` | Service Unavailable -- returned by `/api/health` when database is unreachable |

### Validation Errors

Request body validation is performed using schema definitions from `src/lib/validations.ts`. When validation fails, a `400` response is returned with a descriptive error message indicating which field(s) are invalid.

---

## Webhook Signature Verification

### Outgoing Webhooks (QStash)

Outgoing webhooks dispatched via QStash are signed with HMAC-SHA256. The signature is included in the `X-Webhook-Signature` header.

Payload format:

```json
{
  "event": "order.created | order.status_changed | message.received | ...",
  "timestamp": "2026-01-30T00:00:00.000Z",
  "data": { ... }
}
```

To verify a webhook:

1. Extract the `X-Webhook-Signature` header value
2. Compute HMAC-SHA256 of the raw request body using your webhook secret
3. Compare the computed signature with the header value

### Facebook Messenger Webhook

The `/api/webhook/messenger` endpoint:

- **GET**: Responds to Facebook's hub.verify_token challenge for webhook subscription verification
- **POST**: Receives events (messages, comments, feed updates) and verifies the `X-Hub-Signature-256` header using the Facebook app secret

### Telegram Webhook

The `/api/webhook/telegram` endpoint receives updates from the Telegram Bot API. Security is enforced by keeping the webhook URL secret (containing the bot token in the path or verified server-side).

---

*This document covers all 69 API routes across 24 domains in the Temuulel ecommerce chatbot platform.*
