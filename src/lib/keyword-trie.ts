/**
 * Trie-based keyword matcher for O(n) intent classification.
 *
 * Instead of checking each keyword against the message (O(keywords × message_length)),
 * we build a trie from all keywords and scan message words through it in one pass.
 *
 * Supports:
 * - Single-word keywords: exact word match
 * - Multi-word keywords: "буцаах бодлого" matched as bigram
 * - Returns all matching (intent, keyword, type) tuples
 */

interface TrieNode {
  children: Map<string, TrieNode>
  /** If this node terminates a keyword, store intent→keyword mappings */
  matches: { intent: string; keyword: string }[]
}

function createNode(): TrieNode {
  return { children: new Map(), matches: [] }
}

/**
 * Pre-built keyword index for fast lookups.
 */
export interface KeywordIndex {
  /** Trie root for single-word keywords */
  singleRoot: TrieNode
  /** Map of "word1 word2" → intent[] for multi-word keywords (bigrams/trigrams) */
  multiWord: Map<string, { intent: string; keyword: string }[]>
  /** Set of first words that start a multi-word keyword (for early bail-out) */
  multiWordStarts: Set<string>
}

/**
 * Build a keyword index from intent→keywords mapping.
 * Called once at module load.
 */
export function buildKeywordIndex(
  intentKeywords: Record<string, string[]>
): KeywordIndex {
  const singleRoot = createNode()
  const multiWord = new Map<string, { intent: string; keyword: string }[]>()
  const multiWordStarts = new Set<string>()

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    for (const kw of keywords) {
      const words = kw.split(' ')
      if (words.length === 1) {
        // Single word → trie insertion
        let node = singleRoot
        for (const ch of kw) {
          if (!node.children.has(ch)) node.children.set(ch, createNode())
          node = node.children.get(ch)!
        }
        node.matches.push({ intent, keyword: kw })
      } else {
        // Multi-word → map insertion
        const key = words.join(' ')
        if (!multiWord.has(key)) multiWord.set(key, [])
        multiWord.get(key)!.push({ intent, keyword: kw })
        multiWordStarts.add(words[0])
      }
    }
  }

  return { singleRoot, multiWord, multiWordStarts }
}

export interface KeywordMatch {
  intent: string
  keyword: string
  /** 'exact' = full word match, 'multi' = multi-word match */
  type: 'exact' | 'multi'
}

/**
 * Find all keyword matches in a normalized message using the pre-built index.
 * Returns matches in O(message_words × max_keyword_length) instead of O(keywords × message_length).
 */
export function findKeywordMatches(
  normalizedMessage: string,
  index: KeywordIndex
): KeywordMatch[] {
  const words = normalizedMessage.split(' ').filter(w => w.length > 0)
  const matches: KeywordMatch[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    // 1. Single-word trie lookup — exact match
    let node: TrieNode | undefined = index.singleRoot
    for (const ch of word) {
      node = node.children.get(ch)
      if (!node) break
    }
    if (node?.matches.length) {
      for (const m of node.matches) {
        matches.push({ intent: m.intent, keyword: m.keyword, type: 'exact' })
      }
    }

    // 2. Multi-word check — only if this word starts a known multi-word keyword
    if (index.multiWordStarts.has(word)) {
      // Try bigrams and trigrams
      for (let len = 2; len <= 4 && i + len - 1 < words.length; len++) {
        const phrase = words.slice(i, i + len).join(' ')
        const multiMatches = index.multiWord.get(phrase)
        if (multiMatches) {
          for (const m of multiMatches) {
            matches.push({ intent: m.intent, keyword: m.keyword, type: 'multi' })
          }
        }
      }
    }
  }

  return matches
}
