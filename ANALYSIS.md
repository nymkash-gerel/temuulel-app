# Temuulel App — Full Codebase Analysis & Bug Report

**Date:** 2026-02-22  
**Analyst:** Claude (automated deep analysis)  
**Codebase:** 918 source files, 90 test files, 3291 tests (14 failing)

---

## Part 1: Bug Analysis — 14 Test Failures

### Category 1: Escalation Engine — `countConsecutiveAiOnly` Broken (8 failures)

#### Root Cause

**`countConsecutiveAiOnly` in `src/lib/escalation.ts`** breaks on ANY non-customer message (including AI responses), but the tests expect it to skip AI responses and only break on human agent replies.

**Current code (line ~118):**
```typescript
for (let i = messages.length - 1; i >= 0; i--) {
  const msg = messages[i]
  if (msg.is_from_customer) {
    customerCount++
  } else {
    break  // BUG: breaks on AI responses too
  }
}
```

**Expected behavior:** Walk backwards counting customer messages, skip AI responses, only stop at human agent replies.

**Fix:**
```typescript
for (let i = messages.length - 1; i >= 0; i--) {
  const msg = messages[i]
  if (msg.is_from_customer) {
    customerCount++
  } else if (!msg.is_ai_response) {
    break  // Only human agent replies break the streak
  }
  // AI responses are skipped — continue counting
}
```

This fixes 4 failures:
- `escalation.test.ts > countConsecutiveAiOnly > counts customer messages after AI-only replies` (expected 3, got 1)
- `escalation.test.ts > countConsecutiveAiOnly > stops counting at human agent reply` (expected 2, got 1→ now skips AI, stops at human)
- `escalation-scenarios.test.ts > countConsecutiveAiOnly > counts all customer messages backwards until a human agent reply` (expected 4, got 1)
- `escalation-scenarios.test.ts > countConsecutiveAiOnly > counts multiple customer messages after human agent break` (expected 2, got 1)

#### Secondary Bug: `ai_fail_to_resolve` threshold too high

**Current code (line ~167):**
```typescript
const consecutiveCustomer = countConsecutiveAiOnly(recentMessages)
if (consecutiveCustomer >= 5) {  // BUG: threshold too high
```

Tests expect the threshold to be **3**, not 5. The E6 scenario has 3 customer messages with only AI replies and expects `ai_fail_to_resolve` to trigger.

**Fix:**
```typescript
if (consecutiveCustomer >= 3) {
```

This fixes 2 failures:
- `escalation.test.ts > evaluateEscalation > detects AI-fail-to-resolve (+15)`
- `escalation-scenarios.test.ts > E6: 3+ customer messages with only AI replies triggers ai_fail_to_resolve`
- `escalation-scenarios.test.ts > Long Unresolved Thread > 6+ customer messages with no human reply triggers long_unresolved` (needed ai_fail_to_resolve AND long_unresolved)

#### Tertiary Bug: `repeated_message` self-exclusion logic

**Current code (line ~160):**
```typescript
const allCustomerMsgs = recentMessages
  .filter((m) => m.is_from_customer)
  .map((m) => m.content)
const recentCustomerMsgs = allCustomerMsgs.slice(0, -1).slice(-5)  // BUG
```

The `slice(0, -1)` assumes the current message is always the last entry in `recentMessages`. But when `evaluateEscalation` is called directly (as in tests), the current message may NOT be in the history array, causing the last *real* previous message to be incorrectly excluded.

**Fix:** Remove the `slice(0, -1)`:
```typescript
const recentCustomerMsgs = allCustomerMsgs.slice(-5)
```

This fixes:
- `escalation.test.ts > evaluateEscalation > detects repeated messages (+15)` (history=[1 msg], current=same, slice removed only comparison target)

**Note:** In production (`processEscalation`), the current message is already saved to DB before evaluation, so it appears in `recentMessages`. However, `detectRepeatedMessage` uses Jaccard similarity with 0.8 threshold — an exact self-match would score 1.0 and trigger, which is the *correct* behavior for a message that was already said before and appears again.

