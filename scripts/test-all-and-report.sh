#!/bin/bash
# Temuulel Full Test Suite Runner
# Runs all tests and outputs a structured report for OpenClaw to parse
set -o pipefail

cd ~/ecommerce-chatbot/temuulel-app

echo "═══════════════════════════════════════════════════"
echo "  TEMUULEL FULL TEST SUITE — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════"

PASS=0
FAIL=0
ERRORS=""

# 1. Lint
echo ""
echo "▶ LINT"
if npm run lint 2>&1 | tail -3; then
  echo "✅ Lint: PASS"
  PASS=$((PASS + 1))
else
  echo "🔴 Lint: FAIL"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n- Lint failed"
fi

# 2. Type check
echo ""
echo "▶ TYPE CHECK"
if npx tsc --noEmit 2>&1 | tail -5; then
  echo "✅ Types: PASS"
  PASS=$((PASS + 1))
else
  echo "🔴 Types: FAIL"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n- Type check failed"
fi

# 3. Unit tests
echo ""
echo "▶ UNIT TESTS (Vitest)"
VITEST_OUTPUT=$(npx vitest run 2>&1)
VITEST_EXIT=$?
echo "$VITEST_OUTPUT" | tail -5

if [ $VITEST_EXIT -eq 0 ]; then
  TESTS_PASSED=$(echo "$VITEST_OUTPUT" | grep "Tests" | grep -o '[0-9]* passed' | head -1)
  echo "✅ Vitest: PASS ($TESTS_PASSED)"
  PASS=$((PASS + 1))
else
  TESTS_FAILED=$(echo "$VITEST_OUTPUT" | grep "FAIL " | head -10)
  echo "🔴 Vitest: FAIL"
  echo "$TESTS_FAILED"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n- Vitest failures:\n$TESTS_FAILED"
fi

# 4. Build
echo ""
echo "▶ BUILD"
if npm run build 2>&1 | tail -5; then
  echo "✅ Build: PASS"
  PASS=$((PASS + 1))
else
  echo "🔴 Build: FAIL"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n- Build failed"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════"
echo "  SUMMARY: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSING — ZERO BUGS"
  exit 0
else
  echo ""
  echo "🔴 FAILURES:"
  echo -e "$ERRORS"
  exit 1
fi
