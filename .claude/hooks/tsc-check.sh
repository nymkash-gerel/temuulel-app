#!/usr/bin/env bash
# PostToolUse hook: incremental TypeScript check after Edit/Write/MultiEdit.
#
# Runs `tsc --noEmit --incremental` on the whole project (cross-file aware).
# First run is slow (~20-30s), subsequent runs are fast (1-3s) thanks to the
# .tsbuildinfo cache stored outside git.
#
# Behavior:
#   - Only inspects edits to *.ts / *.tsx
#   - On success: emits JSON with suppressOutput: true (silent, no context noise)
#   - On errors:  emits JSON with additionalContext so Claude sees the errors
#                 and can fix them on the next turn
#   - Never blocks the edit itself (PostToolUse can only inform, not reject)
#
# Input:  stdin JSON { "tool_name": "Edit"|"Write"|"MultiEdit",
#                      "tool_input": { "file_path": "..." } }
# Output: stdout JSON

set -uo pipefail

payload="$(cat)"

tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

# Only react to file-mutating tools
case "$tool_name" in
  Edit|Write|MultiEdit|NotebookEdit) ;;
  *)  printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

# Only .ts / .tsx (skip .d.ts generated files and everything else)
case "$file_path" in
  *.ts|*.tsx)  ;;
  *)  printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac
case "$file_path" in
  *.d.ts)  printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

# Resolve project root (CLAUDE_PROJECT_DIR or best effort)
project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$project_dir" || { printf '{"continue":true,"suppressOutput":true}\n'; exit 0; }

# Only run if there's a tsconfig and package.json
if [[ ! -f "tsconfig.json" ]]; then
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

cache_dir=".claude/hooks/.tsc-cache"
mkdir -p "$cache_dir"

tsbuild="$cache_dir/tsbuildinfo"
out="$cache_dir/last-run.log"

# Run tsc. Keep it fast by reusing the incremental cache.
# --pretty=false for stable parseable output; we show it in context.
if npx --no-install tsc --noEmit --incremental --tsBuildInfoFile "$tsbuild" --pretty false > "$out" 2>&1; then
  # Success → silent
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

# Failure — filter to errors that mention the file the user just edited, plus
# a compact total count. tsc error lines look like: `path/to/file.ts(12,5): error TS1234: message`
total=$(grep -Ec '^[^ ].*: error TS[0-9]+:' "$out" || true)
# Best-effort: show errors relating to the edited file first, then up to 15 more
rel="${file_path#"$project_dir/"}"

{
  echo "TypeScript errors detected ($total total) after editing: $rel"
  echo
  echo "--- Errors in the edited file ---"
  grep -F "$rel" "$out" | head -20 || true
  echo
  echo "--- Other errors (first 15) ---"
  grep -Ev "^${rel//./\\.}" "$out" | grep -E '^[^ ].*: error TS[0-9]+:' | head -15 || true
} > "$cache_dir/context.txt"

# Emit JSON with additionalContext so Claude sees and can fix the errors
jq -n --rawfile ctx "$cache_dir/context.txt" '{
  continue: true,
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
exit 0
