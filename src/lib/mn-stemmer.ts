/**
 * mn-stemmer.ts — Mongolian suffix stemmer for keyword matching
 *
 * Strips agglutinative suffixes to reduce inflected word forms to a common
 * stem, so keywords only need to list base forms.
 *
 * Mongolian is agglutinative with vowel harmony (back: а/о/у ↔ front: э/ө/ү).
 * This is NOT a full morphological analyzer — it's tuned for e-commerce chatbot
 * keyword matching where over-stemming is safer than under-stemming.
 *
 * Rules:
 *  - Suffixes are tried longest-first (so чихсан strips before сан)
 *  - A strip is only applied if the remaining stem is ≥ MIN_STEM_LEN chars
 *  - Only ONE suffix is stripped per word (outermost layer)
 *
 * Common Mongolian suffix categories handled:
 *  Past tense/participle:  -сан/-сэн/-сон/-сөн, -лаа/-лээ/-лоо/-лөө, -жээ
 *  Passive past:           -гдсан/-гдсэн/-гдсон/-гдсөн
 *  "Already done":         -чихсан/-чихлаа
 *  Converb (adverbial):    -ж/-жаад/-жоод
 *  Genitive:               -ийн/-ын
 *  Accusative:             -ийг/-ыг
 *  Instrumental:           -аар/-ээр/-оор/-өөр
 *  Ablative:               -аас/-ээс/-оос/-өөс
 *  Comitative:             -тай/-тэй/-той
 *  Directive:              -руу/-рүү/-луу/-лүү
 *  Plural:                 -ууд/-үүд
 *  Possessive/topic:       -аа/-ээ/-оо/-өө (2-char, stripped last)
 *  Negative inf.:          -хгүй
 */

import { KNOWN_ROOTS } from './mn-roots'

/** Minimum characters the stem must retain after stripping. */
const MIN_STEM_LEN = 4

/** Maximum suffix layers to strip in deep stemming. */
const MAX_DEEP_LAYERS = 3

/** Suffix category for morphological feature extraction. */
export type SuffixCategory =
  | 'tense_past'
  | 'tense_past_spoken'
  | 'passive'
  | 'completive'      // "already done" (-чихсан)
  | 'negative'        // -хгүй
  | 'desiderative'    // -маар (want to)
  | 'converb'         // -ж, -жаад
  | 'case_genitive'
  | 'case_accusative'
  | 'case_instrumental'
  | 'case_ablative'
  | 'case_comitative'
  | 'case_directive'
  | 'case_dative'
  | 'plural'
  | 'possessive'
  | 'topic'

/** A suffix entry with its morphological category. */
export interface SuffixEntry {
  suffix: string
  category: SuffixCategory
}

/** Result of deep stemming — stem + ordered suffix chain (outermost first). */
export interface DeepStemResult {
  stem: string
  suffixes: SuffixEntry[]
}

/**
 * Suffix entries ordered longest → shortest, with category tags.
 * Within each length, back-vowel variants precede front-vowel variants.
 */
export const SUFFIX_ENTRIES: readonly SuffixEntry[] = [
  // ── 6-char ──
  { suffix: 'чихсан', category: 'completive' },
  { suffix: 'чихсэн', category: 'completive' },
  { suffix: 'чихлаа', category: 'completive' },
  { suffix: 'чихлээ', category: 'completive' },
  { suffix: 'чихлоо', category: 'completive' },
  { suffix: 'чихлөө', category: 'completive' },
  { suffix: 'аасаа', category: 'case_ablative' },
  { suffix: 'ээсээ', category: 'case_ablative' },

  // ── 5-char ──
  { suffix: 'гдсан', category: 'passive' },
  { suffix: 'гдсэн', category: 'passive' },
  { suffix: 'гдсон', category: 'passive' },
  { suffix: 'гдсөн', category: 'passive' },

  // ── 4-char ──
  { suffix: 'хгүй', category: 'negative' },
  { suffix: 'хгуй', category: 'negative' },
  { suffix: 'жаад', category: 'converb' },
  { suffix: 'жоод', category: 'converb' },
  { suffix: 'маар', category: 'desiderative' },
  { suffix: 'мээр', category: 'desiderative' },

  // ── 3-char ──
  { suffix: 'сан', category: 'tense_past' },
  { suffix: 'сэн', category: 'tense_past' },
  { suffix: 'сон', category: 'tense_past' },
  { suffix: 'сөн', category: 'tense_past' },
  { suffix: 'лаа', category: 'tense_past_spoken' },
  { suffix: 'лээ', category: 'tense_past_spoken' },
  { suffix: 'лоо', category: 'tense_past_spoken' },
  { suffix: 'лөө', category: 'tense_past_spoken' },
  { suffix: 'жээ', category: 'tense_past_spoken' },
  { suffix: 'аар', category: 'case_instrumental' },
  { suffix: 'ээр', category: 'case_instrumental' },
  { suffix: 'оор', category: 'case_instrumental' },
  { suffix: 'өөр', category: 'case_instrumental' },
  { suffix: 'аас', category: 'case_ablative' },
  { suffix: 'ээс', category: 'case_ablative' },
  { suffix: 'оос', category: 'case_ablative' },
  { suffix: 'өөс', category: 'case_ablative' },
  { suffix: 'тай', category: 'case_comitative' },
  { suffix: 'тэй', category: 'case_comitative' },
  { suffix: 'той', category: 'case_comitative' },
  { suffix: 'руу', category: 'case_directive' },
  { suffix: 'рүү', category: 'case_directive' },
  { suffix: 'луу', category: 'case_directive' },
  { suffix: 'лүү', category: 'case_directive' },
  { suffix: 'ууд', category: 'plural' },
  { suffix: 'үүд', category: 'plural' },
  { suffix: 'ийн', category: 'case_genitive' },
  { suffix: 'ийг', category: 'case_accusative' },
  { suffix: 'оод', category: 'converb' },
  { suffix: 'аад', category: 'converb' },
  { suffix: 'ээд', category: 'converb' },
  { suffix: 'гүй', category: 'negative' },
  { suffix: 'гуй', category: 'negative' },

  // ── 2-char ──
  { suffix: 'ын', category: 'case_genitive' },
  { suffix: 'ыг', category: 'case_accusative' },
  { suffix: 'аа', category: 'possessive' },
  { suffix: 'ээ', category: 'possessive' },
  { suffix: 'оо', category: 'possessive' },
  { suffix: 'өө', category: 'possessive' },
  { suffix: 'ад', category: 'case_dative' },
  { suffix: 'эд', category: 'case_dative' },
  { suffix: 'нь', category: 'topic' },

  // ── 1-char ──
  { suffix: 'ж', category: 'converb' },
  { suffix: 'н', category: 'case_genitive' },
]

