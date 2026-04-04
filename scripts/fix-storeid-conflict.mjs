#!/usr/bin/env node
/**
 * Fix storeId conflict: remove useState<storeId> since it's now a prop.
 * Also remove setStoreId calls and related useEffect storeId resolution.
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const BASE = '/Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app/src/app/dashboard'

const files = execSync(
  `grep -rl "const \\[storeId, setStoreId\\]" --include="*-client.tsx" "${BASE}"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean)

console.log(`Found ${files.length} files with storeId conflict\n`)

let fixed = 0

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf8')
  const original = content

  // Remove: const [storeId, setStoreId] = useState<string | null>(null)
  // Remove: const [storeId, setStoreId] = useState<string>('')
  // Remove: const [storeId, setStoreId] = useState('')
  content = content.replace(
    /\s*const \[storeId, setStoreId\] = useState[^(]*\([^)]*\)\s*\n?/g,
    '\n'
  )

  // Remove setStoreId(...) calls
  content = content.replace(
    /\s*setStoreId\([^)]*\)\s*;?\s*\n?/g,
    '\n'
  )

  // Remove: if (!storeId) return  (after the prop is provided, this is unnecessary)
  // But keep it if it's a meaningful check - only remove the early return pattern inside useEffect
  // Actually, let's keep those - they're valid checks

  if (content !== original) {
    writeFileSync(filePath, content)
    fixed++
    console.log(`FIXED: ${filePath}`)
  }
}

console.log(`\n✅ Done: ${fixed} files fixed`)
