/**
 * Word-Boundary Keyword Matcher for Mongolian Text
 *
 * Drop-in replacement for raw `.includes()` checks on user messages.
 * Prevents substring false-matches like 'хүн' matching 'хүндэтгэл'.
 *
 * Handles Mongolian SMS patterns:
 * - Cyrillic text
 * - Cyrillic-Latin mixing ("zah1alga" for "захиалга")
 * - Extra spaces, punctuation noise
 * - Common typos and abbreviations
 *
 * Usage:
 *   import { matchesKeyword, matchesAnyKeyword } from './keyword-matcher';
 *
 *   // Instead of: message.includes('хүнтэй ярих')
 *   matchesKeyword(message, 'хүнтэй ярих')
 *
 *   // Instead of: keywords.some(k => message.includes(k))
 *   matchesAnyKeyword(message, ['хүнтэй ярих', 'менежер дуудаарай'])
 */

// ============================================================
// CORE MATCHING
// ============================================================

/**
 * Check if a keyword/phrase appears in text with word boundaries.
 *
 * For single-word keywords: matches only as a whole word.
 *   matchesKeyword('хүндэтгэл', 'хүн') → false
 *   matchesKeyword('хүн байна', 'хүн')  → true
 *
 * For multi-word phrases: matches the exact phrase (words in sequence).
 *   matchesKeyword('хүнтэй ярих гэсэн', 'хүнтэй ярих') → true
 *   matchesKeyword('хүнтэй би ярих', 'хүнтэй ярих')     → false
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);

  if (normalizedKeyword.includes(' ')) {
    // Multi-word phrase: check exact phrase match with word boundaries
    return matchesPhrase(normalizedText, normalizedKeyword);
  }

  // Single word: check whole-word match
  const words = tokenize(normalizedText);
  return words.includes(normalizedKeyword);
}

/**
 * Check if ANY of the keywords match (replaces .some(k => msg.includes(k)))
 * Returns the first matching keyword or null.
 */
export function matchesAnyKeyword(
  text: string,
  keywords: string[]
): string | null {
  for (const keyword of keywords) {
    if (matchesKeyword(text, keyword)) {
      return keyword;
    }
  }
  return null;
}

/**
 * Check which keywords match (for scoring/tiebreaking).
 * Returns all matching keywords with their positions.
 */
export function findAllMatches(
  text: string,
  keywords: string[]
): { keyword: string; position: number }[] {
  const normalizedText = normalizeText(text);
  const words = tokenize(normalizedText);
  const matches: { keyword: string; position: number }[] = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);

    if (normalizedKeyword.includes(' ')) {
      // Phrase match
      const phraseStr = normalizedKeyword;
      const idx = normalizedText.indexOf(phraseStr);
      if (idx !== -1) {
        // Verify word boundaries around the phrase
        const before = idx === 0 || normalizedText[idx - 1] === ' ';
        const after =
          idx + phraseStr.length === normalizedText.length ||
          normalizedText[idx + phraseStr.length] === ' ';
        if (before && after) {
          matches.push({ keyword, position: idx });
        }
      }
    } else {
      // Word match
      const wordIdx = words.indexOf(normalizedKeyword);
      if (wordIdx !== -1) {
        matches.push({ keyword, position: wordIdx });
      }
    }
  }

  return matches;
}

// ============================================================
// TEXT NORMALIZATION
// ============================================================

/**
 * Normalize text for matching:
 * - Lowercase
 * - Collapse whitespace
 * - Remove punctuation (but keep Cyrillic and Latin letters + digits)
 * - Trim
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // Remove non-letter, non-digit chars
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .trim();
}

/**
 * Split text into words (tokens).
 */
function tokenize(normalizedText: string): string[] {
  return normalizedText.split(' ').filter((w) => w.length > 0);
}

/**
 * Check if a phrase appears in text with word boundaries on both sides.
 */
function matchesPhrase(normalizedText: string, normalizedPhrase: string): boolean {
  const idx = normalizedText.indexOf(normalizedPhrase);
  if (idx === -1) return false;

  const before = idx === 0 || normalizedText[idx - 1] === ' ';
  const end = idx + normalizedPhrase.length;
  const after = end === normalizedText.length || normalizedText[end] === ' ';

  return before && after;
}

// ============================================================
// MIGRATION HELPER
// ============================================================

/**
 * Use this to audit existing .includes() calls.
 * Logs warnings when a raw includes would have matched
 * but word-boundary matching would not.
 *
 * Usage in development:
 *   auditIncludes(message, existingKeywords, 'escalation.ts:45');
 */
export function auditIncludes(
  text: string,
  keywords: string[],
  location: string
): void {
  for (const keyword of keywords) {
    const rawMatch = text.toLowerCase().includes(keyword.toLowerCase());
    const boundaryMatch = matchesKeyword(text, keyword);

    if (rawMatch && !boundaryMatch) {
      console.warn(
        `[KEYWORD AUDIT] ${location}: '${keyword}' raw-matched in "${text.substring(0, 60)}..." ` +
          `but word-boundary did NOT match. This would have been a false positive.`
      );
    }
  }
}
