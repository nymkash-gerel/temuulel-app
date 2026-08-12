/**
 * Colour preference extraction — the audit finding was that preferred_colors
 * existed in CustomerPreferences but was never written or read, and that the
 * naive fix would store REJECTED colours as favourites ("хар өнгө хэрэггүй"
 * saving хар) and turn food words into colours in restaurant verticals.
 */
import { describe, it, expect } from 'vitest'
import {
  extractColorSignals,
  applyColorPreferences,
  COLOR_MAP,
  COLOR_PREF_VERTICALS,
} from './color-prefs'
import { resolveBusinessType } from './features'

describe('extractColorSignals — positive interest', () => {
  it.each([
    ['хар өнгө байна уу', 'хар'],
    ['хар авъя', 'хар'],
    ['хараар авъя', 'хар'],           // instrumental case
    ['хартай хослол', 'хар'],         // comitative case
    ['шар цамц авмаар байна', 'шар'],
    ['хар байхгүй юу', 'хар'],        // "don't you have black?" = wants black
    ['хар өөр загвартай юу', 'хар'],  // "does black come in another style?" = interest
  ])('%s → liked %s', (msg, color) => {
    expect(extractColorSignals(msg)).toEqual({ liked: [color], rejected: [] })
  })

  it('handles Latin transliteration', () => {
    expect(extractColorSignals('har ungu bnu').liked).toEqual(['хар'])
    expect(extractColorSignals('ulaan avii').liked).toEqual(['улаан'])
  })

  it('handles English colour words', () => {
    expect(extractColorSignals('black baina uu').liked).toEqual(['хар'])
  })
})

describe('extractColorSignals — rejection must not become a favourite', () => {
  it.each([
    ['улаан хэрэггүй', 'улаан'],
    ['улаан хэрэггүй ээ', 'улаан'],
    ['хар таалагдахгүй байна', 'хар'],
    ['хар авахгүй', 'хар'],
    ['улаанд дургүй', 'улаан'],
    ['хараас өөр өнгө байна уу', 'хар'],  // "other than black"
  ])('%s → rejected %s, liked nothing', (msg, color) => {
    const r = extractColorSignals(msg)
    expect(r.rejected).toEqual([color])
    expect(r.liked).toEqual([])
  })

  it('rejecting one colour while choosing another keeps both signals', () => {
    expect(extractColorSignals('улаан биш хар авъя'))
      .toEqual({ liked: ['хар'], rejected: ['улаан'] })
  })
})

describe('extractColorSignals — token boundaries', () => {
  it.each([
    'харах гэсэн юм',        // харах = to see
    'харагдана',             // = appears
    'харамсаж байна',        // = regret
    'борлуулалт сайн байна', // борлуулалт = sales (бор = brown)
    'цамц харья',            // харья = let me look
    'хохирол барагдуулна',   // хохирол = damage (хох = neut. хөх/blue)
  ])('%s → no colour signal', (msg) => {
    expect(extractColorSignals(msg)).toEqual({ liked: [], rejected: [] })
  })

  it('өөрчлөлт (change) does not read as a rejection marker', () => {
    // "let me change the colour, make it black" — хар is LIKED
    expect(extractColorSignals('өнгөө өөрчилье хар болгоё').liked).toEqual(['хар'])
  })
})

describe('adversarial review 2026-08-12 — each case was execution-verified', () => {
  it.each([
    'харин уу',                        // = "you're welcome", NOT хар+ин
    'za harin uu',
    'харин хүргэлт хэдэн төгрөг вэ',   // харин = "by the way"
    'Шарын гол руу хүргэлт хийдэг үү?', // town name, NOT шар+ын
    'хард рок сонсдог',                // loanword, NOT хар+д
  ])('%s → no colour signal (suffix collisions)', (msg) => {
    expect(extractColorSignals(msg)).toEqual({ liked: [], rejected: [] })
  })

  it.each([
    'хар цай байна уу',                // black tea
    'ногоон цай авъя',                 // green tea
    'шар тос байна уу',                // butter
    'цагаан будаа хэд вэ',             // rice
    'Цагаан сарын бэлэг байна уу',     // Lunar New Year gifts
    'Цагаан сараар бэлэг захимаар байна',
    'шар айраг байна уу',              // beer
  ])('%s → no colour signal (product/holiday names)', (msg) => {
    expect(extractColorSignals(msg)).toEqual({ liked: [], rejected: [] })
  })

  it.each([
    ['хараас бусад нь болно', 'хар'],
    ['улаанаас бусад өнгө байвал авна', 'улаан'],
    ['хараас арай өөр өнгөтэй юм байна уу', 'хар'],  // өөр beyond window[0]
    ['улаан өнгө надад огт таалагдахгүй', 'улаан'],   // marker 4 tokens out
  ])('%s → rejected %s', (msg, color) => {
    const r = extractColorSignals(msg)
    expect(r.rejected).toEqual([color])
    expect(r.liked).toEqual([])
  })

  it('болохгүй юу? is a REQUEST for the colour, not a rejection', () => {
    expect(extractColorSignals('хар өнгөөр болохгүй юу?'))
      .toEqual({ liked: ['хар'], rejected: [] })
  })

  it('negation aimed at the item does not reject the chosen colour', () => {
    expect(extractColorSignals('хар авъя энэ хэрэггүй').liked).toEqual(['хар'])
    expect(extractColorSignals('улаан авъя тэр биш').liked).toEqual(['улаан'])
  })

  it('нил ягаан is ONE colour — a single mention fills one slot', () => {
    expect(extractColorSignals('нил ягаан өнгөтэй байна уу'))
      .toEqual({ liked: ['нил ягаан'], rejected: [] })
  })
})

