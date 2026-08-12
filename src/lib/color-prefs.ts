/**
 * Colour preference extraction from customer messages.
 *
 * `preferred_colors` existed in CustomerPreferences since its introduction but
 * was never written or read. This module is the single source of colour
 * vocabulary — contextual-responder's variant-availability guard imports
 * COLOR_MAP from here so the two features can never diverge.
 *
 * Two hazards shaped the design (see chat-audit-remaining-2026-08-08):
 *
 * 1. REJECTED colours must not become favourites. "хар өнгө хэрэггүй" is the
 *    customer ruling black OUT. Every colour match is checked for a trailing
 *    negation marker in the same clause before it is stored, and a rejection
 *    also REMOVES the colour if it was stored earlier.
 *
 * 2. Food words. In restaurant/coffee verticals "шар айраг" (beer) and
 *    "улаан лооль" (tomato) are menu items, not colour preferences. Extraction
 *    only runs for verticals where products actually have colour variants —
 *    the caller gates on COLOR_PREF_VERTICALS.
 *
 * Matching is token-exact (with a small allowlist of case suffixes), never
 * substring: "хар" must not fire inside "харах" (to see), "харагдана"
 * (appears) or "харамсаж" (regret), nor "бор" inside "борлуулалт" (sales).
 */

import { normalizeText, neutralizeVowels } from './text-normalizer'

/**
 * Colour keyword → canonical colour name. Keys cover Cyrillic, common Latin
 * transliterations and English. Shared with contextual-responder's
 * variant-availability check (which matches keys as substrings of the raw
 * lowercase message — its original behaviour, unchanged).
 */
export const COLOR_MAP: Record<string, string> = {
  'улаан': 'улаан', 'улан': 'улаан', 'ulaan': 'улаан', 'red': 'улаан',
  'бор': 'бор', 'brown': 'бор',
  'шар': 'шар', 'yellow': 'шар',
  'хөх': 'хөх', 'хох': 'хөх', 'blue': 'хөх',
  'нил': 'нил ягаан', 'purple': 'нил ягаан',
  'ягаан': 'ягаан', 'pink': 'ягаан',
  'цагаан': 'цагаан', 'white': 'цагаан',
  'хар': 'хар', 'black': 'хар',
  'саарал': 'саарал', 'gray': 'саарал', 'grey': 'саарал',
  'ногоон': 'ногоон', 'green': 'ногоон',
  'цэнхэр': 'цэнхэр', 'цайвар цэнхэр': 'цайвар цэнхэр',
  'улбар': 'улбар ягаан', 'orange': 'улбар ягаан',
}

/**
 * Verticals whose products carry colour variants. Everything else — including
 * an absent/unknown business type — is excluded: failing closed here is what
 * keeps "шар айраг" from becoming a colour preference in a pub.
 */
export const COLOR_PREF_VERTICALS = new Set(['ecommerce'])

/** Most colours a customer can have on file; newest mention wins a slot. */
const MAX_PREFERRED_COLORS = 3

/**
 * Lookup in the same text space the scanner runs in: every key — Cyrillic,
 * Latin translit and English alike — is passed through the same
 * neutralizeVowels(normalizeText(...)) pipeline as the message, so whatever
 * normalizeText turns "black" into is exactly what we look for.
 */
const NEUT_KEY_TO_CANONICAL: ReadonlyMap<string, string> = new Map(
  Object.entries(COLOR_MAP).flatMap(([key, canonical]) => {
    // Multi-word keys can't match a single token — their meaningful word
    // ('ягаан', 'цэнхэр') is present as its own key already.
    if (key.includes(' ')) return []
    return [[neutralizeVowels(normalizeText(key)), canonical] as const]
  })
)

/**
 * Mongolian case suffixes a colour stem may carry as one token, in
 * vowel-neutralized form: хараар (instrumental), харыг (accusative),
 * хартай (comitative), хараас (ablative — "хараас өөр" = other than black).
 * Anything not on this list ("харах", "харагдана") is a different word.
 *
 * Deliberately absent (adversarial review 2026-08-12 — each collides with a
 * common word and stored a false preference end-to-end):
 *   'ин'/'ын'/'иин' — 'хар'+'ин' = харин (= "but/by the way", and "харин уу"
 *     is the standard casual reply to баярлалаа); 'шар'+'ын' = Шарын гол, a
 *     town customers name in delivery questions. Vowel harmony makes харин
 *     impossible as a case form of хар anyway.
 *   'д' (dative) — 'хар'+'д' = хард ("хард рок"). The one construction that
 *     needs the dative, "улаанд дургүй", is special-cased in the scanner.
 */
const COLOR_SUFFIXES = [
  'аар', 'еер', 'оор',
  'ыг', 'иг', 'ииг',
  'таи', 'теи', 'тои',
  'аас', 'еес', 'оос',
]

/** Dative-marked colour ("улаанд") — only meaningful before дургүй. */
const DATIVE_END = 'д'
const DISLIKE = 'дургуи'

