# Temuulel — Claude Code Hooks

This project ships 11 Claude Code hooks (`.claude/hooks/*.sh`) that enforce
safety, speed up feedback loops, and protect architectural invariants across
every Claude session.

Hooks are wired up in `.claude/settings.json` and live under version control
so every team member + subagent gets the same guardrails.

---

## Table of contents

| # | Hook | Event | Category | Blocks? |
|---|------|-------|----------|---------|
| 1 | [block-echo-env.sh](./hooks/block-echo-env.sh) | PreToolUse / Bash | Safety | Yes |
| 2 | [tsc-check.sh](./hooks/tsc-check.sh) | PostToolUse / Edit | Fast-feedback | No |
| 3 | [block-secrets.sh](./hooks/block-secrets.sh) | PreToolUse / Write | Safety | Yes |
| 4 | [block-destructive-bash.sh](./hooks/block-destructive-bash.sh) | PreToolUse / Bash | Safety | Yes |
| 5 | [vitest-run.sh](./hooks/vitest-run.sh) | PostToolUse / Edit | Fast-feedback | No |
| 6 | (merged with #4) | — | — | — |
| 7 | [migration-requires-rls.sh](./hooks/migration-requires-rls.sh) | PostToolUse / Edit | Invariant | No |
| 8 | [api-route-guardrails.sh](./hooks/api-route-guardrails.sh) | PostToolUse / Edit | Invariant | No |
| 9 | [forbid-as-any.sh](./hooks/forbid-as-any.sh) | PreToolUse / Write | Invariant | Yes |
| 10 | [session-start-briefing.sh](./hooks/session-start-briefing.sh) | SessionStart | Context | No |
| 11 | [slack-deploy-notify.sh](./hooks/slack-deploy-notify.sh) | PostToolUse / Bash | Observability | No |

---

## The four hook categories

### 1. Safety (prevent known bugs / data loss)

Block dangerous actions at the source. Past incidents codified as
machine-enforceable rules.

- **#1 block-echo-env**: `echo "..." | vercel env add` bakes a `\n`
  into the secret. In April 2026 this broke production for 30+ minutes —
  `NEXT_PUBLIC_SUPABASE_URL` became `"https://x.supabase.co\n"` → DNS fails →
  every request 500s. Hook blocks and suggests `printf '%s'`.
- **#3 block-secrets**: scans content being written for real API-key
  formats (13 types: Supabase, OpenAI, Facebook, GitHub, Slack, Google, AWS,
  Stripe, PEM private keys) and blocks with a masked preview.
- **#4 block-destructive-bash**: blocks `supabase db reset`,
  `git push --force origin main|master|prod`, `git reset --hard origin/main`,
  `git branch -D main`, `rm -rf /`, `DROP DATABASE`, `TRUNCATE`, etc.

### 2. Fast-feedback (replace slow CI loops with fast local ones)

- **#2 tsc-check**: `tsc --noEmit --incremental` after `.ts/.tsx` edits.
  First run ~20s, subsequent ~1-3s via `.tsc-cache/tsbuildinfo`. Errors
  land in `additionalContext` so Claude can fix them next turn.
- **#5 vitest-run**: `vitest run <file>` scoped to the edited test file
  (~300-500ms). Failures surfaced via context.

### 3. Invariant enforcement (architectural rules)

- **#7 migration-requires-rls**: warns when `supabase/migrations/*.sql`
  creates a table but is missing `ENABLE ROW LEVEL SECURITY` or
  `CREATE POLICY`. Multi-tenant rule: every table must be RLS-protected.
- **#8 api-route-guardrails**: warns when a mutating API route
  (`src/app/api/*/route.ts` with POST/PUT/PATCH/DELETE) is missing
  `rateLimit()` or `supabase.auth.getUser()`, or reads `user_id` / `store_id`
  directly from the request body (spoofable).
- **#9 forbid-as-any**: blocks `as any` in production `.ts/.tsx` code.
  CLAUDE.md convention: use `as unknown as T` with an explanatory comment.

### 4. Context + observability

- **#10 session-start-briefing**: injects branch state, uncommitted
  changes, last 3 commits, next migration number, open PRs, failing CI into
  Claude's context at session start.
- **#11 slack-deploy-notify**: after `git push origin main` or
  `vercel --prod`, posts a Slack message if `SLACK_WEBHOOK_URL` is set,
  otherwise writes to `.claude/hooks/.deploy-log/deploys.log`.

---

## Configuration

### Shared (versioned) settings

`.claude/settings.json` — checked in, applies to everyone:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "PreToolUse":  [ ... ],
    "PostToolUse": [ ... ],
    "SessionStart":[ ... ]
  }
}
```

### Per-user overrides

`.claude/settings.local.json` — gitignored. Use to:

- Disable a noisy hook temporarily
- Add personal hooks (e.g. your own lint preferences)
- Set local env vars like `SLACK_WEBHOOK_URL`

Example `settings.local.json`:

```json
{
  "env": {
    "SLACK_WEBHOOK_URL": "https://hooks.slack.com/services/T00/B00/XXXX"
  }
}
```

### Environment dependencies

All hook scripts use:

- `bash` (/usr/bin/env bash)
- `jq` (for JSON in/out)
- `grep -E` (ERE regex)

Plus, per hook:

- #2 tsc-check: `npx tsc` (from devDependencies)
- #5 vitest-run: `npx vitest` (from devDependencies)
- #10 session-start: `git`, optionally `gh` CLI (PRs/CI)
- #11 slack-deploy: `curl`, optionally `$SLACK_WEBHOOK_URL`

---

## Testing a hook manually

Pipe a mock JSON payload into the script:

```bash
# PreToolUse on Bash — sad path
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"echo v | vercel env add"}}' \
  | .claude/hooks/block-echo-env.sh
