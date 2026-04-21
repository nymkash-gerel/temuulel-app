#!/usr/bin/env bash
# SessionStart hook: load a concise project briefing into Claude's context
# when a new session begins.
#
# Contents (kept short to preserve context budget):
#   • Current branch + ahead/behind main
#   • Uncommitted changes count
#   • Last 3 commit titles
#   • Open PRs (if gh CLI available + authenticated)
#   • Recent failing CI runs (if gh available)
#   • Migration number to use next
#
# Behavior:
#   Emits JSON with additionalContext. Fails silent on any sub-command error
#   (never breaks session startup).

set +e

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$project_dir" 2>/dev/null || { printf '{"continue":true}\n'; exit 0; }

# Read stdin to avoid SIGPIPE even if we don't use it
cat > /dev/null 2>&1 || true

brief=""

# --- Git branch + divergence ---
branch=$(git branch --show-current 2>/dev/null || echo "unknown")
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
if [[ -n "$upstream" ]]; then
  ahead=$(git rev-list --count "${upstream}..HEAD" 2>/dev/null || echo "?")
  behind=$(git rev-list --count "HEAD..${upstream}" 2>/dev/null || echo "?")
  brief+="Branch: ${branch} (ahead ${ahead} / behind ${behind} of ${upstream})"$'\n'
else
  brief+="Branch: ${branch} (no upstream)"$'\n'
fi

# --- Uncommitted changes ---
unstaged=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [[ "$unstaged" -gt 0 ]]; then
  brief+="Uncommitted files: ${unstaged}"$'\n'
fi

# --- Recent commits ---
brief+=$'\nRecent commits:\n'
git log --oneline -3 2>/dev/null | sed 's/^/  /' >> /tmp/.claude-briefing-tmp 2>/dev/null || true
if [[ -s /tmp/.claude-briefing-tmp ]]; then
  brief+=$(cat /tmp/.claude-briefing-tmp)
  brief+=$'\n'
fi
rm -f /tmp/.claude-briefing-tmp

# --- Next migration number ---
last_migration=$(ls supabase/migrations 2>/dev/null | grep -E '^[0-9]+_' | sort | tail -1 | grep -oE '^[0-9]+' || echo "")
if [[ -n "$last_migration" ]]; then
  next=$(printf '%03d' $((10#$last_migration + 1)))
  brief+=$'\n'"Next migration number: ${next}"$'\n'
fi

# --- Open PRs (if gh available) ---
if command -v gh >/dev/null 2>&1; then
  prs=$(gh pr list --limit 5 --json number,title,isDraft --jq '.[] | "  #\(.number) \(.title)\(if .isDraft then " (draft)" else "" end)"' 2>/dev/null)
  if [[ -n "$prs" ]]; then
    brief+=$'\nOpen PRs:\n'"$prs"$'\n'
  fi

  # --- Failing CI on current branch ---
  ci=$(gh run list --branch "$branch" --limit 3 --json status,conclusion,displayTitle --jq '.[] | select(.conclusion=="failure") | "  ✗ \(.displayTitle)"' 2>/dev/null)
  if [[ -n "$ci" ]]; then
    brief+=$'\nRecent failing CI on this branch:\n'"$ci"$'\n'
  fi
fi

# Build JSON output
jq -n --arg b "$brief" '{
  continue: true,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("Project status briefing:\n\n" + $b)
  }
}'
exit 0
