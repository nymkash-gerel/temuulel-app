/**
 * Text normalization for Mongolian language processing.
 * Handles Cyrillic/Latin swaps, common typos, vowel neutralization, and punctuation.
 */

// ---------------------------------------------------------------------------
// Latin → Cyrillic mapping
// ---------------------------------------------------------------------------

/** Latin digraphs that map to single Cyrillic characters (order matters — longest first) */
const LATIN_DIGRAPHS: [string, string][] = [
  ['ts', 'ц'], ['sh', 'ш'], ['ch', 'ч'],
  ['kh', 'х'], ['zh', 'ж'], ['yu', 'ю'],
  ['ya', 'я'], ['yo', 'ё'], ['ye', 'е'],
]

/** Map of Latin characters commonly used instead of Cyrillic equivalents */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф',
  g: 'г', h: 'х', i: 'и', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с',
  t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a message for keyword matching:
 * 1. Lowercase
 * 2. Replace Latin digraphs (ts→ц, sh→ш, ch→ч, etc.)
 * 3. Replace remaining Latin chars with Cyrillic equivalents
 * 4. Strip punctuation and extra whitespace
 */
export function normalizeText(text: string): string {
  let result = text.toLowerCase()
  // Replace digraphs first (before single-char replacement eats the letters)
  for (const [latin, cyrillic] of LATIN_DIGRAPHS) {
    result = result.split(latin).join(cyrillic)
  }
  // Replace remaining Latin characters with Cyrillic equivalents
  result = result.replace(/[a-z]/g, (ch) => LATIN_TO_CYRILLIC[ch] || ch)
  // Strip punctuation (keep Cyrillic, digits, spaces)
  result = result.replace(/[^\u0400-\u04ff\u0600-\u06ff\d\s]/g, ' ')
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim()
  return result
}

/**
 * Neutralize Mongolian vowel pairs so Latin-typed text matches Cyrillic keywords.
 * Latin "e" → Cyrillic "е" but Mongolian keywords use "э" (хэмжээ, хэд, үнэ)
 * Latin "u" → Cyrillic "у" but Mongolian keywords use "ү" (үнэ, хүргэлт)
 * Latin "o" → Cyrillic "о" but Mongolian keywords use "ө" (өдөр, дөрөв)
 *
 * This function reduces both forms to the same base so they can match:
 * neutralizeVowels("хемжее") === neutralizeVowels("хэмжээ") // both → "хемжее"
 */
export function neutralizeVowels(text: string): string {
  return text
    .replace(/э/g, 'е')
    .replace(/ү/g, 'у')
    .replace(/ө/g, 'о')
    .replace(/й/g, 'и')  // Latin "i" → "и" but Mongolian uses "й" at word endings
}
