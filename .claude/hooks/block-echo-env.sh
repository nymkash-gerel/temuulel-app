#!/usr/bin/env bash
# PreToolUse hook for Bash: block `echo "..." | <cli> env add|secrets set|...`
#
# Why: echo appends a trailing newline. Piping into tools that store the stdin
# verbatim as a secret (vercel env add, supabase secrets set, wrangler secret
# put, fly secrets set, heroku config:set, gh secret set, doppler secrets set)
# embeds the \n into the stored value. On production this breaks everything
# that reads the secret (e.g. URL becomes "https://x.supabase.co\n" → DNS/TLS
# fails → 500 on every request). This trap cost us ~30 minutes in April 2026.
#
# Fix suggested: use `printf '%s'` (no trailing newline) instead.
#
# Input:  JSON on stdin with { "tool_name": "Bash", "tool_input": { "command": "..." } }
# Output: exit 0 to allow, exit 2 with message on stderr to block.

set -euo pipefail

# Read the full JSON payload from stdin
payload="$(cat)"

# Extract fields with jq (available in Claude Code sandbox)
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // ""')"

# Only inspect Bash tool calls
if [[ "$tool_name" != "Bash" ]]; then
  exit 0
fi

# Pattern: `echo [anything] | [anything] (env add|secrets set|secret put|config:set|secret set)`
# Also catch the same via ``$(echo ...)``/backticks less common — the pipe form is the usual footgun.
# Use a permissive regex and lowercase the command for matching.
lc="$(printf '%s' "$command" | tr '[:upper:]' '[:lower:]')"

if [[ "$lc" =~ echo[[:space:]].*\|.*(env[[:space:]]+add|secrets[[:space:]]+set|secret[[:space:]]+put|config:set|secret[[:space:]]+set|secrets[[:space:]]+create) ]]; then
  cat >&2 <<'EOF'
🚫 Blocked: `echo "..." | ... (env add|secrets set|...)` embeds a trailing newline in the stored secret.

This broke production in April 2026 when NEXT_PUBLIC_SUPABASE_URL became
"https://xxx.supabase.co\n" and every request hit 500.

Fix: use printf without the newline, e.g.

  printf '%s' 'https://x.supabase.co' | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production

Or pipe from a file that has no trailing newline, or use the --value flag when
the tool supports it. After setting a secret, verify with:

  npx vercel env pull .env.check --environment=production && cat .env.check | grep -F 'YOUR_KEY'

and confirm no literal \n is present.
EOF
  exit 2
fi

exit 0
