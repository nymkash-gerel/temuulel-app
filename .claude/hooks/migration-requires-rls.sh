#!/usr/bin/env bash
# PostToolUse hook: warn when a Supabase migration creates a table but does
# not enable Row-Level Security + attach policies.
#
# Multi-tenant rule (CLAUDE.md): every table has a store_id and RLS enforces
# per-store isolation. A table without RLS is a silent data-leak vector —
# a mistake here leaks every store's data to every other store.
#
# Behavior:
#   - Only triggers on files under supabase/migrations/*.sql
#   - Reads the CURRENT file contents (after Write/Edit applied)
#   - If content has `CREATE TABLE` without `ENABLE ROW LEVEL SECURITY` on
#     the same table, emit additionalContext so Claude adds the missing bits.
#   - Never blocks (false-positives during multi-step editing would hurt).

set -uo pipefail

payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // ""')"
file_path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.filePath // ""')"

case "$tool_name" in Edit|Write|MultiEdit) ;;
  *) printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

# Only migration files
case "$file_path" in
  */supabase/migrations/*.sql) ;;
  *) printf '{"continue":true,"suppressOutput":true}\n'; exit 0 ;;
esac

[[ ! -f "$file_path" ]] && { printf '{"continue":true,"suppressOutput":true}\n'; exit 0; }

# Collect CREATE TABLE statements (table names) and RLS-enabled table names.
# Ignore CREATE TABLE IF NOT EXISTS variants by normalizing.
created=$(grep -iE '^[[:space:]]*create[[:space:]]+table([[:space:]]+if[[:space:]]+not[[:space:]]+exists)?[[:space:]]+' "$file_path" \
  | sed -E 's/^[[:space:]]*[cC][rR][eE][aA][tT][eE][[:space:]]+[tT][aA][bB][lL][eE]([[:space:]]+[iI][fF][[:space:]]+[nN][oO][tT][[:space:]]+[eE][xX][iI][sS][tT][sS])?[[:space:]]+//' \
  | awk '{print $1}' \
  | tr -d '"' | tr -d ',' | tr -d '(' \
  | sort -u)

[[ -z "$created" ]] && { printf '{"continue":true,"suppressOutput":true}\n'; exit 0; }

rls_enabled=$(grep -iE 'alter[[:space:]]+table[[:space:]]+[^[:space:]]+[[:space:]]+enable[[:space:]]+row[[:space:]]+level[[:space:]]+security' "$file_path" \
  | sed -E 's/.*[aA][lL][tT][eE][rR][[:space:]]+[tT][aA][bB][lL][eE][[:space:]]+//i' \
  | awk '{print $1}' | tr -d '"' | sort -u)

missing_rls=""
missing_policy=""

while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  if ! echo "$rls_enabled" | grep -qFx "$table"; then
    missing_rls="${missing_rls}  - ${table}\n"
  fi
  # Check for at least one CREATE POLICY on this table
  if ! grep -iE "create[[:space:]]+policy[[:space:]]+[^[:space:]]+[[:space:]]+on[[:space:]]+${table}([[:space:]]|\$)" "$file_path" > /dev/null; then
    missing_policy="${missing_policy}  - ${table}\n"
  fi
done <<< "$created"

if [[ -z "$missing_rls" && -z "$missing_policy" ]]; then
  printf '{"continue":true,"suppressOutput":true}\n'
  exit 0
fi

ctx="Migration created tables without complete RLS setup in ${file_path##*/}:\n\n"
if [[ -n "$missing_rls" ]]; then
  ctx="${ctx}Missing 'ENABLE ROW LEVEL SECURITY' for:\n${missing_rls}\n"
fi
if [[ -n "$missing_policy" ]]; then
  ctx="${ctx}Missing 'CREATE POLICY ... ON <table>' for:\n${missing_policy}\n"
fi
ctx="${ctx}\nMulti-tenancy rule: every table must have RLS + at least one policy. Add:\n\n  ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;\n  CREATE POLICY \"<name>_own\" ON <name> FOR ALL USING (store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid()));"

jq -n --arg c "$(printf '%b' "$ctx")" '{
  continue: true,
  suppressOutput: true,
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: $c }
}'
exit 0
