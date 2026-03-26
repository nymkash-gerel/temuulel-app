/**
 * mn-roots.ts — Known Mongolian root words shorter than MIN_STEM_LEN (4 chars)
 *
 * The deep stemmer uses this set to allow stripping below the 4-char minimum
 * when the result is a known root. Without this, common verbs like "ав" (buy/take)
 * would never be reached by multi-level suffix stripping.
 *
 * Categories:
 *  - Commerce verbs (buy, sell, pay, return)
 *  - Motion verbs (come, go, enter, exit)
 *  - Communication verbs (say, ask, write)
 *  - State verbs (be, have, know)
 *  - Common nouns used in ecommerce context
 */

export const KNOWN_ROOTS: ReadonlySet<string> = new Set([
  // ── Commerce verbs ─────────────────────────────────────────────────────
  'ав',   // take, buy (авах, авмаар, авсан)
  'өг',   // give (өгөх, өгсөн)
  'зар',  // sell, advertise (зарах, зарсан)
  'сол',  // exchange (солих, солиулах)
  'тул',  // pay (төлөх stem variant)
  'төл',  // pay (төлөх)

  // ── Motion verbs ───────────────────────────────────────────────────────
  'ир',   // come, arrive (ирэх, ирсэн)
  'яв',   // go, leave (явах, явсан)
  'ор',   // enter (орох, орсон)
  'гар',  // exit, go out (гарах, гарсан)
  'хүр',  // reach, deliver (хүрэх, хүргэх)
  'буц',  // return (буцах, буцаах)

  // ── Communication verbs ────────────────────────────────────────────────
  'хэл',  // say, tell (хэлэх, хэлсэн)
  'асу',  // ask (асуух, асуусан)
  'бич',  // write (бичих, бичсэн)
  'дуу',  // call (дуудах)
  'яр',   // speak (ярих, ярьсан)

  // ── State / existence verbs ────────────────────────────────────────────
  'бай',  // be, exist (байх, байна, байсан)
  'бол',  // become, be possible (болох, болно)
  'мэд',  // know (мэдэх, мэдсэн)
  'хар',  // see, look (харах, харсан)
  'үз',   // see, view (үзэх, үзсэн)
  'сон',  // be interested (сонирхох stem)
  'хий',  // do, make (хийх, хийсэн)
  'ид',   // eat (идэх, идсэн)
  'уу',   // drink (уух, уусан)

  // ── Action verbs ───────────────────────────────────────────────────────
  'тав',  // put, place (тавих, тавьсан)
  'нэм',  // add (нэмэх, нэмсэн)
  'хас',  // subtract, remove (хасах)
  'шал',  // check (шалгах stem)
  'хүл',  // wait (хүлээх stem)
  'тус',  // help (туслах stem)
  'зөв',  // advise (зөвлөх stem)
  'сан',  // remember, think (санах)
  'хай',  // search (хайх, хайсан)
  'ол',   // find (олох, олсон)
  'алд',  // lose, miss (алдах)
  'өөр',  // change (өөрчлөх stem)

  // ── Ecommerce nouns (short) ────────────────────────────────────────────
  'үнэ',  // price
  'бар',  // product (бараа stem)
  'зах',  // order, market (захиалга stem)
  'ач',   // load, delivery (ачаа stem)
  'төл',  // payment (төлбөр stem)
])