echo "exit=$?"  # expect 2
```

```bash
# PostToolUse on Edit — happy path (silent)
printf '%s' '{"tool_name":"Edit","tool_input":{"file_path":"src/lib/foo.ts"}}' \
  | .claude/hooks/tsc-check.sh
# expect {"continue":true,"suppressOutput":true}
```

---

## Temporarily bypassing a hook

If you're SURE you need to bypass:

1. **One-off**: copy the command into your terminal and run it directly.
   Claude Code hooks only apply to tool calls from inside the Claude session.
2. **Long-term**: edit `.claude/settings.local.json` to drop the hook
   entry. This change isn't committed, so it stays per-user.
3. **For a specific PR**: add a line-level escape when the hook supports
   one (`// eslint-disable-line` or `as unknown as T` for #9, or add the
   path to the allowlist at the top of the hook script for #3/#8/#9).

**Never** disable safety hooks (#1, #3, #4) globally. Past incidents led to
these — bypassing them re-opens known production footguns.

---

## Adding a new hook

1. Create `.claude/hooks/my-hook.sh`:
   ```bash
   #!/usr/bin/env bash
   set -uo pipefail
   payload="$(cat)"
   tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
   # ... your logic ...
   exit 0          # or exit 2 to block a PreToolUse
   ```
2. `chmod +x .claude/hooks/my-hook.sh`
3. Add an entry to `.claude/settings.json` under the right event:
   ```json
   {
     "matcher": "Bash",
     "hooks": [
       { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/my-hook.sh" }
     ]
   }
   ```
4. Test locally with a sample JSON payload (see above).
5. Commit `hooks/my-hook.sh` + `settings.json` — share with the team.

---

## JSON output reference

Every hook reads JSON on stdin; most emit JSON on stdout.

**Allow silently (success, no context added):**
```json
{"continue":true,"suppressOutput":true}
```

**Allow + inject context for Claude:**
```json
{
  "continue": true,
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Tests failed: ..."
  }
}
```

**Block a PreToolUse:**
```bash
echo "Why the operation is blocked" >&2
exit 2
```

---

## Incident history → hook origin

| Date | Incident | Hook |
|------|----------|------|
| 2026-04-17 | `echo \|` added `\n` to Supabase URL → prod 500 for 30+ min | #1 |
| — | TypeScript errors only caught in 4-min Vercel build | #2 |
| — | Supabase service_role key nearly committed to a `.ts` file | #3 |
| — | Risk of `supabase db reset --linked` wiping prod | #4 |
| — | Tests not run before pushing to CI | #5 |
| — | Missed RLS policies on multi-tenant tables | #7 |
| — | API routes missing rate-limit / auth leaking to prod | #8 |
| — | CLAUDE.md "no `as any`" rule only enforced in code review | #9 |

Each time we codify an incident, every future session is safer from it.

---

## Maintenance

- Review quarterly: are all hooks still useful, or have they decayed into
  noise? Remove the ones with >10% false-positive rate.
- When a new class of bug lands in prod, convert the postmortem into a
  hook — take a minute to ask "could a hook have blocked this?"
- Keep hook scripts under 200 lines each; if logic grows, call a Node/Python
  script from the bash wrapper instead.
