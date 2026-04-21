#!/usr/bin/env bash
# PreToolUse hook: forbid `as any` in production TypeScript code.
#
# CLAUDE.md rule: "No `as any` in production code. Use `as unknown as T`
# with a comment explaining why, only when unavoidable."
#
# Allowlist (these paths may legitimately use `as any`):
#   - *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx — test mocks
#   - scripts/**                                    — throwaway scripts
#   - tests/**, __tests__/**, __mocks__/**          — test fixtures
#
# Line-level exception: if the same line contains `eslint-disable` or
# `as unknown as ` (the CLAUDE.md-approved escape hatch), allow.
#
# Behavior: exit 2 to block, with an explanation.

set -uo pipefail

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"

case "$tool_name" in Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

# Only .ts / .tsx
case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Allowlist paths
case "$file_path" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) exit 0 ;;
  */scripts/*|*/tests/*|*/__tests__/*|*/__mocks__/*|*/__fixtures__/*) exit 0 ;;
esac

# Extract the content being written
content="$(printf '%s' "$payload" | jq -r '
  [
    .tool_input.content      // empty,
    .tool_input.new_string   // empty,
    ((.tool_input.edits // []) | map(.new_string // "") | join("\n"))
  ] | join("\n")
')"

[[ -z "$content" ]] && exit 0

# Find `as any` occurrences, line by line, rejecting ones with approved escapes.
# Regex matches word-boundary `as any` (case sensitive).
violations=$(printf '%s\n' "$content" | grep -nE '\bas[[:space:]]+any\b' || true)

# Filter out lines that also have an escape hatch on the same line
filtered=""
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  if echo "$line" | grep -qE 'eslint-disable|as[[:space:]]+unknown[[:space:]]+as|//.*intentional|//.*safe[[:space:]]*cast'; then
    continue
  fi
  filtered="${filtered}${line}"$'\n'
done <<< "$violations"

if [[ -z "$filtered" ]]; then
  exit 0
fi

{
  echo "🚫 Blocked: 'as any' in production TypeScript code ($file_path)"
  echo ""
  echo "Offending line(s):"
  printf '%b' "$filtered" | head -5
  echo ""
  echo "Project convention (CLAUDE.md): use 'as unknown as T' with a comment"
  echo "explaining why, and only when absolutely unavoidable."
  echo ""
  echo "Common fixes:"
  echo "  • Supabase typed client narrowing:"
  echo "      const { data } = await (supabase as unknown as { from: ... })"
  echo "      // or add the relevant type to src/lib/database.types.ts"
  echo "  • External lib untyped response:"
  echo "      const result = (raw as unknown) as MyType"
  echo "      // narrow with a runtime check (zod) instead if possible"
  echo "  • eslint-disable-next-line @typescript-eslint/no-explicit-any"
  echo "    on the same or preceding line also satisfies this hook."
} >&2

exit 2