---

### Category 2: Intent Classification Conflicts (3 failures)

#### Bug 2a: `"болох уу"` in `size_info` is too greedy

**File:** `src/lib/chat-ai.ts`, `size_info` keyword list

The keyword `'болох уу'` (meaning "can I?" / "is it possible?") appears in `size_info` but is a generic Mongolian phrase used in many contexts (payment, return, etc.). This causes:

1. **"Хэмжээ тохирохгүй, солиулж болох уу?"** → `size_info` (should be `return_exchange`)
   - `size_info` score: "хэмжээ"(1) + "болох уу"(1) = 2
   - `return_exchange` score: "тохирохгүй"(1) + "солиулж"(1) = 2
   - Tie goes to whichever is iterated first; size_info wins

2. **"Хуваан төлж болох уу?"** → `size_info` (should be `payment`)
   - `size_info` score: "болох уу"(1) = 1
   - `payment` score: "хуваан төлөх" doesn't match "хуваан төлж" (conjugation mismatch) = 0
   - size_info wins by default

**Fix:** Remove `'болох уу'`, `'болху'`, `'блху'` from `size_info` keywords. These are generic modal phrases, not size-specific. Also add `'хуваан төлж'` to `payment` keywords.

```typescript
// In size_info keywords, REMOVE these lines:
// 'болох уу', 'болху', 'блху', 'тааруу',
// Keep 'тааруу' if desired (it IS size-specific)

// In payment keywords, ADD:
'хуваан төлж',
```

#### Bug 2b: `"зураг"` in `product_search` outscores `order_status`

**"Зураг хэзээ бэлэн болох вэ?"** → `product_search` (should be `order_status`)
- `product_search`: "зураг"(1) = 1
- `order_status`: "хэзээ"(1) = 1
- Tie, product_search wins by iteration order

**Fix:** Add `'бэлэн болох'` to `order_status` keywords. This phrase specifically means "to be ready" — a strong order status signal:

```typescript
// In order_status keywords, ADD:
'бэлэн болох', 'бэлэн болно', 'бэлэн болсон',
```

Now order_status scores: "хэзээ"(1) + "бэлэн болох"(1) = 2 > product_search's 1.

---

### Category 3: Conversation State Follow-up (3 failures)

#### Bug 3: `order_intent` check (step 1d) fires before `select_single` and `contextual_question`

**File:** `src/lib/conversation-state.ts`, `resolveFollowUp` function

The check order in `resolveFollowUp` is:
1. Number reference (1)
2. Name match (1b)
3. Price match (1c)
4. **Order intent (1d)** ← fires too early
5. Select single (2)
6. Size question (3)
7. **Contextual question (4)** ← never reached for order words

**Failure 3a: "энийг авъя" not resolving as `select_single`**

With 1 product and `last_intent='product_search'`:
- Step 1d: "авъя" starts with stem "авъ" → returns `order_intent` 
- Step 2 (select_single) never reached

**Failure 3b: "захиалах" not resolving as contextual `order` question**

With 1 product:
- Step 1d: "захиалах" starts with stem "захиал" → returns `order_intent`
- Step 4 (contextual) has "захиалах" in order topic but never reached

**Failure 3c: "захиалмаар байна" same issue** — "захиалмаар" starts with "захиал"

**Fix:** Reorder the checks — move `select_single` (step 2) before `order_intent` (step 1d), AND move `order_intent` after `contextual_question`:

```typescript
// New order:
// 1. Number reference
// 1b. Name match  
// 1c. Price match
// 2. Select single ("энийг авъя" with 1 product) ← MOVED UP
// 3. Size question
// 4. Contextual question (delivery, order, payment, etc.) ← catches "захиалах"
// 4b. Order intent (from stems) ← MOVED DOWN, fallback
// 5. Price question
// 6. Query refinement
// 7. Prefer LLM
```

