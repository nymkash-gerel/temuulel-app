import { describe, test, expect } from 'vitest'
import { mnStem, mnStemDeep, stemTextDeep } from './mn-stemmer'

describe('mnStem (backward compat)', () => {
  test('strips single suffix', () => {
    expect(mnStem('захиалсан')).toBe('захиал')
    expect(mnStem('баярлаа')).toBe('баяр')
    expect(mnStem('хүргэсэн')).toBe('хүргэ')
  })

  test('respects MIN_STEM_LEN', () => {
    // mnStem only strips one suffix. "авсан" ends with "н" → "авса" (4 chars >= MIN_STEM_LEN)
    // It does NOT try "сан" because "ав" (2 chars) < MIN_STEM_LEN
    expect(mnStem('авсан')).toBe('авса')
    // Short word where no suffix leaves >= 4 chars
    expect(mnStem('бай')).toBe('бай')  // 3 chars, no suffix applies
  })

  test('returns original if no suffix', () => {
    expect(mnStem('бараа')).toBe('бараа')
  })
})

describe('mnStemDeep', () => {
  test('strips multiple suffixes to reach root', () => {
    // захиалсангүй = захиал + сан + гүй
    const r = mnStemDeep('захиалсангүй')
    expect(r.stem).toBe('захиал')
    expect(r.suffixes.map(s => s.suffix)).toEqual(['гүй', 'сан'])
  })

  test('strips negative + past on delivery root', () => {
    // хүргэгдсэнгүй = хүргэ + гдсэн + гүй (passive past + negative)
    // Actually: хүргэгдсэнгүй → strip гүй → хүргэгдсэн → strip гдсэн → хүргэ
    const r = mnStemDeep('хүргэгдсэнгүй')
    expect(r.stem).toBe('хүргэ')
    expect(r.suffixes.map(s => s.suffix)).toEqual(['гүй', 'гдсэн'])
    expect(r.suffixes[0].category).toBe('negative')
    expect(r.suffixes[1].category).toBe('passive')
  })

  test('reaches short known root with desiderative', () => {
    // авмаар = ав + маар (want to buy)
    const r = mnStemDeep('авмаар')
    expect(r.stem).toBe('ав')
    expect(r.suffixes.map(s => s.suffix)).toEqual(['маар'])
    expect(r.suffixes[0].category).toBe('desiderative')
  })

  test('reaches short known root with past tense', () => {
    // ирсэн = ир + сэн (came/arrived)
    const r = mnStemDeep('ирсэн')
    expect(r.stem).toBe('ир')
    expect(r.suffixes.map(s => s.suffix)).toEqual(['сэн'])
  })

  test('strips negative infinitive suffix (short stem fallback)', () => {
    // ирэхгүй: хгүй → ирэ (3 chars, not known) → skip
    // Falls to гүй → ирэх (4 chars) → strips
    const r = mnStemDeep('ирэхгүй')
    expect(r.stem).toBe('ирэх')
    expect(r.suffixes).toHaveLength(1)
    expect(r.suffixes[0].suffix).toBe('гүй')
    expect(r.suffixes[0].category).toBe('negative')
  })

  test('strips хгүй when stem is long enough', () => {
    // захиалахгүй: хгүй → захиала (7 chars) → valid
    const r = mnStemDeep('захиалахгүй')
    expect(r.stem).toBe('захиала')
    expect(r.suffixes[0].suffix).toBe('хгүй')
    expect(r.suffixes[0].category).toBe('negative')
  })

  test('strips negative with гүй fallback when хгүй leaves short stem', () => {
    // явахгүй: хгүй → ява (3 chars, not known root) → skip
    // Falls to гүй → явах (4 chars >= MIN_STEM_LEN) → strips
    const r = mnStemDeep('явахгүй')
    expect(r.stem).toBe('явах')
    expect(r.suffixes[0].category).toBe('negative')
    expect(r.suffixes[0].suffix).toBe('гүй')
  })

  test('handles multi-suffix: past question pattern', () => {
    // захиалсан → захиал + сан
    const r = mnStemDeep('захиалсан')
    expect(r.stem).toBe('захиал')
    expect(r.suffixes[0].category).toBe('tense_past')
  })

  test('handles converb then possessive in deep stem', () => {
    // буцааж → strip ж → буцаа → strip аа → буц (known root!)
    const r = mnStemDeep('буцааж')
    expect(r.stem).toBe('буц')
    expect(r.suffixes.map(s => s.suffix)).toEqual(['ж', 'аа'])
    expect(r.suffixes[0].category).toBe('converb')
    expect(r.suffixes[1].category).toBe('possessive')
  })

  test('handles negative standalone suffix', () => {
    // захиалахгүй = захиала + хгүй → захиала (stem)
    const r = mnStemDeep('захиалахгүй')
    expect(r.stem).toBe('захиала')
    expect(r.suffixes[0].category).toBe('negative')
  })

  test('respects maxLayers parameter', () => {
    const r1 = mnStemDeep('захиалсангүй', 1)
    // Only strip one layer (гүй)
    expect(r1.stem).toBe('захиалсан')
    expect(r1.suffixes).toHaveLength(1)

    const r3 = mnStemDeep('захиалсангүй', 3)
    expect(r3.stem).toBe('захиал')
    expect(r3.suffixes).toHaveLength(2)
  })

  test('does not over-stem short unknown words', () => {
    // "сан" is 3 chars, not a known root — should not strip further
    const r = mnStemDeep('сан')
    expect(r.stem).toBe('сан')
    expect(r.suffixes).toHaveLength(0)
  })

  test('deep stems бараа to known root бар', () => {
    // бараа → strip аа → бар (known root)
    const r = mnStemDeep('бараа')
    expect(r.stem).toBe('бар')
    expect(r.suffixes).toHaveLength(1)
    expect(r.suffixes[0].category).toBe('possessive')
  })

  test('does not stem word with no matching suffix', () => {
    const r = mnStemDeep('хэрэг')
    expect(r.stem).toBe('хэрэг')
    expect(r.suffixes).toHaveLength(0)
  })
})

describe('stemTextDeep', () => {
  test('deep-stems each token', () => {
    expect(stemTextDeep('захиалсангүй байна')).toBe('захиал байна')
  })

  test('handles mixed stemable and non-stemable tokens', () => {
    // бараа → бар (known root), авмаар → ав (known root), байна → байн (strip а? No, "байн" is 4 chars but let's check)
    // Actually байна → strip "а"? No, "а" is not in suffix list. "н" is → байна strip "н"? No, байна ends with "а" not "н".
    // So байна has no suffix match → stays байна
    // Wait: "байна" ends with "аа"? No it ends with "на". Ends with "а"? No single "а" suffix.
    // байна stays as is
    const result = stemTextDeep('бараа авмаар байна')
    expect(result).toBe('бар ав байна')
  })
})
