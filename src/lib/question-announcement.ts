/**
 * Question-announcement detection — "асуулт байна", "нэг юм асууя".
 *
 * A customer ANNOUNCING a question hasn't asked it yet, so no classifier tier
 * can know the topic. Shared by the hybrid classifier (routes it to the
 * question_prompt intent) and by resolveFollowUp (mid-checkout, the phrase is
 * an interruption — it must not be stored as the customer's name or address).
 */

/**
 * A token that announces a question: the noun асуулт (any case form) or the
 * intent-verb forms асуух/асууя/асуумаар/асуулаа/асууж.
 *
 * Deliberately anchored rather than a bare асуу- prefix (adversarial review
 * 2026-08-12):
 *  - асуудал / асуудлууд (= PROBLEM, vowel-elided plural) are complaints;
 *  - асуусан / асуудаг ("I already asked" / "I usually ask") are not
 *    announcements — inviting the question again would loop;
 *  - асуугаарай ("YOU ask") and асуулга (survey) are neither;
 *  - асуултгүй / асуумааргүй (neutralized -гуи) NEGATE the announcement —
 *    "асуултгүй байна" means "no questions".
 */
const ANNOUNCEMENT_TOKEN = /^асуулт(?!гуи)|^асуух$|^асууя$|^асууъя$|^асууья$|^асуулаа$|^асууж$|^асуумаар(?!гуи)/

export function isAnnouncementToken(token: string): boolean {
  return ANNOUNCEMENT_TOKEN.test(token)
}

/**
 * Filler that may surround a bare announcement, vowel-neutralized:
 * "нэг юм асууя", "би асуумаар байна", "уучлаарай нэг юм асууя",
 * "асуулт байгаа л даа". Any token outside this set means the message
 * carries real content and must be classified normally.
 */
const ANNOUNCEMENT_FILLER = new Set([
  'нег', 'юм', 'зуил', 'зуилс', 'баина', 'бна', 'бн', 'байна',
  'баигаа', 'бгаа', 'бга',
  'уу', 'юу', 'ве', 'в', 'та', 'танд', 'танаид', 'надад', 'би',
  'жоохон', 'жаахан', 'ганц', 'хеден', 'их', 'л', 'шуу', 'шд',
  'геж', 'гесен', 'билее', 'даа', 'дее', 'лее', 'аа', 'ее', 'оо',
  'уучлаараи', 'зугеер',
])

/**
 * True when the message is ONLY an announcement ("асуулт байна", "нэг юм
 * асууя", "asuult bn") — the question itself hasn't been asked yet, so the
 * right response is to invite it, not to greet or to guess a topic.
 * Expects vowel-neutralized normalized text.
 */
export function isBareQuestionAnnouncement(neutralized: string): boolean {
  const tokens = neutralized.split(/\s+/).filter(Boolean)
  // Cap keeps a full sentence from qualifying; 8 fits the longest natural
  // phrasing seen in review ("танд нэг жоохон юм асуумаар байна шүү дээ").
  if (tokens.length === 0 || tokens.length > 8) return false
  if (!tokens.some(isAnnouncementToken)) return false
  return tokens.every((t) => isAnnouncementToken(t) || ANNOUNCEMENT_FILLER.has(t))
}
