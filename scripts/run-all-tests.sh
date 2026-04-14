#!/bin/bash
# ============================================================================
# Temuulel — Нэгдсэн stress test
# Бүх тестийг нэг дор ажиллуулж, тайлан гаргана
# Usage: bash scripts/run-all-tests.sh
# ============================================================================

set +e  # Don't exit on individual test failures — we collect results

BOLD='\033[1m'
GREEN='\033[32m'
RED='\033[31m'
CYAN='\033[36m'
YELLOW='\033[33m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║   Temuulel — Нэгдсэн Stress Test            ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0
START=$(date +%s)
RESULTS=()

run_group() {
  local label="$1"
  shift
  local files=("$@")

  echo -e "\n${YELLOW}━━━ ${label} ━━━${RESET}"

  OUTPUT=$(npx vitest run "${files[@]}" --no-color 2>&1)

  # Extract counts
  local pass=$(echo "$OUTPUT" | grep -oE '[0-9]+ passed' | head -1 | grep -oE '[0-9]+' || echo 0)
  local fail=$(echo "$OUTPUT" | grep -oE '[0-9]+ failed' | head -1 | grep -oE '[0-9]+' || echo 0)
  local skip=$(echo "$OUTPUT" | grep -oE '[0-9]+ skipped' | head -1 | grep -oE '[0-9]+' || echo 0)

  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
  TOTAL_SKIP=$((TOTAL_SKIP + skip))

  if [ "$fail" -gt 0 ]; then
    echo -e "  ${RED}✗ ${pass} passed, ${fail} FAILED, ${skip} skipped${RESET}"
    # Show failure details
    echo "$OUTPUT" | grep -A3 "FAIL " | head -20
    RESULTS+=("${RED}✗ ${label}: ${pass}✓ ${fail}✗${RESET}")
  else
    echo -e "  ${GREEN}✓ ${pass} passed, ${skip} skipped${RESET}"
    RESULTS+=("${GREEN}✓ ${label}: ${pass}✓${RESET}")
  fi
}

# ── Group 1: Core AI (intent + response + ML) ──
run_group "Core AI — Intent & Response" \
  src/lib/chat-ai.test.ts \
  src/lib/ai/ml-classifier.test.ts \
  src/app/api/chat/ai/route.test.ts

# ── Group 2: Morphology & NLP ──
run_group "NLP — Morphology & Stemmer" \
  tests/morphology-benchmark.test.ts \
  src/lib/mn-stemmer.test.ts \
  src/lib/text-normalizer.test.ts \
  src/lib/intent-classifier.test.ts

# ── Group 3: Order flow & State ──
run_group "Order Flow & Conversation State" \
  src/lib/conversation-state.test.ts \
  src/lib/status-machine.test.ts

# ── Group 4: Product search ──
run_group "Product Search" \
  src/lib/product-search.test.ts

# ── Group 5: Chat scenarios ──
run_group "Chat Scenarios & Simulation" \
  tests/comprehensive-chat-scenarios.test.ts \
  tests/simulation/simulation.test.ts \
  tests/qa-pro-notebook.test.ts

# ── Group 6: Widget & Facebook ──
run_group "Widget & Facebook Journeys" \
  tests/widget-comprehensive.test.ts \
  tests/fb-real-journeys.test.ts

# ── Group 7: E2E simulation ──
run_group "E2E Simulation (full pipeline)" \
  tests/e2e-simulation.test.ts

# ── Group 8: Latest AI Features (image, voice, comment reply, quality) ──
run_group "Latest AI Features" \
  src/lib/ai/image-recognizer.test.ts \
  src/lib/ai/quality-scorer.test.ts \
  src/lib/ai/openai-vision-whisper.test.ts \
  src/lib/comment-auto-reply.test.ts \
  src/lib/comment-auto-reply-integration.test.ts

# ── Group 8.5: REAL AI API tests (optional, costs ~$0.05) ──
# Run only if RUN_REAL_AI=1 is set
if [ "$RUN_REAL_AI" = "1" ]; then
  run_group "REAL AI API Tests (\$0.05)" \
    src/lib/ai/image-recognizer-real.test.ts \
    src/lib/ai/transcribe-real.test.ts
fi

# ── Group 8.7: FB Real Comment Stress Test (12,647 real comments) ──
if [ -d "$HOME/Downloads/this_profile's_activity_across_facebook" ]; then
  echo -e "\n${YELLOW}━━━ FB Real Comment Auto-Reply Stress ━━━${RESET}"
  if npx tsx scripts/stress-test-comment-reply.ts > /tmp/fb-stress.log 2>&1; then
    MATCH_RATE=$(grep "Match rate" /tmp/fb-stress.log | tail -1 | grep -oE '[0-9]+\.[0-9]+%' | head -1)
    echo -e "  ${GREEN}✓ FB comment stress passed (match rate: ${MATCH_RATE})${RESET}"
    RESULTS+=("${GREEN}✓ FB Real Comments: ${MATCH_RATE} match${RESET}")
  else
    echo -e "  ${RED}✗ FB comment stress FAILED${RESET}"
    tail -10 /tmp/fb-stress.log
    RESULTS+=("${RED}✗ FB Real Comments: FAILED${RESET}")
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

# ── Group 9: All remaining unit tests ──
run_group "Remaining Unit Tests" \
  src/lib/validations.test.ts \
  src/lib/booking-conflict.test.ts \
  src/lib/escalation.test.ts \
  src/lib/rate-limit.test.ts \
  src/lib/response-generator.test.ts

# ── Summary ──
END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}  ТАЙЛАН (Summary)${RESET}"
echo -e "${CYAN}${BOLD}══════════════════════════════════════════════${RESET}"
echo ""

for r in "${RESULTS[@]}"; do
  echo -e "  $r"
done

echo ""
echo -e "  ${BOLD}Нийт: ${GREEN}${TOTAL_PASS} passed${RESET} ${RED}${TOTAL_FAIL} failed${RESET} ${YELLOW}${TOTAL_SKIP} skipped${RESET}"
echo -e "  ${BOLD}Хугацаа: ${ELAPSED} секунд${RESET}"
echo ""

if [ "$TOTAL_FAIL" -gt 0 ]; then
  echo -e "  ${RED}${BOLD}⚠️  ${TOTAL_FAIL} тест УНАСАН!${RESET}"
  exit 1
else
  echo -e "  ${GREEN}${BOLD}✅ Бүх тест PASSED!${RESET}"
  exit 0
fi
