#!/usr/bin/env bash
# PostToolUse hook: notify Slack after a production deploy command runs.
#
# Triggers on Bash commands that look like production deploys:
#   • git push origin main (or master)
#   • vercel --prod
#   • vercel deploy --prod
#   • gh workflow run deploy
#
# Requires SLACK_WEBHOOK_URL env var — falls back silent if not set.
# (Store it in ~/.claude/settings.json env, or export in your shell rc.)
#
# Behavior: fires AFTER the command completed. Best-effort; never blocks the
# workflow and always returns exit 0 so the pipeline continues.

set +e

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
[[ "$tool_name" != "Bash" ]] && exit 0

cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"
lc="$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')"

is_deploy=0
kind="Deploy"
if [[ "$lc" =~ git[[:space:]]+push[[:space:]]+origin[[:space:]]+(main|master)([[:space:]]|$) ]] \
  || [[ "$lc" =~ git[[:space:]]+push[[:space:]]+origin[[:space:]]+(main|master)$ ]]; then
  is_deploy=1; kind="Git push to main"
fi
if [[ "$lc" =~ vercel[[:space:]]+.*--prod ]]; then
  is_deploy=1; kind="Vercel --prod deploy"
fi
if [[ "$lc" =~ vercel[[:space:]]+deploy ]] && [[ "$lc" =~ --prod ]]; then
  is_deploy=1; kind="Vercel deploy --prod"
fi

[[ "$is_deploy" -eq 0 ]] && exit 0

# Did the command succeed? The hook payload includes tool_response when PostToolUse.
success="$(printf '%s' "$payload" | jq -r '.tool_response.success // .tool_response.is_error // "unknown"')"

webhook="${SLACK_WEBHOOK_URL:-}"
if [[ -z "$webhook" ]]; then
  # Fall back to a local log so the user has a record even without Slack set up
  log_dir="$(dirname "$0")/.deploy-log"
  mkdir -p "$log_dir"
  echo "$(date '+%Y-%m-%d %H:%M:%S')  [${kind}]  success=${success}  cmd=${cmd}" >> "$log_dir/deploys.log"
  exit 0
fi

# Compose Slack message
branch=$(git branch --show-current 2>/dev/null || echo "unknown")
commit=$(git log -1 --pretty=format:'%h %s' 2>/dev/null || echo "unknown")
user=$(git config user.name 2>/dev/null || whoami)

emoji="🚀"
color="#36a64f"
if [[ "$success" == "false" || "$success" == "true" && "$kind" == *"error"* ]]; then
  emoji="⚠️"
  color="#ff9900"
fi

json=$(jq -n \
  --arg kind "$kind" \
  --arg branch "$branch" \
  --arg commit "$commit" \
  --arg user "$user" \
  --arg emoji "$emoji" \
  --arg color "$color" \
  '{
    attachments: [{
      color: $color,
      blocks: [
        { type: "header", text: { type: "plain_text", text: ($emoji + " Temuulel " + $kind) } },
        { type: "section", fields: [
            { type: "mrkdwn", text: ("*Branch:* " + $branch) },
            { type: "mrkdwn", text: ("*By:* " + $user) },
            { type: "mrkdwn", text: ("*Commit:* `" + $commit + "`") }
          ]
        }
      ]
    }]
  }')

# Fire-and-forget; never fail
curl -s -X POST -H 'Content-Type: application/json' --data "$json" "$webhook" > /dev/null 2>&1 || true

exit 0
