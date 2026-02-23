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

/** Minimum characters the stem must retain after stripping. */
const MIN_STEM_LEN = 4

/**
 * Suffixes ordered longest → shortest.
 * Within each length, back-vowel variants precede front-vowel variants.
 */
const SUFFIXES: readonly string[] = [
  // ── 6-char ──────────────────────────────────────────────────────────────
  'чихсан', 'чихлаа', 'чихлоо', 'чихлөө', // "already did" (аваачихсан)

  // ── 5-char ──────────────────────────────────────────────────────────────
  'гдсан', 'гдсэн', 'гдсон', 'гдсөн',      // passive past (буцаагдсан)
  'жааd', 'жоод',                           // converb sequence (явж ааd)

  // ── 4-char ──────────────────────────────────────────────────────────────
  'хгүй', 'хгуй',                           // neg. infinitive (явахгүй)
  'аасаа', 'ээсээ',                         // ablative + possessive

  // ── 3-char ──────────────────────────────────────────────────────────────
  // Desiderative mood (-маар/-мээр = "want to X")
  'маар', 'мээр',
  // Past participle
  'сан', 'сэн', 'сон', 'сөн',
  // Spoken past tense
  'лаа', 'лээ', 'лоо', 'лөө',
  // Past converb (formal register)
  'жээ',
  // Instrumental case (by/with)
  // NOTE: -аар also appears in -маар desiderative (handled above, longest-first)
  'аар', 'ээр', 'оор', 'өөр',
  // Ablative case (from)
  'аас', 'ээс', 'оос', 'өөс',
  // Comitative case (with X)
  'тай', 'тэй', 'той',
  // Directive case (towards)
  'руу', 'рүү', 'луу', 'лүү',
  // Plural
  'ууд', 'үүд',
  // Genitive (front-vowel stem)
  'ийн',
  // Accusative (front-vowel stem)
  'ийг',
  // NOTE: -гаа/-гээ/-гоо/-гөө removed — ambiguous with root-final г.
  //   e.g. захиалгаа (захиалга + аа) would wrongly stem to захиал via -гаа.
  //   Plain -аа (2-char) handles this correctly with MIN_STEM_LEN protection.
  // Converb + continuation (явж ааd, ирж оод in spoken form)
  'оод', 'ааd', 'ээд',

  // ── 2-char ──────────────────────────────────────────────────────────────
  // Genitive (back-vowel stem)
  'ын',
  // Accusative (back-vowel stem)
  'ыг',
  // Possessive / topic (most common conversational suffix)
  'аа', 'ээ', 'оо', 'өө',
  // Dative-locative
  'ад', 'эд',
  // Topic/3rd-person possessive (after vowel)
  'нь',

  // ── 1-char ──────────────────────────────────────────────────────────────
  // Converb (most productive verbal suffix: захиалж, буцааж, хийж)
  'ж',
  // Short genitive (after vowel: манайн, дэлгүүрн — informal)
  'н',
]

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
