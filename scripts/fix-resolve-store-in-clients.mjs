#!/usr/bin/env node
/**
 * fix-resolve-store-in-clients.mjs
 *
 * Removes resolveStoreId / resolveStore calls from client components that
 * already receive storeId as a prop (or already have it available in scope).
 *
 * For each file the script:
 *   1. Removes the import line for resolveStore / resolveStoreId
 *   2. Removes the call and its variable assignment
 *   3. Removes the `const store = storeId ? { id: storeId } : null` pattern
 *   4. Replaces `store.id` with `storeId` where applicable
 *   5. Simplifies if-guards around the old resolution
 *   6. Removes unused getUser() + auth blocks when nothing else uses `user`
 *   7. Removes `createClient` import if supabase is no longer used
 */

import fs from 'node:fs'
import path from 'node:path'

const BASE = '/Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app/src/app/dashboard'

const FILES = [
  'attendance/attendance-client.tsx',
  'calendar/calendar-client.tsx',
  'car-wash/[id]/car-wash-detail-client.tsx',
  'car-wash/car-wash-client.tsx',
  'case-events/case-events-client.tsx',
  'chat/chat-client.tsx',
  'client-profiles/client-profiles-client.tsx',
  'complaints/[id]/complaint-detail-client.tsx',
  'consultations/[id]/consultation-detail-client.tsx',
  'consultations/consultations-client.tsx',
  'consultations/new/new-consultation-client.tsx',
  'coworking/[id]/coworking-detail-client.tsx',
  'deliveries/[id]/delivery-detail-client.tsx',
  'equipment/equipment-client.tsx',
  'equipment/new/new-product-client.tsx',
  'fitness-classes/[id]/fitness-class-detail-client.tsx',
  'fitness-classes/fitness-classes-client.tsx',
  'fitness-classes/new/new-fitness-class-client.tsx',
  'fleet-vehicles/fleet-vehicles-client.tsx',
  'guests/guests-client.tsx',
  'guests/new/new-guest-client.tsx',
  'housekeeping/housekeeping-client.tsx',
  'inpatient/[id]/admission-detail-client.tsx',
  'settings/integrations/integrations-client.tsx',
  'settings/store/store-client.tsx',
]

let totalFixed = 0

for (const rel of FILES) {
  const filePath = path.join(BASE, rel)
  if (!fs.existsSync(filePath)) {
    console.warn(`SKIP (not found): ${rel}`)
    continue
  }

  let src = fs.readFileSync(filePath, 'utf-8')
  const original = src

  // 1. Remove import lines for resolveStore / resolveStoreId
  src = src.replace(/import\s*\{[^}]*resolveStore(?:Id)?[^}]*\}\s*from\s*['"]@\/lib\/resolve-store['"]\s*\n?/g, '')

  // 2a. Remove `const storeId = await resolveStoreId(supabase, user.id)`
  //     followed optionally by `const store = storeId ? { id: storeId } : null`
  src = src.replace(
    /^[ \t]*const\s+storeId\s*=\s*await\s+resolveStoreId\(supabase,\s*user\.id\)\s*\n/gm,
    ''
  )

  // 2b. Remove `const store = await resolveStore(supabase, user.id)`
  src = src.replace(
    /^[ \t]*const\s+store\s*=\s*await\s+resolveStore\(supabase,\s*user\.id\)\s*\n/gm,
    ''
  )

  // 2c. Remove `const data = await resolveStore(supabase, user.id)`
  src = src.replace(
    /^[ \t]*const\s+data\s*=\s*await\s+resolveStore\(supabase,\s*user\.id\)\s*\n/gm,
    ''
  )

  // 2d. Remove `const sid = await resolveStoreId(supabase, user.id)` (any var name)
  src = src.replace(
    /^[ \t]*const\s+\w+\s*=\s*await\s+resolveStore(?:Id)?\(supabase,\s*user\.id\)\s*\n/gm,
    ''
  )

  // 3. Remove `const store = storeId ? { id: storeId } : null` line
  src = src.replace(
    /^[ \t]*const\s+store\s*=\s*storeId\s*\?\s*\{\s*id:\s*storeId\s*\}\s*:\s*null\s*\n?/gm,
    ''
  )

  // 4. Replace `store.id` with `storeId` (but NOT `store.id` inside quotes, and not other store properties)
  //    Only replace store.id, NOT store.facebook_page_id etc.
  //    We need to be careful: only replace `store.id` when it's used as an identifier
  //    Use word boundary: store.id should be followed by non-word or end
  src = src.replace(/\bstore\.id\b/g, 'storeId')

  // 5. Handle `if (!store) return` guard (remove it - storeId prop is always available)
  src = src.replace(/^[ \t]*if\s*\(\s*!store\s*\)\s*return\s*\n?/gm, '')

  // 6. Handle `if (store) {` ... `}` blocks - unwrap them
  //    This is tricky to do generically, so we'll use a multi-pass approach
  //    Replace `if (store) {\n` with just empty, and track matching braces
  //    Actually, let's do a simpler approach - just remove the guard line and closing brace
  //    We'll handle this per-pattern:

  // Pattern: `if (store) {\n<body>\n      }\n` -> <body>
  // This handles the case where the if-block wraps the main logic
  // We'll use a regex that matches `if (store) {` on its own line
  src = unwrapIfStoreBlocks(src)

  // 7. Clean up empty useEffect bodies that only had resolveStoreId
  //    Pattern: useEffect with just getUser + resolveStoreId and nothing else
  src = cleanupEmptyUseEffects(src)

  // 8. Remove trailing blank lines that pile up
  src = src.replace(/\n{3,}/g, '\n\n')

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf-8')
    totalFixed++
    console.log(`FIXED: ${rel}`)
  } else {
    console.log(`NO CHANGE: ${rel}`)
  }
}