/**
 * Flat suffix list derived from SUFFIX_ENTRIES for backward compatibility.
 */
const SUFFIXES: readonly string[] = SUFFIX_ENTRIES.map(e => e.suffix)

/**
 * Strip one outermost suffix from a single (already-normalized) Mongolian word.
 * Returns the stem, or the original word if no suffix applies.
 */
export function mnStem(word: string): string {
  for (const suffix of SUFFIXES) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, word.length - suffix.length)
      if (stem.length >= MIN_STEM_LEN) {
        return stem
      }
    }
  }
  return word
}

/**
 * Stem each space-separated token in a normalized text string.
 * Input should already be passed through normalizeText().
 */
export function stemText(text: string): string {
  return text
    .split(' ')
    .map(mnStem)
    .join(' ')
}

/**
 * Stem a multi-word keyword (each word independently).
 * Use for pre-computing stemmed keyword sets at module load.
 */
export function stemKeyword(keyword: string): string {
  return keyword
    .split(' ')
    .map(mnStem)
    .join(' ')
}

// ── Deep (multi-level) stemming ──────────────────────────────────────────────

/**
 * Check if a stem is valid: either meets MIN_STEM_LEN or is a known root.
 */
function isValidStem(stem: string): boolean {
  return stem.length >= MIN_STEM_LEN || KNOWN_ROOTS.has(stem)
}

/**
 * Strip one suffix and return the entry, or null if no suffix applies.
 * Uses isValidStem() which allows known short roots.
 */
function stripOneSuffix(word: string): { stem: string; entry: SuffixEntry } | null {
  for (const entry of SUFFIX_ENTRIES) {
    if (word.endsWith(entry.suffix)) {
      const stem = word.slice(0, word.length - entry.suffix.length)
      if (stem.length > 0 && isValidStem(stem)) {
        return { stem, entry }
      }
    }
  }
  return null
}

/**
 * Deep-stem a single word: iteratively strip up to MAX_DEEP_LAYERS suffixes.
 * Returns the root stem and the ordered suffix chain (outermost first).
 *
 * Example:
 *   "захиалсангүй" → { stem: "захиал", suffixes: [{suffix:"гүй",…}, {suffix:"сан",…}] }
 *   "авмаар"       → { stem: "ав",     suffixes: [{suffix:"маар",…}] }
 */
export function mnStemDeep(word: string, maxLayers: number = MAX_DEEP_LAYERS): DeepStemResult {
  const suffixes: SuffixEntry[] = []
  let current = word

  for (let i = 0; i < maxLayers; i++) {
    const result = stripOneSuffix(current)
    if (!result) break
    suffixes.push(result.entry)
    current = result.stem
  }

  return { stem: current, suffixes }
}

/**
 * Deep-stem each space-separated token.
 * Returns just the stems joined by spaces.
 */
export function stemTextDeep(text: string): string {
  return text
    .split(' ')
    .map(w => mnStemDeep(w).stem)
    .join(' ')
}

/**
 * Deep-stem a multi-word keyword.
 * Use for pre-computing deep-stemmed keyword sets at module load.
 */
export function stemKeywordDeep(keyword: string): string {
  return keyword
    .split(' ')
    .map(w => mnStemDeep(w).stem)
    .join(' ')
}
