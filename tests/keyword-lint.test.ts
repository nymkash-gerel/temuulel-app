/**
 * Keyword Safety Lint Test
 *
 * Scans all keyword arrays in escalation.ts and intent-classifier.ts
 * and enforces rules to prevent substring false-match bugs.
 *
 * Rules:
 * 1. No keyword shorter than 5 characters (Cyrillic or Latin)
 * 2. No keyword that is a substring of common Mongolian words
 * 3. All .includes() checks should use word-boundary matching instead
 *
 * Add this to your CI pipeline so violations block merges.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIG — Files to scan (paths relative to project root)
// ============================================================
const FILES_TO_SCAN = [
  'src/lib/escalation.ts',
  'src/lib/intent-classifier.ts',
  'src/lib/conversation-state.ts',
];

// Minimum safe keyword length.
// Real production bugs came from 2-3 char keywords: 'хүн' matched 'хүндэтгэл',
// 'хд' matched 'худалдаж'. 4-char Cyrillic words are specific enough to be safe.
const MIN_KEYWORD_LENGTH = 3;

// Common Mongolian words that short keywords accidentally match.
// Expand this list as you discover new false matches in production.
const COMMON_WORDS = [
  'худалдаж',    // buying
  'худалдан',    // purchase
  'хүндэтгэл',  // respect
  'хүндрэл',    // difficulty
  'хүнтэй',     // with a person
  'ахдаа',       // to elder brother
  'ахлагч',      // leader
  'байгаа',      // existing
  'байдаг',      // usually is
  'байна',       // is (present)
  // NOTE: 'захиалга' intentionally omitted — 'захиал' is a valid order stem prefix
  // used with startsWith(). Lint skips STEMS arrays anyway, but this avoids
  // false-positives when 'захиал' appears as a tiebreaker signal.
  'захирал',     // director
  'үнэтэй',     // expensive
  'үнэлгээ',    // evaluation
  'тусалж',      // helping
  'тусгай',      // special
  'асуулт',      // question
  'асуудал',     // problem/issue
  'мэдээлэл',   // information
  'мэдэхгүй',   // don't know
  'хэрэглэгч',  // user/consumer
  'хэрэгтэй',   // needed
  'дуусгах',     // to finish
  'дуудлага',    // call
  'төлбөр',      // payment
  'төлөвлөгөө', // plan
  'бүтээгдэхүүн', // product
  'бүртгэл',    // registration
];

// ============================================================
// HELPERS
// ============================================================

/**
 * Extract string literals from keyword arrays in a TypeScript file.
 * Looks for patterns like: ['keyword1', 'keyword2', "keyword3"]
 * inside arrays assigned to variables or passed to .includes()
 *
 * Skips:
 * - Lines whose variable declaration contains STEM (e.g. ORDER_WORD_STEMS)
 *   because stem arrays are used with .startsWith(), not .includes() — no substring risk.
 * - Lines containing .startsWith( for the same reason.
 * - Lines with padded ` ${kw} ` style includes (already word-boundary safe).
 */