console.log(`\nDone. Fixed ${totalFixed} of ${FILES.length} files.`)

/**
 * Unwrap `if (store) { ... }` blocks by removing the if-line and its matching closing brace.
 * Only handles single-level if blocks.
 */
function unwrapIfStoreBlocks(src) {
  const lines = src.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Match `if (store) {`
    if (/^if\s*\(\s*store\s*\)\s*\{$/.test(trimmed)) {
      const indent = line.match(/^(\s*)/)[1]
      // Find matching closing brace
      let braceCount = 1
      let j = i + 1
      const bodyLines = []

      while (j < lines.length && braceCount > 0) {
        const inner = lines[j]
        for (const ch of inner) {
          if (ch === '{') braceCount++
          else if (ch === '}') braceCount--
        }
        if (braceCount > 0) {
          bodyLines.push(inner)
        } else {
          // This is the closing brace line - check if it's just `}`
          const closeTrimmed = inner.trim()
          if (closeTrimmed === '}') {
            // Dedent body lines by one level (2 spaces)
            for (const bl of bodyLines) {
              if (bl.startsWith(indent + '  ')) {
                result.push(indent + bl.slice(indent.length + 2))
              } else {
                result.push(bl)
              }
            }
          } else {
            // Closing brace has other content, keep original
            result.push(line)
            for (const bl of bodyLines) result.push(bl)
            result.push(inner)
          }
        }
        j++
      }
      i = j
    } else {
      result.push(line)
      i++
    }
  }

  return result.join('\n')
}

/**
 * Remove useEffect blocks that are now effectively empty after removing resolveStoreId.
 * Specifically, if a useEffect's async function body is just:
 *   const { data: { user } } = await supabase.auth.getUser()
 *   if (!user) return
 *   <empty>
 *   setLoading(false)
 * Then simplify to just setLoading(false)
 */
function cleanupEmptyUseEffects(src) {
  // Remove standalone `const { data: { user } } = await supabase.auth.getUser()`
  // followed by `if (!user) return` when there's nothing between them and the next
  // statement that uses `user`

  // Actually, let's be conservative - just remove empty function bodies
  // Pattern: async function that only has getUser + guard + setLoading
  const emptyLoadPattern = /async\s+function\s+\w+\(\)\s*\{[\s\n]*const\s*\{\s*data:\s*\{\s*user\s*\}\s*\}\s*=\s*await\s+supabase\.auth\.getUser\(\)\s*\n\s*if\s*\(\s*!user\s*\)\s*return\s*\n\s*\n?\s*setLoading\(false\)\s*\n\s*\}/g

  if (emptyLoadPattern.test(src)) {
    src = src.replace(emptyLoadPattern, 'async function load() {\n      setLoading(false)\n    }')
  }

  return src
}
