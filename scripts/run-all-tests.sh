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

# ── Group 8: Image Recognition (GPT-4o Vision) ──
run_group "Image Recognition (Vision)" \
  src/lib/ai/image-recognizer.test.ts

# ── Group 9: Voice Transcription (Whisper) ──
run_group "Voice Transcription (Whisper)" \
  src/lib/ai/openai-vision-whisper.test.ts

# ── Group 10: Comment Auto-Reply ──
run_group "Comment Auto-Reply" \
  src/lib/comment-auto-reply.test.ts \
  src/lib/comment-auto-reply-integration.test.ts

# ── Group 11: AI Quality Scoring ──
run_group "AI Quality Scorer" \
  src/lib/ai/quality-scorer.test.ts

# ── Group 12: REAL AI API tests (optional, costs ~$0.05) ──
if [ "$RUN_REAL_AI" = "1" ]; then
  run_group "REAL AI: Image Recognition" \
    src/lib/ai/image-recognizer-real.test.ts
  run_group "REAL AI: Realistic Scenarios (7 cases)" \
    src/lib/ai/image-recognizer-realistic.test.ts
  run_group "REAL AI: Image → Store Catalog" \
    src/lib/ai/image-to-catalog.test.ts
  run_group "REAL AI: Voice Transcription" \
    src/lib/ai/transcribe-real.test.ts
fi

# ── Group 13: FB Real Comment Stress (12,647 real comments) ──
if [ -d "$HOME/Downloads/this_profile's_activity_across_facebook" ]; then
  echo -e "\n${YELLOW}━━━ FB Real Comments Stress (12,647 real) ━━━${RESET}"
  if npx tsx scripts/stress-test-comment-reply.ts > /tmp/fb-stress.log 2>&1; then
    MATCH_RATE=$(grep "Match rate" /tmp/fb-stress.log | tail -1 | grep -oE '[0-9]+\.[0-9]+%' | head -1)
    PERF=$(grep "comments/sec" /tmp/fb-stress.log | tail -1 | grep -oE '[0-9]+ comments/sec' | head -1)
    echo -e "  ${GREEN}✓ match=${MATCH_RATE}, perf=${PERF}${RESET}"
    RESULTS+=("${GREEN}✓ FB Real Comments (12,647): ${MATCH_RATE} match, ${PERF}${RESET}")
  else
    echo -e "  ${RED}✗ FB comment stress FAILED${RESET}"
    tail -10 /tmp/fb-stress.log
    RESULTS+=("${RED}✗ FB Real Comments: FAILED${RESET}")
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

# ── Group 14: Production Simulation (against live Vercel URL) ──
if [ -n "$SUPABASE_SECRET_KEY" ] || [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "\n${YELLOW}━━━ Production Simulation (6 scenarios, 40 steps) ━━━${RESET}"
  if npx tsx scripts/run-simulations.ts > /tmp/prod-sim.log 2>&1; then
    PASSED=$(grep "Total steps" /tmp/prod-sim.log | tail -1 | grep -oE '[0-9]+/[0-9]+' | head -1)
    SIMS=$(grep "Simulations:" /tmp/prod-sim.log | tail -1 | grep -oE '[0-9]+/[0-9]+' | head -1)
    echo -e "  ${GREEN}✓ ${PASSED} steps, ${SIMS} sims passing${RESET}"
    RESULTS+=("${GREEN}✓ Production Simulation: ${PASSED} steps, ${SIMS} sims${RESET}")
  else
    echo -e "  ${RED}✗ Production simulation FAILED${RESET}"
    tail -20 /tmp/prod-sim.log
    RESULTS+=("${RED}✗ Production Simulation: FAILED${RESET}")
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  fi
fi

# ── Group 15: Order Flow Stress Test (real chat API) ──
if [ -n "$SUPABASE_SECRET_KEY" ] || [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "\n${YELLOW}━━━ Order Flow Stress (20 scenarios) ━━━${RESET}"
  if npx tsx scripts/stress-test-orders.ts > /tmp/order-stress.log 2>&1; then
    ORDER_PASS=$(grep "Results:" /tmp/order-stress.log | tail -1 | grep -oE '[0-9]+/[0-9]+' | head -1)
    echo -e "  ${GREEN}✓ ${ORDER_PASS} order scenarios passed${RESET}"
    RESULTS+=("${GREEN}✓ Order Flow Stress: ${ORDER_PASS}${RESET}")
  else
    echo -e "  ${RED}✗ Order flow stress FAILED${RESET}"
    tail -15 /tmp/order-stress.log
    RESULTS+=("${RED}✗ Order Flow Stress: FAILED${RESET}")
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
