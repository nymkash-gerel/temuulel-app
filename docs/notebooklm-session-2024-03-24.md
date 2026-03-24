# Session Report: 2026-03-24

## Completed Tasks

### 1. Test Infrastructure (commit b4d9132)
- Split `test-real-life.ts` (5,447 lines) into 4 focused files:
  - `test-customer-chat.ts` (1,100 lines) — scenarios 1-4, 8-9, 16-17, 22, 39-40
  - `test-facebook-real.ts` (329 lines) — scenarios 10-15
  - `test-driver-delivery.ts` (1,801 lines) — scenarios 5-6, 21, 25, 29-31, 33-38
  - `test-operational-flows.ts` (2,017 lines) — scenarios 7, 18-20, 23-24, 26-28, 32, 41-43
- All files import from shared `scripts/helpers/test-utils.ts`
- Added `extractCustomerMessages` and `section` helpers to test-utils

### 2. CI/CD Improvements (commit b4d9132)
- Split CI into 4 parallel jobs: lint, typecheck, test, build
- Build only runs after lint+typecheck+test pass
- Added coverage reporting with artifact upload
- Moved env vars to workflow-level (reduced duplication)

### 3. P0 #1: AI Hallucination Guard (commit 962e63c)
- **Problem:** AI invented product names/prices when database returned 0 results
- **Solution:** 3-layer defense:
  1. `chat-ai-handler.ts`: Short-circuit before GPT when `intent=product_search && products.length===0` — returns template "Уучлаарай, одоогоор таны хайсан бараа манай дэлгүүрт байхгүй байна"
  2. `resolution-engine.ts`: Added `productsEmpty` flag to `ResolutionContext`
  3. `contextual-responder.ts`: `noProductsRule` in GPT system prompt (was already present)
- Staff notification fires for unlisted product inquiries

### 4. P0 #2: Order State Machine (commit 61f3e0b)
- **Problem:** Bot skipped order steps — collected phone before address, skipped name entirely
- **Solution:** Split monolithic `info` step into sequential steps:
  - `variant` → `name` → `address` → `phone` → `confirming`
- Each step validates completion before advancing:
  - `name` step: Accepts text that isn't phone/address
  - `address` step: Validates address format (district/khoroo/bair)
  - `phone` step: Only accessible AFTER address is collected
- Added `customer_name` field to `OrderDraft`
- `createOrderFromChat` uses `draft.customer_name` for delivery records

## Current Test Status
- 121 test files, 3,817 tests — 3,814 passing, 3 failing (missing deliveries table in test mock)
- TypeScript: 0 errors
- ESLint: 0 errors (fixed 3 pre-existing `@typescript-eslint/no-explicit-any`)

## Phase 52 Status
| Task | Priority | Status |
|------|----------|--------|
| AI hallucination guard | P0 | DONE |
| Order state machine | P0 | DONE |
| "болох уу" intent conflict | P1 | DONE |
| Mongolian stemmer | P1 | DONE |
| JSON output for AI | P1 | DONE |
| History blindness fix | P1 | DONE |
| Test split + CI/CD | P1 | DONE |
| Redis rate limiting | P2 | PENDING |
| Instagram/WhatsApp | P2 | PENDING |
| Real-time logistics | P2 | PENDING |

### 5. P1 #5: Structured JSON Output for AI (commit 3847a2b)
- **Problem:** GPT returned plain text — no metadata for analytics, escalation, or quality monitoring
- **Solution:** Transition contextual responder to OpenAI JSON mode
  - `chatCompletionJSON<T>()` — multi-turn messages with `response_format: { type: "json_object" }`
  - `ContextualAIResponseJSON` — `{ response, empathy_needed, confidence, requires_human_review, detected_issues }`
  - Response-generator extracts `.response` for backward compatibility
  - AI metadata logged for analytics: `[ai-response] empathy=true confidence=0.85 human_review=false issues=[delivery_delay]`
- 12 unit tests added for JSON mode

### 6. CI Fix: Test Assertions for Sequential Order Steps (commit c9994f5)
- Fixed 41 test assertions across 4 files: `toBe('info')` → `toBe('name'/'address'/'phone')`
- Fixed 3 lint errors in `telegram/driver/route.ts`
- Remaining 3 test failures: missing `deliveries` table in test DB mock (pre-existing)
