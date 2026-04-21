#!/usr/bin/env bash
# PostToolUse hook: run Vitest on the single test file that was just edited.
#
# Scope:
#   - Triggers when the edited file ends in .test.ts / .test.tsx / .spec.ts /
#     .spec.tsx (test files themselves — not source files)
#   - Runs: npx vitest run <file> --reporter=compact (with a 90s timeout)
#
# Why only on test files, not source files?
#   Running the full suite on every source edit is too slow (a few minutes
#   for this repo). Developers can still run `npm test` manually. Scoping
#   to test files gives feedback exactly when writing/modifying a test.
#
# Behavior:
#   - Pass: silent
#   - Fail: emit additionalContext with compact failure output so Claude
#           can fix the test (or the code it tests) on the next turn
#
# Input:  stdin JSON { tool_name, tool_input.file_path }
# Output: stdout JSON

set -uo pipefail

payload="$(cat)"

tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *)  printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

case "$file_path" in
  *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx) ;;
  *)  printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$project_dir" || { printf '{"continue":true,"suppressOutput":true}\n'; exit 0; }

# Skip if there is no vitest config
if ! [[ -f "vitest.config.ts" || -f "vitest.config.js" || -f "vite.config.ts" || -f "vite.config.js" ]]; then
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

cache_dir=".claude/hooks/.vitest-cache"
mkdir -p "$cache_dir"
out="$cache_dir/last-run.log"

rel="${file_path#"$project_dir/"}"

# Claude Code enforces its own hook timeout (configured in settings.json).
# Don't use `timeout` here — it's not present on default macOS.
if NO_COLOR=1 npx --no-install vitest run "$rel" > "$out" 2>&1; then
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

# Trim the log for context — last 40 lines usually has the failure summary
{
  echo "Vitest failed for $rel"
  echo
  tail -40 "$out"
} > "$cache_dir/context.txt"

jq -n --rawfile ctx "$cache_dir/context.txt" '{
  continue: true,
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
exit 0