describe('re-attack round 2 (2026-08-12) — execution-verified fixes', () => {
  it.each([
    ['Хар байна уу? Хүргэлт хэрэггүй, очиж авна', 'хар'], // scan stops at уу — clause ended
    ['Хар өнгө байна уу? Уут хэрэггүй', 'хар'],
    ['Хар өнгөөр болохгүй юм уу?', 'хар'],   // юм уу = request, like bare юу
    ['Хар өнгөөр болохгүй юмуу', 'хар'],     // joined texting form
    ['Хараар болъё, энэ хэрэггүй', 'хар'],   // болъё choice verb (ё not neutralized)
    ['хар биш үү', 'хар'],                    // "isn't it black?" — a question, not a rejection
    ['улаан сарнай байна уу', 'улаан'],       // rose ≠ Цагаан сар
    ['хар сарлагийн ноосон цамц байна уу', 'хар'], // yak wool
    ['хар сарафан байна уу', 'хар'],
  ])('%s → liked %s', (msg, color) => {
    expect(extractColorSignals(msg)).toEqual({ liked: [color], rejected: [] })
  })

  it.each([
    ['Хар өнгө заавал хэрэггүй', 'хар'],  // заавал is NOT a choice verb
    ['хар авдар хэрэггүй', 'хар'],        // авдар (chest) is NOT a choice verb
    ['хар авахгүйээ', 'хар'],             // joined particle tail on the marker
    ['улаанд огт дургүй', 'улаан'],       // intensifier before дургүй
  ])('%s → rejected %s', (msg, color) => {
    const r = extractColorSignals(msg)
    expect(r.rejected).toEqual([color])
    expect(r.liked).toEqual([])
  })

  it('a negation over a colour LIST rejects every listed colour', () => {
    expect(extractColorSignals('Улаан хар хоёулаа хэрэггүй'))
      .toEqual({ liked: [], rejected: ['улаан', 'хар'] })
    expect(extractColorSignals('Улаан шар хэрэггүй, хар байна уу'))
      .toEqual({ liked: ['хар'], rejected: ['улаан', 'шар'] })
  })

  it('known accepted misses: bare genitive forms give no signal', () => {
    // The харин/Шарын collisions forced dropping genitive suffixes; missing
    // these positives is the cheap direction (nothing wrong is stored).
    expect(extractColorSignals('улааны үнэ хэд вэ')).toEqual({ liked: [], rejected: [] })
    expect(extractColorSignals('улааных нь авъя')).toEqual({ liked: [], rejected: [] })
  })
})

describe('applyColorPreferences', () => {
  it('adds a liked colour to the front', () => {
    expect(applyColorPreferences('шар авъя', ['улаан'])).toEqual(['шар', 'улаан'])
  })

  it('caps at 3, newest wins the slot', () => {
    expect(applyColorPreferences('шар авъя', ['улаан', 'хар', 'ногоон']))
      .toEqual(['шар', 'улаан', 'хар'])
  })

  it('re-mentioning moves the colour to the front without duplication', () => {
    expect(applyColorPreferences('хар өнгө байна уу', ['улаан', 'хар']))
      .toEqual(['хар', 'улаан'])
  })

  it('rejection removes a stored colour', () => {
    expect(applyColorPreferences('улаан хэрэггүй', ['улаан', 'хар'])).toEqual(['хар'])
  })

  it('returns null when nothing changes — callers skip the state write', () => {
    expect(applyColorPreferences('сайн байна уу', ['хар'])).toBeNull()
    expect(applyColorPreferences('хар авъя', ['хар'])).toBeNull()
    expect(applyColorPreferences('улаан хэрэггүй', ['хар'])).toBeNull()
  })

  it('works from an empty slate', () => {
    expect(applyColorPreferences('хар авъя', undefined)).toEqual(['хар'])
  })
})

describe('vertical gating', () => {
  it('only ecommerce extracts colour preferences', () => {
    expect(COLOR_PREF_VERTICALS.has('ecommerce')).toBe(true)
    expect(COLOR_PREF_VERTICALS.has('restaurant')).toBe(false)
    expect(COLOR_PREF_VERTICALS.has('coffee_shop')).toBe(false)
  })

  it('store-type aliases resolve into the gate', () => {
    // "shop", "commerce", "online_shop" are aliases for ecommerce
    expect(COLOR_PREF_VERTICALS.has(resolveBusinessType('shop'))).toBe(true)
    expect(COLOR_PREF_VERTICALS.has(resolveBusinessType('restaurant'))).toBe(false)
  })
})

describe('COLOR_MAP stays the single source of vocabulary', () => {
  it('carries the canonical colours the responder guard relies on', () => {
    expect(COLOR_MAP['хар']).toBe('хар')
    expect(COLOR_MAP['black']).toBe('хар')
    expect(COLOR_MAP['улан']).toBe('улаан') // common misspelling
    expect(COLOR_MAP['хох']).toBe('хөх')    // vowel-neutral spelling
  })
})
