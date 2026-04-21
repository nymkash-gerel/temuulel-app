#!/usr/bin/env bash
# PreToolUse hook for Bash: block destructive commands that could wipe
# production data or destroy shared git history.
#
# Blocks:
#   • supabase db reset (with or without --linked) — can wipe remote DB
#   • supabase db push --include-all WITH --linked on a prod ref
#   • git push --force / --force-with-lease to main | master | prod
#   • git reset --hard origin/main (and variants)
#   • git branch -D main | master
#   • rm -rf / (obvious)
#   • DROP DATABASE, DROP TABLE without qualifier (run via psql/supabase)
#
# These should be run manually in a terminal by a human who understands the
# blast radius — never automatically by Claude.
#
# Input:  stdin JSON
# Output: exit 0 to allow, exit 2 to block

set -uo pipefail

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
[[ "$tool_name" != "Bash" ]] && exit 0

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"
lc="$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')"

reason=""

# Supabase destructive
if [[ "$lc" =~ supabase[[:space:]]+db[[:space:]]+reset ]]; then
  reason="supabase db reset — destroys all data. Run manually in terminal."
fi

# git push --force to protected branches
if [[ "$lc" =~ git[[:space:]]+push.*(-f|--force|--force-with-lease) ]]; then
  if [[ "$lc" =~ (main|master|prod|production|release) ]]; then
    reason="git push --force to a protected branch. Manual confirmation required."
  fi
fi

# git reset --hard to remote main/master
if [[ "$lc" =~ git[[:space:]]+reset[[:space:]]+--hard ]]; then
  if [[ "$lc" =~ origin/(main|master|prod) ]]; then
    reason="git reset --hard to remote tracking branch — rewrites local history irreversibly."
  fi
fi

# git branch -D main|master|prod
if [[ "$lc" =~ git[[:space:]]+branch[[:space:]]+-d[[:space:]]+(main|master|prod|production) ]]; then
  reason="git branch -D on a protected branch."
fi

# rm -rf /
if [[ "$cmd" =~ rm[[:space:]]+-rf?[[:space:]]+/([[:space:]]|$) ]]; then
  reason="rm -rf / — refusing absolute root deletion."
fi

# DROP DATABASE / DROP TABLE (anywhere in the command text)
if [[ "$lc" =~ drop[[:space:]]+(database|schema)[[:space:]] ]]; then
  reason="DROP DATABASE/SCHEMA — run manually in a DB console."
fi
# DROP TABLE (but allow "drop table if exists" inside migrations written to files via heredoc — those are Write tool, not Bash)
if [[ "$lc" =~ drop[[:space:]]+table[[:space:]]+ ]] && [[ ! "$lc" =~ "if[[:space:]]+exists" ]] && [[ "$lc" =~ (psql|execute_sql|supabase[[:space:]]+db) ]]; then
  reason="DROP TABLE via psql/supabase — run manually after confirming you're on the right project."
fi

# TRUNCATE without WHERE (nonsensical but defensive)
if [[ "$lc" =~ truncate[[:space:]]+table ]] && [[ "$lc" =~ (psql|execute_sql|supabase[[:space:]]+db) ]]; then
  reason="TRUNCATE TABLE — run manually in a DB console."
fi

if [[ -n "$reason" ]]; then
  {
    echo "🚫 Blocked destructive command: $reason"
    echo ""
    echo "Command: $cmd"
    echo ""
    echo "If you are absolutely sure, run this manually in your terminal."
    echo "If you want to bypass this hook for one call, use Claude Code's"
    echo "settings.local.json to temporarily disable PreToolUse on Bash."
  } >&2
  exit 2
fi

exit 0