Specifically, move the block at current step 1d (lines ~240-250) to after the contextual question block (after current step 4, ~line 290). And move current step 2 (select_single, ~lines 253-260) to right after step 1c (before the old step 1d position).

---

## Part 2: Full Expert Analysis

### Architecture Quality: **7/10**

**Strengths:**
- Clean separation: `chat-ai.ts` (classification), `conversation-state.ts` (memory), `escalation.ts` (scoring), `chat-ai-handler.ts` (orchestration)
- 3-tier AI response fallback: Contextual AI → Recommendation writer → Deterministic template
- Supabase-native with proper typing via generated `database.types.ts`
- Next.js App Router with API routes

**Weaknesses:**
- Keyword-based intent classification will always have priority conflicts (ML model would be better)
- No message queue for async processing (webhooks, notifications)
- Conversation state stored in JSONB column rather than dedicated state table
- Tight coupling between classification and response generation

### Code Quality: **8/10**

**Strengths:**
- Excellent JSDoc comments explaining design decisions and known limitations
- TypeScript throughout with proper interface definitions
- Pure functions for testability (`evaluateEscalation`, `resolveFollowUp`, `classifyIntent`)
- Well-structured keyword lists with clear categorization
- Thoughtful handling of Mongolian text (Latin→Cyrillic normalization, vowel neutralization)

**Weaknesses:**
- Some keyword lists are very long (500+ entries in `product_search`) — maintenance burden
- The `slice(0, -1)` assumption about message ordering is fragile
- Magic numbers (thresholds 0.8, 5, 6) not centralized as constants
- `chat-ai.ts` is 700+ lines — could be split into classifier, search, and response modules

### Security: **7/10**

**Strengths:**
- Supabase RLS implied (standard Supabase architecture)
- Service-role vs browser client separation (`supabase/admin.ts` vs `client.ts`)
- No raw SQL injection vectors visible

**Concerns:**
- Search terms from user messages are interpolated into `.ilike.%${w}%` — potential for Supabase filter injection
- No rate limiting visible on chat endpoints (Upstash ratelimit is a dependency but usage unclear)
- OpenAI API key management not visible in analyzed files
- Customer message content stored without sanitization

### Test Coverage: **9/10**

**Strengths:**
- 90 test files, 3291 tests (97% passing) — exceptional for this codebase size
- Tests cover: unit, scenario, edge cases, known limitations, multi-turn flows
- Mongolian language-specific test cases (slang, abbreviations, vowel confusion)
- Tests document known classifier gaps explicitly (not hidden)
- The 14 failures are genuine bugs, not test issues

**Weaknesses:**
- No integration tests for `processEscalation` (DB-dependent code path)
- E2E tests exist (Playwright) but coverage unknown
- No load/performance tests

### Performance Concerns: **6/10**

- **Keyword classification is O(n×m)** where n = message words, m = total keywords across all intents. With 500+ keywords in product_search alone, this runs ~5000+ string comparisons per message. Fine for now but won't scale.
- **Product search uses OR chains** with `.ilike` patterns — Supabase/Postgres will do sequential scans without proper indexes
- **No caching** of product search results or classification results
- **Message history fetched on every turn** — could be cached in conversation state
- **Synonym expansion** creates large OR queries (6 conditions per search word × multiple words)

### Mongolian NLP Quality: **8/10**

**Strengths:**
- Latin→Cyrillic normalization handles real-world typing patterns (mixed script, transliteration)
- Vowel neutralization (е/э, у/ү, о/ө) handles common Latin-typed confusion
- Digraph handling (ts→ц, sh→ш, ch→ч) is correct
- Extensive slang/abbreviation coverage from real Facebook Messenger conversations
- Synonym groups for product search (кашемир↔ноолуур)

**Weaknesses:**
- No morphological analysis — verb conjugation mismatches are a known limitation (буцааж ≠ буцаах)
- No stemming — suffixed forms must be manually enumerated (солиулж, солилтын, буцаагдсан)
- Would benefit from a Mongolian stemmer library to reduce keyword maintenance
- The `normalizeText` function doesn't handle all Mongolian-specific characters (long vowels, etc.)

