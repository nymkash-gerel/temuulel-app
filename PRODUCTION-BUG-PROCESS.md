# Production Bug Process

## Step-by-Step (do NOT skip steps)

### 1. Log the bug in the false match log below
Before touching any code, add an entry to the False Match Log.

### 2. Add to suspects list
Add the exact user message to `tests/fb-debug2.test.ts` suspects list.

### 3. Run the test, read the output
```bash
npx vitest run tests/fb-debug2.test.ts
```
Understand WHY it misclassifies. Write down which layer caused it.

### 4. Identify the layer
- **Layer 1 — Keyword lists**: A short keyword or substring matched something it shouldn't
- **Layer 2 — Pipeline gates**: A legitimate message got blocked by an early-return
- **Layer 3 — Intent tiebreakers**: Two intents scored equally and the wrong one won

### 5. Write the fix test FIRST
Add a test case to `fb-debug2.test.ts` that currently fails and will pass after your fix.

### 6. Apply the fix
Now fix the code. Run the full test suite to make sure nothing else broke.

### 7. Verify
```bash
npx vitest run tests/fb-debug2.test.ts
npx vitest run  # full suite — all 3,291+ tests must pass
```

---

## Bug Ticket Template

Copy this for each production bug:

```
### Bug: [short description]
**Date:** YYYY-MM-DD
**Reported by:** [pilot customer name / internal]
**Severity:** [blocks-conversation / wrong-response / cosmetic]

**User message (exact):**
> [paste the exact message from FB Messenger logs]

**What happened:**
[What the system did — e.g., "Escalated to human when user was just asking about delivery"]

**What should have happened:**
[Expected behavior — e.g., "Should have classified as order_status and responded with tracking info"]

**Root cause layer:** [1-Keyword / 2-Gate / 3-Tiebreaker]

**Root cause detail:**
[e.g., "'хүн' in escalation keywords matched 'хүндэтгэл' in user's message"]

**Fix applied:**
[e.g., "Replaced 'хүн' with 'хүнтэй ярих' and 'хүн дуудаарай' in escalation.ts"]

**Tests added:**
- [ ] Added user message to fb-debug2.test.ts suspects list
- [ ] Added specific test case for this scenario
- [ ] All tests pass
- [ ] Added to False Match Log below
```

---

## False Match Log

Track every false positive/negative from production here. This becomes your regression dataset.

| # | Date | User Message | Expected Intent | Got Instead | Layer | Keyword/Gate | Fixed? |
|---|------|-------------|-----------------|-------------|-------|-------------|--------|
| 1 | _example_ | хүндэтгэлтэй баярлалаа | greeting | escalation | 1-Keyword | 'хүн' substring | ✅ |
| 2 | _example_ | захиалга өгөх | order_create | blocked (escalated status) | 2-Gate | status check | ✅ |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |

### How to use this log

**Adding entries:** Fill in every column. The "Keyword/Gate" column is the most important — it tells you exactly what went wrong.

**Reviewing periodically:** When you have 10+ entries, look for patterns:
- If most bugs are Layer 1 → your keyword matching approach needs a fundamental change (migrate to word-boundary matching)
- If most bugs are Layer 2 → your gates are too aggressive, switch to allowlist
- If most bugs are Layer 3 → you need better scoring, not just tiebreakers

**Before each release:** Scan the log for any unfixed entries.

---

## Pre-merge Checklist

Before merging any change to escalation.ts, intent-classifier.ts, or pipeline files:

- [ ] No new keywords shorter than 5 characters (run keyword-lint test)
- [ ] Every new keyword tested against COMMON_WORDS for substring matches
- [ ] Every new gate has a test for what should pass through it
- [ ] Every new intent has tiebreakers for overlapping existing intents
- [ ] `npx vitest run tests/fb-debug2.test.ts` passes
- [ ] Full test suite passes
- [ ] False Match Log updated if this fixes a production bug
