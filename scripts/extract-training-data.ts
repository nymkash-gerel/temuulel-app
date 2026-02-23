#!/usr/bin/env tsx
/**
 * Extract training data from test files for ML intent classifier.
 * Parses patterns like `classifyIntent('message')` → expected intent and
 * test case arrays like `['message', 'intent']`.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface TrainingExample {
  text: string
  intent: string
}

const TEST_FILES = [
  'src/lib/chat-ai.test.ts',
  'src/lib/__tests__/chat-scenarios.test.ts',
  'src/lib/conversation-scenarios.test.ts',
  'src/lib/all-business-chat.test.ts',
]

const ROOT_DIR = '/data/workspace/temuulel-app'

function extractFromFile(filePath: string): TrainingExample[] {
  const content = readFileSync(join(ROOT_DIR, filePath), 'utf-8')
  const examples: TrainingExample[] = []

  // Pattern 1: expect(classifyIntent('message')).toBe('intent')
  const pattern1 = /expect\(classifyIntent\(['"`]([^'"`]+)['"`]\)\)\.toBe\(['"`]([^'"`]+)['"`]\)/g
  let match1
  while ((match1 = pattern1.exec(content)) !== null) {
    const [, text, intent] = match1
    examples.push({ text, intent })
  }

  // Pattern 2: Arrays in test cases like ['message', 'intent'] 
  // Looking for const arrays followed by as const
  const arrayPattern = /const\s+\w+(?:MN|EN|Scenarios)?\s*=\s*\[\s*([^}]+?)\s*\]\s+as\s+const/gs
  let arrayMatch
  while ((arrayMatch = arrayPattern.exec(content)) !== null) {
    const arrayContent = arrayMatch[1]
    
    // Extract individual array items: ['message', 'intent']
    const itemPattern = /\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g
    let itemMatch
    while ((itemMatch = itemPattern.exec(arrayContent)) !== null) {
      const [, text, intent] = itemMatch
      examples.push({ text, intent })
    }
  }

  // Pattern 3: it() test descriptions with "→" indicating expected result
  const itPattern = /it\(['"`]"([^"]+)"\s*→\s*([^'"`]+)['"`]/g
  let itMatch
  while ((itMatch = itPattern.exec(content)) !== null) {
    const [, text, intent] = itMatch
    examples.push({ text, intent })
  }

  // Pattern 4: Multi-word strings in test arrays (handle quoted strings with spaces)
  const quotedArrayPattern = /\["([^"]+)",\s*"([^"]+)"\]/g
  let quotedMatch
  while ((quotedMatch = quotedArrayPattern.exec(content)) !== null) {
    const [, text, intent] = quotedMatch
    examples.push({ text, intent })
  }

  // Pattern 5: Direct array assignments with scenarios
  const directArrayPattern = /\[\s*\['([^']+)',\s*'([^']+)'\]/g
  let directMatch
  while ((directMatch = directArrayPattern.exec(content)) !== null) {
    const [, text, intent] = directMatch
    examples.push({ text, intent })
  }

  console.log(`Extracted ${examples.length} examples from ${filePath}`)
  return examples
}

function deduplicateExamples(examples: TrainingExample[]): TrainingExample[] {
  const seen = new Set<string>()
  const deduplicated: TrainingExample[] = []
  
  // Valid intents from the keyword classifier
  const validIntents = new Set([
    'product_search', 'order_status', 'greeting', 'thanks', 'complaint',
    'return_exchange', 'size_info', 'payment', 'shipping', 'table_reservation',
    'allergen_info', 'menu_availability', 'general'
  ])
  
  for (const example of examples) {
    // Skip examples with invalid intents (template variables, etc.)
    if (!validIntents.has(example.intent)) {
      console.log(`Skipping invalid intent: "${example.intent}" for text: "${example.text}"`)
      continue
    }
    
    const key = `${example.text}|${example.intent}`
    if (!seen.has(key)) {
      seen.add(key)
      deduplicated.push(example)
    }
  }
  
  return deduplicated
}

function main() {
  console.log('Extracting training data from test files...')
  
  let allExamples: TrainingExample[] = []
  
  for (const filePath of TEST_FILES) {
    try {
      const examples = extractFromFile(filePath)
      allExamples.push(...examples)
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error)
    }
  }
  
  // Deduplicate examples
  const uniqueExamples = deduplicateExamples(allExamples)
  
  console.log(`Total examples extracted: ${allExamples.length}`)
  console.log(`Unique examples after deduplication: ${uniqueExamples.length}`)
  
  // Count examples per intent
  const intentCounts: Record<string, number> = {}
  for (const example of uniqueExamples) {
    intentCounts[example.intent] = (intentCounts[example.intent] || 0) + 1
  }
  
  console.log('\nExamples per intent:')
  Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([intent, count]) => {
      console.log(`  ${intent}: ${count}`)
    })
  
  // Write to output file
  const outputPath = join(ROOT_DIR, 'src/lib/ai/training-data.json')
  writeFileSync(outputPath, JSON.stringify(uniqueExamples, null, 2))
  
  console.log(`\nTraining data written to ${outputPath}`)
  console.log('Done!')
}

if (require.main === module) {
  main()
}