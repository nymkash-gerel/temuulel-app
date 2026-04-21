#!/usr/bin/env bash
# PostToolUse hook: warn when a new API route is missing rate limiting or
# auth checks. Points out common anti-patterns:
#   - No rateLimit() / getClientIp() call
#   - No supabase.auth.getUser() for authenticated routes
#   - user_id / store_id read directly from request body (spoof-able)
#
# Allowlist (these legitimately bypass standard auth):
#   - src/app/api/webhook/**     — uses HMAC signature verification
#   - src/app/api/cron/**        — uses CRON_SECRET header
#   - src/app/api/health/**      — public liveness
#   - src/app/api/chat/widget/** — public embed, scoped by store_id token
#   - src/app/api/data-deletion  — uses Facebook signed_request
#
# Never blocks — emits additionalContext so Claude can fix it on the next turn.

set -uo pipefail

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

case "$tool_name" in Edit|Write|MultiEdit) ;;
  *) printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

# Only API route files
case "$file_path" in
  */src/app/api/*/route.ts|*/src/app/api/*/route.tsx) ;;
  *) printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

# Allowlist — these routes have their own auth mechanism
case "$file_path" in
  */src/app/api/webhook/*|*/src/app/api/cron/*|*/src/app/api/health/*|*/src/app/api/chat/widget/*|*/src/app/api/data-deletion/*)
    printf '{"continue":true,"suppressOutput":true}\n'
    exit 0
    ;;
esac

[[ ! -f "$file_path" ]] && { printf '{"continue":true,"suppressOutput":true}\n'; exit 0; }

content="$(cat "$file_path")"

# Determine which HTTP methods are exported
has_post=0; has_put=0; has_patch=0; has_delete=0; has_get=0
grep -qE 'export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+POST\b|export.*POST[[:space:]]*=' <<< "$content" && has_post=1
grep -qE 'export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+PUT\b|export.*PUT[[:space:]]*='   <<< "$content" && has_put=1
grep -qE 'export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+PATCH\b|export.*PATCH[[:space:]]*=' <<< "$content" && has_patch=1
grep -qE 'export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+DELETE\b|export.*DELETE[[:space:]]*=' <<< "$content" && has_delete=1
grep -qE 'export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+GET\b|export.*GET[[:space:]]*='   <<< "$content" && has_get=1

# Signals (checks)
has_rate_limit=0
has_auth=0
reads_user_id_from_body=0
reads_store_id_from_body=0

grep -qiE 'ratelimit|rate_limit|rate-limit|Ratelimit' <<< "$content" && has_rate_limit=1
grep -qE 'supabase\.auth\.getUser\(|auth\.getUser\(' <<< "$content" && has_auth=1

# Very conservative: flag if we see `user_id:` or `userId:` as a destructured body prop
# from `req.json()` / `req.body` that looks authoritative.
if grep -qE '(const|let)[[:space:]]*\{[^}]*\b(user_id|userId|user|currentUserId)\b[^}]*\}[[:space:]]*=[[:space:]]*(await[[:space:]]+)?(req|request)\.(json|body)' <<< "$content"; then
  reads_user_id_from_body=1
fi
if grep -qE '(const|let)[[:space:]]*\{[^}]*\b(store_id|storeId)\b[^}]*\}[[:space:]]*=[[:space:]]*(await[[:space:]]+)?(req|request)\.(json|body)' <<< "$content"; then
  reads_store_id_from_body=1
fi

mutating=$(( has_post + has_put + has_patch + has_delete ))

issues=""
if [[ "$mutating" -gt 0 && "$has_rate_limit" -eq 0 ]]; then
  issues="${issues}  - no rateLimit() / Upstash call found — mutating endpoint needs rate limiting.\n"
fi
if [[ "$mutating" -gt 0 && "$has_auth" -eq 0 ]]; then
  issues="${issues}  - no supabase.auth.getUser() call — mutating endpoint needs auth.\n"
fi
if [[ "$reads_user_id_from_body" -eq 1 ]]; then
  issues="${issues}  - reads user_id from request body — this can be spoofed. Use supabase.auth.getUser() instead.\n"
fi
if [[ "$reads_store_id_from_body" -eq 1 ]]; then
  issues="${issues}  - reads store_id from request body — derive from authenticated session (store_members lookup) instead.\n"
fi

if [[ -z "$issues" ]]; then
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

rel="${file_path##*/src/app/api/}"
ctx="API route guardrails check for src/app/api/${rel}:\n\n${issues}\n"
ctx="${ctx}Reference patterns:\n"
ctx="${ctx}  - Rate limit: import { rateLimit, getClientIp } from '@/lib/rate-limit'\n"
ctx="${ctx}    const rl = await rateLimit(getClientIp(req), { limit: 30, windowSeconds: 60 })\n"
ctx="${ctx}    if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })\n\n"
ctx="${ctx}  - Auth:       const { data: { user } } = await supabase.auth.getUser()\n"
ctx="${ctx}               if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n\n"
ctx="${ctx}  - Store ID:  resolve via store_members lookup against the authenticated user, never from request body."

jq -n --arg c "$(printf '%b' "$ctx")" '{
  continue: true,
  suppressOutput: true,
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: $c }
}'
exit 0