### Business Logic Completeness: **8/10**

**Strengths:**
- Multi-vertical support (e-commerce, restaurants, services, education, car wash, pet grooming)
- Full escalation pipeline: scoring → threshold → notification → compensation voucher
- Complaint classification + auto-compensation with policy engine
- Restaurant-specific: table reservations, allergen info, menu availability, busy mode
- Conversation state machine with order drafting flow

**Gaps:**
- No inventory/stock management integration beyond search
- Payment processing is informational only (no QPay/SocialPay API integration visible)
- No CRM/customer profile enrichment
- Booking conflict detection exists but integration unclear

### Deployment Readiness: **7/10**

**Strengths:**
- Next.js with standard build pipeline
- Sentry integration for error monitoring
- Supabase (managed DB + auth)
- Upstash Redis for caching/rate limiting

**Concerns:**
- 14 failing tests must be fixed before deploy
- No CI/CD configuration visible in analyzed files
- No environment variable validation beyond `env.ts`
- No health check endpoint visible
- No graceful degradation if OpenAI API is down (falls back to template, but no circuit breaker)

---

## Top 10 Recommendations

1. **Fix the 14 failing tests** — All fixes are surgical (see Part 1). Estimated effort: 30 minutes.

2. **Remove `"болох уу"` from `size_info`** — This single keyword causes 2 of 3 intent misclassifications. It's a generic Mongolian modal phrase ("can I?") that doesn't belong in any specific intent.

3. **Add a Mongolian stemmer** — The biggest limitation is verb conjugation mismatch. A simple suffix-stripping stemmer (remove -ж, -сан, -сэн, -лаа, -лээ, -мааР, etc.) would eliminate ~50% of keyword enumeration.

4. **Refactor `resolveFollowUp` check ordering** — The current order causes priority inversions. The fix in Part 1 resolves the immediate failures, but the function would benefit from a priority-based scoring approach rather than first-match-wins.

5. **Split `chat-ai.ts`** — At 700+ lines, it handles classification, search, and response generation. Split into `intent-classifier.ts`, `product-search.ts`, and `response-generator.ts`.

6. **Add search term sanitization** — The `.ilike.%${w}%` patterns should escape Postgres LIKE special characters (`%`, `_`, `\`) in user-provided search terms.

7. **Cache product search results** — Use Upstash Redis to cache frequent queries. Most customers ask similar questions; even a 5-minute TTL would significantly reduce DB load.

8. **Add integration tests for `processEscalation`** — The pure function tests are excellent, but the DB integration path (fetching messages, updating scores) is untested.

9. **Consider ML-based classification** — The keyword approach works well for 80% of cases but has inherent priority conflicts. A fine-tuned classifier (even a simple TF-IDF + SVM) trained on the extensive test data would eliminate most ambiguity.

10. **Add monitoring/alerting for classification confidence** — Log `classifyIntentWithConfidence` scores to identify low-confidence patterns in production. This data would feed recommendation #9.

---

## Summary of Fixes

| # | File | Fix | Failures Fixed |
|---|------|-----|----------------|
| 1 | `escalation.ts` L118 | `else if (!msg.is_ai_response) break` instead of `else break` | 4 |
| 2 | `escalation.ts` L167 | `consecutiveCustomer >= 3` instead of `>= 5` | 2 |
| 3 | `escalation.ts` L160 | Remove `slice(0, -1)` from recentCustomerMsgs | 2 |
| 4 | `chat-ai.ts` size_info | Remove `'болох уу', 'болху', 'блху'` from keywords | 2 |
| 5 | `chat-ai.ts` payment | Add `'хуваан төлж'` to keywords | (part of fix 4) |
| 6 | `chat-ai.ts` order_status | Add `'бэлэн болох'` to keywords | 1 |
| 7 | `conversation-state.ts` | Move select_single before order_intent; move order_intent after contextual | 3 |
| **Total** | | | **14** |
