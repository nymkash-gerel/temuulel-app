#!/usr/bin/env node
/**
 * Converts 'use client' page.tsx files to server+client split.
 *
 * For each page.tsx that starts with 'use client':
 * 1. Rename page.tsx → {dirname}-client.tsx
 * 2. Create new server page.tsx that does auth + passes storeId
 * 3. Remove resolveStoreId/auth logic from client component, accept storeId as prop
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { basename, dirname, join } from 'path'

const BASE = '/Users/nyamgerelshijir/ecommerce-chatbot/temuulel-app/src/app/dashboard'

// Find all 'use client' page.tsx files
const files = execSync(
  `grep -rl "^'use client'" "${BASE}" --include="page.tsx"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean)

console.log(`Found ${files.length} client component pages to convert\n`)

let converted = 0
let skipped = 0

for (const filePath of files) {
  const dir = dirname(filePath)
  const dirName = basename(dir)
  const content = readFileSync(filePath, 'utf8')

  // Skip if already has a separate client file
  const clientFileName = `${dirName}-client.tsx`
  const clientFilePath = join(dir, clientFileName)
  if (existsSync(clientFilePath)) {
    console.log(`SKIP (already split): ${filePath}`)
    skipped++
    continue
  }

  // Skip settings pages with special patterns (flows/[id] etc)
  // Skip [id] pages that use params - they need Promise<{id}> handling
  const isDetailPage = dir.includes('[id]')

  // Extract the default export function name
  const funcMatch = content.match(/export default function (\w+)/)
  if (!funcMatch) {
    console.log(`SKIP (no default function): ${filePath}`)
    skipped++
    continue
  }
  const funcName = funcMatch[1]

  // Determine client component name
  // e.g., vouchers → VouchersClient, settings/webhook → WebhookClient
  const clientComponentName = funcName.replace(/Page$/, 'Client')

  // Check if page uses resolveStoreId or resolveStore
  const usesResolveStoreId = content.includes('resolveStoreId')
  const usesResolveStore = content.includes('resolveStore') && !usesResolveStoreId

  // Check if page uses router for auth redirect
  const usesAuthCheck = content.includes('getUser') || content.includes('auth')

  // Check if it's a params page (dynamic route)
  const usesParams = content.includes('params')
  const isParamsPage = dir.includes('[')

  // Modify the client component:
  // 1. Remove resolveStoreId import and usage
  // 2. Add storeId to props
  // 3. Remove auth check boilerplate
  let clientContent = content

  // Remove resolveStoreId import
  clientContent = clientContent.replace(/import\s*\{?\s*resolveStoreId\s*\}?\s*from\s*['"]@\/lib\/resolve-store['"]\s*\n?/g, '')
  clientContent = clientContent.replace(/import\s*\{?\s*resolveStore\s*\}?\s*from\s*['"]@\/lib\/resolve-store['"]\s*\n?/g, '')

  // Check what the page fetches - if it's via API routes, we just pass storeId
  const usesApiRoutes = content.includes("fetch('/api/") || content.includes('fetch(`/api/')
  const usesSupabaseClient = content.includes("from('@/lib/supabase/client')") || content.includes('from("@/lib/supabase/client")')

  // For the client component, we need to:
  // - Change function signature to accept props
  // - Remove the storeId resolution code

  // Find and remove resolveStoreId usage patterns
  // Pattern: const storeId = await resolveStoreId(supabase, user.id)
  clientContent = clientContent.replace(
    /\s*const\s+storeId\s*=\s*await\s+resolveStoreId\([^)]+\)\s*\n?/g,
    '\n'
  )
  // Pattern: const store = await resolveStore(supabase, user?.id || '')
  clientContent = clientContent.replace(
    /\s*const\s+store\s*=\s*await\s+resolveStore\([^)]+\)\s*\n?/g,
    '\n'
  )
  // Pattern: const storeId = store?.id ?? ''
  clientContent = clientContent.replace(
    /\s*const\s+storeId\s*=\s*store\?\.\s*id\s*\?\?\s*['"]['"]?\s*\n?/g,
    '\n'
  )

  // Remove inline resolveStoreId in useEffect/useCallback
  // Pattern: const sid = await resolveStoreId(supabase, user.id)
  clientContent = clientContent.replace(
    /\s*const\s+\w+\s*=\s*await\s+resolveStoreId\([^)]+\)\s*\n?/g,
    '\n'
  )

  // Add storeId prop to function signature
  // Change: export default function FooPage() {
  // To: export default function FooClient({ storeId }: { storeId: string }) {
  if (isParamsPage) {
    // For detail pages with params, also accept params
    clientContent = clientContent.replace(
      new RegExp(`export default function ${funcName}\\s*\\([^)]*\\)\\s*\\{`),
      `export default function ${clientComponentName}({ storeId }: { storeId: string }) {`
    )
  } else {
    clientContent = clientContent.replace(
      new RegExp(`export default function ${funcName}\\s*\\([^)]*\\)\\s*\\{`),
      `export default function ${clientComponentName}({ storeId }: { storeId: string }) {`
    )
  }

  // Write client component
  writeFileSync(clientFilePath, clientContent)

  // Generate server page.tsx
  const relativeClientImport = `./${clientFileName.replace('.tsx', '')}`

  let serverContent
  if (isDetailPage) {
    serverContent = `import { createClient } from '@/lib/supabase/server'
import { resolveStoreId } from '@/lib/resolve-store'
import { redirect } from 'next/navigation'
import ${clientComponentName} from '${relativeClientImport}'

export default async function ${funcName}({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) redirect('/login')

  return <${clientComponentName} storeId={storeId} />
}
`
  } else {
    serverContent = `import { createClient } from '@/lib/supabase/server'
import { resolveStoreId } from '@/lib/resolve-store'
import { redirect } from 'next/navigation'
import ${clientComponentName} from '${relativeClientImport}'

export default async function ${funcName}() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) redirect('/login')

  return <${clientComponentName} storeId={storeId} />
}
`
  }

  // Write new server page.tsx (overwrite the original)
  writeFileSync(filePath, serverContent)

  converted++
  console.log(`CONVERTED: ${filePath} → ${clientFileName}`)
}

console.log(`\n✅ Done: ${converted} converted, ${skipped} skipped`)