/**
 * Negation / rejection markers, vowel-neutralized. A colour followed by one of
 * these within the same clause is being ruled OUT, not asked for.
 * Deliberately absent: 'баихгуи' — "хар байхгүй юу?" is the customer ASKING
 * for black (do you not have it?), which is positive interest.
 */
const REJECT_MARKERS = [
  'хереггуи',       // хэрэггүй — don't need
  'биш',            // not
  'таалагдахгуи',   // don't like (future)
  'таалагддаггуи',  // don't like (habitual)
  'авахгуи',        // won't take
  'авмааргуи',      // don't want to take
  'дургуи',         // dislike
  'болохгуи',       // won't do — but see the interrogative exception below
]

/**
 * Texting joins the softening particle onto the negation: "авахгүйээ"
 * (авахгуиее). A marker with one of these tails is still the marker.
 * 'биш' stays exact: "хар биш үү?" (бишуу) asks WHETHER it's black.
 */
const MARKER_TAILS = ['ее', 'шуу', 'дее', 'даа', 'л', 'шд']

function matchRejectMarker(token: string): string | null {
  for (const m of REJECT_MARKERS) {
    if (token === m) return m
    if (m !== 'биш' && token.startsWith(m) && MARKER_TAILS.includes(token.slice(m.length))) return m
  }
  return null
}

/**
 * Interrogative particles. Two jobs:
 * 1. "хар өнгөөр болохгүй юу?" is a REQUEST for black ("can't I have it in
 *    black?"), not a rejection — болохгүй followed by one of these (directly
 *    or via "юм": "болохгүй юм уу") flips back to interest.
 * 2. They END a question clause. normalizeText strips punctuation, so
 *    "Хар байна уу? Хүргэлт хэрэггүй" would otherwise let the scan cross into
 *    the next clause and reject the colour the customer just asked FOR —
 *    the scan stops at the particle instead.
 */
const INTERROGATIVE = new Set(['юу', 'уу', 'ю', 'ве', 'юмуу'])

/**
 * A choice verb between the colour and a later negation means the colour was
 * CHOSEN and the negation is about something else: "хар авъя, энэ хэрэггүй"
 * (I'll take black — THIS one I don't need). Scanning stops here.
 * Anchored to real verb forms — a bare /^ав/ or /^заа/ prefix swallowed
 * авдар (chest) and заавал (= necessarily: "заавал хэрэггүй" is a REJECTION),
 * turning refusals into likes. ё appears alongside е because neutralizeVowels
 * leaves it untouched (болъё). авахгүй/авмааргүй are rejection markers and
 * are matched BEFORE this check.
 */
const CHOICE_VERB = /^(ав(ъ|ь|а$|аа?х|на|ии$|и$|ч|мар|маар)|болно$|заа$|тег[ьъ]|бол[ьъ][её]|болго)/

/**
 * "хараас өөр/бусад" (= other than black) is a rejection, but ONLY after the
 * ablative: "хар өөр загвартай юу?" is the customer asking whether black
 * comes in another style — interest, not rejection. So these count as markers
 * only when the colour token itself carried an ablative suffix. Scanned across
 * the whole window: "хараас арай өөр" still rejects.
 */
const ABLATIVE_END = /(аас|еес|оос)$/
const OTHER_THAN = new Set(['оор', 'бусад'])

/**
 * A colour immediately followed by one of these nouns is a product or holiday
 * NAME, not a preference: хар цай (black tea), ногоон цай, шар тос (butter),
 * цагаан будаа (rice), Цагаан сар (Lunar New Year), шар айраг (beer),
 * улаан лооль (tomato). The vertical gate does not cover these — Mongolian
 * ecommerce shops sell groceries and Цагаан сар is peak gift season.
 * Prefix-matched so сарын/сараар/цайны all hit.
 */
const COMPOUND_FOLLOWERS: RegExp[] = [
  /^цаи$|^цаин/,   // цай/цайны — tea (NOT цайвар = light-coloured)
  /^тос/,          // butter/oil
  /^будаа/,        // rice
  // Цагаан сар case forms only — NOT сарнай (rose), сарлаг (yak), сарафан
  /^сар$|^сарын|^сараар|^сард$|^сарыг$|^сартаи|^сариин/,
  /^аираг/,        // айраг; шар айраг = beer
  /^архи/,         // vodka
  /^лооль/,        // tomato
  /^идее/,         // цагаан идээ — dairy
  /^тамхи/,        // cigarettes
]

/**
 * How many tokens after the colour to scan for a rejection marker.
 * normalizeText strips punctuation, so clause boundaries are gone by the time
 * we tokenize. Wide enough for "улаан өнгө надад огт таалагдахгүй" (marker 4
 * tokens out); the CHOICE_VERB / next-colour stops keep it from overreaching
 * into a different clause ("хар авъя, гэхдээ энэ загвар хэрэггүй").
 */
const REJECT_WINDOW = 5

export interface ColorSignals {
  liked: string[]
  rejected: string[]
}

