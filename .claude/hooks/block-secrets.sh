#!/usr/bin/env bash
# PreToolUse hook: block Write/Edit/MultiEdit when the content being written
# contains a real-looking secret (API keys, tokens, JWTs).
#
# Moderate policy: whitelist example/test/docs files so curated snippets with
# fake-looking secrets (e.g. in docs/meta-app-review/*) are not blocked.
#
# Input:  stdin JSON
# Output: exit 0 to allow, exit 2 to block with message on stderr.

set -uo pipefail

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"

# Only inspect these mutating tools
case "$tool_name" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

# Whitelist: files where example/fake secrets are legitimate content.
# Basename only for simple matches + path contains checks.
base="$(basename -- "$file_path")"
case "$base" in
  .env.example|.env.template|.env.sample|.env.dist) exit 0 ;;
esac
case "$file_path" in
  *.md|*.mdx)                                 exit 0 ;;
  *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.spec.ts|*.spec.tsx) exit 0 ;;
  */docs/meta-app-review/*)                   exit 0 ;;
  */__tests__/*|*/__fixtures__/*|*/__mocks__/*) exit 0 ;;
  */tests/*)                                  exit 0 ;;
esac

# Extract the content that will be written. Handle:
#   - Write:     tool_input.content
#   - Edit:      tool_input.new_string
#   - MultiEdit: tool_input.edits[].new_string  (concatenated)
content="$(printf '%s' "$payload" | jq -r '
  [
    .tool_input.content      // empty,
    .tool_input.new_string   // empty,
    ((.tool_input.edits // []) | map(.new_string // "") | join("\n"))
  ] | join("\n")
')"

# If empty, nothing to scan
[[ -z "$content" ]] && exit 0

# Patterns for real secrets. Each row is "regex@@label" (@@ is the delimiter
# because '|' appears inside regexes as alternation). Using ERE (grep -E).
declare -a patterns=(
  "sb_secret_[A-Za-z0-9_-]{20,}@@Supabase service role secret"
  "sb_publishable_[A-Za-z0-9_-]{20,}@@Supabase publishable key"
  "eyJhbGciOi[A-Za-z0-9_=-]{10,}\\.eyJ[A-Za-z0-9_=-]{20,}\\.[A-Za-z0-9_=-]{20,}@@JWT (likely Supabase anon/service_role)"
  "sk-proj-[A-Za-z0-9_-]{30,}@@OpenAI project API key"
  "sk-[A-Za-z0-9]{40,}@@OpenAI API key (legacy format)"
  "EAA[A-Za-z0-9]{100,}@@Facebook Page or User Access Token"
  "ghp_[A-Za-z0-9]{36}@@GitHub personal access token"
  "gho_[A-Za-z0-9]{36}@@GitHub OAuth token"
  "ghs_[A-Za-z0-9]{36}@@GitHub server-to-server token"
  "xoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{20,}@@Slack bot token"
  "xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]+@@Slack user token"
  "AIza[0-9A-Za-z_-]{35}@@Google API key"
  "AKIA[0-9A-Z]{16}@@AWS access key ID"
  "whsec_[A-Za-z0-9]{32,}@@Stripe webhook secret"
  "sk_live_[0-9a-zA-Z]{24,}@@Stripe live secret key"
  "rk_live_[0-9a-zA-Z]{24,}@@Stripe live restricted key"
  "BEGIN [A-Z ]*PRIVATE KEY@@Private key block"
)

found=()
for entry in "${patterns[@]}"; do
  regex="${entry%%@@*}"
  label="${entry##*@@}"
  if printf '%s' "$content" | grep -qE -- "$regex"; then
    # Mask the match — show first 8 and last 4 characters
    matched="$(printf '%s' "$content" | grep -oE -- "$regex" | head -1)"
    masked="$(printf '%s' "$matched" | awk '{ if (length($0) > 20) { print substr($0,1,8) "...[REDACTED]..." substr($0,length($0)-3) } else { print substr($0,1,4) "...[REDACTED]" } }')"
    found+=("  • ${label}: ${masked}")
  fi
done

if [[ ${#found[@]} -eq 0 ]]; then
  exit 0
fi

{
  echo "🚫 Blocked: secret(s) detected in content being written to $file_path"
  echo ""
  printf '%s\n' "${found[@]}"
  echo ""
  echo "Do not hardcode secrets in source files. Use environment variables:"
  echo "  • process.env.SUPABASE_SECRET_KEY  (server-side only)"
  echo "  • process.env.NEXT_PUBLIC_SUPABASE_URL  (safe to expose)"
  echo "  • process.env.OPENAI_API_KEY"
  echo ""
  echo "If this really is a fake/example secret, save it to one of the whitelisted"
  echo "locations instead: .env.example, *.md, tests/, docs/meta-app-review/."
  echo ""
  echo "If the secret leaked, rotate it immediately at the provider's dashboard."
} >&2

exit 2