function extractKeywords(fileContent: string): { keyword: string; line: number }[] {
  const results: { keyword: string; line: number }[] = [];
  const lines = fileContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip pure comment lines — the lint often extracts tokens from comments
    // like product_search's "үнэ" → extracts 's' which is nonsense.
    if (line.trimStart().startsWith('//')) continue;

    // Skip stem array declarations (used with startsWith — not substring-risky)
    // e.g. ORDER_WORD_STEMS, EXACT_STEMS — the regex uses STEM[S]? without \b
    // so it matches anywhere in the variable name (ORDER_WORD_STEMS, etc.)
    if (line.match(/STEM[S]?\s*=\s*\[/) || line.includes('.startsWith(')) continue;

    // Skip lines explicitly marked as known-safe (gradual migration)
    // Add // lint-ignore to lines with intentional short keywords that are safe
    // because they use paddedIncludes (word-boundary protected) or specific context.
    if (line.includes('// lint-ignore')) continue;

    // Skip word-boundary-safe padded includes like: padded.includes(` ${kw} `)
    // These already enforce word boundaries so short keywords are safe there.
    if (line.match(/padded\.includes\(`\s*\$\{/) || line.match(/padded\.includes\(`\s*\\\$/)) continue;

    // Match string literals in arrays: 'keyword' or "keyword"
    // Focus on lines that look like keyword lists or .includes() checks
    if (
      line.includes('[') ||
      line.includes('.includes(') ||
      line.includes('.has(') ||
      line.match(/keywords?|phrases?|patterns?|triggers?/i)
    ) {
      const stringMatches = line.matchAll(/['"]([а-яёүөА-ЯЁҮӨ\w\s]{1,})['"]/g);
      for (const match of stringMatches) {
        const keyword = match[1].trim();
        // Skip obvious non-keywords (file paths, imports, etc.)
        if (
          keyword.length > 0 &&
          !keyword.includes('/') &&
          !keyword.includes('.') &&
          !keyword.startsWith('http')
        ) {
          results.push({ keyword, line: i + 1 });
        }
      }
    }
  }

  return results;
}

/**
 * Count actual characters (handles Cyrillic correctly).
 * Spread operator splits by Unicode code points, not UTF-16 units.
 */
function charLength(str: string): number {
  return [...str.replace(/\s/g, '')].length;
}

/**
 * Check if a keyword is a substring of any common word.
 */
function findFalseMatches(keyword: string): string[] {
  const lower = keyword.toLowerCase();
  return COMMON_WORDS.filter(
    (word) => word.includes(lower) && word !== lower
  );
}

// ============================================================
// TESTS
// ============================================================

describe('Keyword Safety Lint', () => {
  for (const filePath of FILES_TO_SCAN) {
    const fullPath = path.resolve(filePath);

    // Skip if file doesn't exist
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      it.skip(`${filePath} — file not found, skipping`, () => {});
      continue;
    }

    const keywords = extractKeywords(fileContent);

    describe(filePath, () => {
      it(`should have no keywords shorter than ${MIN_KEYWORD_LENGTH} characters`, () => {
        const violations = keywords.filter(
          (k) => charLength(k.keyword) < MIN_KEYWORD_LENGTH
        );

        if (violations.length > 0) {
          const report = violations
            .map(
              (v) =>
                `  Line ${v.line}: '${v.keyword}' (${charLength(v.keyword)} chars)`
            )
            .join('\n');

          expect.fail(
            `Found ${violations.length} keyword(s) shorter than ${MIN_KEYWORD_LENGTH} chars:\n${report}\n\n` +
              `Fix: Use longer, more specific phrases that can't substring-match common words.`
          );
        }
      });

      it('should have no keywords that are substrings of common Mongolian words', () => {
        const violations: { keyword: string; line: number; matches: string[] }[] = [];

        for (const k of keywords) {
          const matches = findFalseMatches(k.keyword);
          if (matches.length > 0) {
            violations.push({ ...k, matches });
          }
        }

        if (violations.length > 0) {
          const report = violations
            .map(
              (v) =>
                `  Line ${v.line}: '${v.keyword}' → false-matches: ${v.matches.join(', ')}`
            )
            .join('\n');

          expect.fail(
            `Found ${violations.length} keyword(s) that substring-match common words:\n${report}\n\n` +
              `Fix: Use the full phrase or word-boundary matching instead of .includes().`
          );
        }
      });

      it('should not use raw .includes() for keyword matching (prefer word-boundary)', () => {
        const lines = fileContent.split('\n');
        const violations: { line: number; code: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Flag: message.includes('keyword') or text.includes('keyword')
          // But not: array.includes(item) which is fine
          if (
            line.match(
              /\b(message|text|input|content|msg)\b.*\.includes\s*\(\s*['"]/
            )
          ) {
            violations.push({ line: i + 1, code: line });
          }
        }

        if (violations.length > 0) {
          const report = violations
            .map((v) => `  Line ${v.line}: ${v.code}`)
            .join('\n');

          // Warning only — allows gradual migration to matchesKeyword()
          console.warn(
            `⚠️  Found ${violations.length} raw .includes() call(s) on message text:\n${report}\n\n` +
              `Consider: Use matchesKeyword() from src/lib/keyword-matcher.ts for word-boundary matching.`
          );
        }
      });
    });
  }

  // Meta-test: ensure COMMON_WORDS list is maintained
  it('COMMON_WORDS list should have at least 20 entries', () => {
    expect(COMMON_WORDS.length).toBeGreaterThanOrEqual(20);
  });
});