/**
 * Find colour mentions and classify each as liked or rejected.
 * Returns canonical colour names, in order of appearance, deduplicated.
 */
export function extractColorSignals(message: string): ColorSignals {
  const neut = neutralizeVowels(normalizeText(message.toLowerCase()))
  const tokens = neut.split(/\s+/).map((t) => t.replace(/[^а-яёa-z0-9]/g, '')).filter(Boolean)

  const liked: string[] = []
  const rejected: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    let canonical = matchColorToken(tokens[i])

    // Dative special case: "улаанд (огт) дургүй" — the bare dative suffix is
    // not in COLOR_SUFFIXES (хард = hard rock), so it only counts when дургүй
    // follows within a few tokens (intensifiers like огт/үнэхээр may intervene).
    if (!canonical && tokens[i].endsWith(DATIVE_END)
      && tokens.slice(i + 1, i + 4).some((t) => t.startsWith(DISLIKE))) {
      canonical = matchColorToken(tokens[i].slice(0, -1))
    }
    if (!canonical) continue

    // Colour + product/holiday noun is a NAME (хар цай, Цагаан сар) — no signal.
    const follower = tokens[i + 1]
    if (follower && COMPOUND_FOLLOWERS.some((f) => f.test(follower))) continue

    // нил ягаан / улбар шар are one colour — consume the second word so a
    // single mention doesn't fill two preference slots.
    let next = i + 1
    if ((tokens[i] === 'нил' && tokens[i + 1]?.startsWith('ягаан'))
      || (tokens[i] === 'улбар' && tokens[i + 1]?.startsWith('шар'))) {
      next = i + 2
      i += 1
    }

    // Scan forward for a rejection marker. Markers match exactly or with a
    // joined particle tail ('оор' inside "оорчлолт" must not fire). The scan
    // STOPS at a choice verb ("хар авъя, энэ хэрэггүй" — the negation is about
    // the item, not the colour) and at an interrogative particle ("Хар байна
    // уу? Хүргэлт хэрэггүй" — the question clause ended; the negation belongs
    // to the next one). It deliberately does NOT stop at another colour:
    // "улаан хар хоёулаа хэрэггүй" rejects the whole list.
    const isAblative = ABLATIVE_END.test(tokens[i])
    let isRejected = false
    for (let j = next; j < Math.min(next + REJECT_WINDOW, tokens.length); j++) {
      const t = tokens[j]
      const marker = matchRejectMarker(t)
      if (marker) {
        // A QUESTION about a negation is not an assertion of it: "болохгүй
        // юу?" / "болохгүй юм уу?" requests the colour, "хар биш үү?" asks
        // whether it IS black. Any marker followed (directly or via "юм") by
        // an interrogative particle is a question — no rejection.
        const n1 = tokens[j + 1]
        const n2 = tokens[j + 2]
        if ((n1 && INTERROGATIVE.has(n1)) || (n1 === 'юм' && n2 && INTERROGATIVE.has(n2))) break
        isRejected = true
        break
      }
      if (isAblative && OTHER_THAN.has(t)) { isRejected = true; break }
      if (CHOICE_VERB.test(t)) break
      if (INTERROGATIVE.has(t)) break
    }

    const bucket = isRejected ? rejected : liked
    if (!bucket.includes(canonical)) bucket.push(canonical)
  }

  // A colour both liked and rejected in one message ("улаан биш, хар авъя" →
  // хар liked, улаан rejected) is fine; but if the SAME colour landed in both
  // buckets the rejection wins — storing a ruled-out colour is the worse error.
  return {
    liked: liked.filter((c) => !rejected.includes(c)),
    rejected,
  }
}

/** Token-exact colour match: the stem alone or stem + one allowed suffix. */
function matchColorToken(word: string): string | null {
  const direct = NEUT_KEY_TO_CANONICAL.get(word)
  if (direct) return direct
  for (const [stem, canonical] of NEUT_KEY_TO_CANONICAL) {
    if (word.length > stem.length && word.startsWith(stem)
      && COLOR_SUFFIXES.includes(word.slice(stem.length))) {
      return canonical
    }
  }
  return null
}

/**
 * Apply a message's colour signals to the stored preference list.
 * Returns the new list, or null when the message changes nothing —
 * so callers can skip a state write.
 */
export function applyColorPreferences(
  message: string,
  current: string[] | undefined,
): string[] | null {
  const { liked, rejected } = extractColorSignals(message)
  if (liked.length === 0 && rejected.length === 0) return null

  const existing = current ?? []
  const next = [
    ...liked,
    ...existing.filter((c) => !liked.includes(c)),
  ]
    .filter((c) => !rejected.includes(c))
    .slice(0, MAX_PREFERRED_COLORS)

  // No effective change (e.g. re-mentioning the colour already at the top,
  // or rejecting a colour that was never stored) — skip the write.
  if (next.length === existing.length && next.every((c, i) => c === existing[i])) {
    return null
  }
  return next
}
