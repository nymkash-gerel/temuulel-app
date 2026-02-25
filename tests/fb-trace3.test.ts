import { it } from 'vitest'
import { normalizeText, neutralizeVowels } from '../src/lib/text-normalizer'
import { stemText, stemKeyword } from '../src/lib/mn-stemmer'

// Directly access the pre-computed keyword maps (bypass the module's closure)
// by re-implementing the same scoring for a single intent

function prefixMatchWord(normalizedMsg: string, keyword: string): string | null {
  const MIN_PREFIX_LEN = 4
  if (keyword.length < MIN_PREFIX_LEN) return null
  const words = normalizedMsg.split(' ')
  return words.find((w) => w.startsWith(keyword) || (keyword.startsWith(w) && w.length >= MIN_PREFIX_LEN)) ?? null
}

it('trace each scoring path for цагаан нь байгаа юмуу', () => {
  const msg = 'Цагаан нь байгаа юмуу?'
  const norm = normalizeText(msg)
  const padded = ` ${norm} `
  const neutralPadded = ` ${neutralizeVowels(norm)} `
  const stemmed = stemText(norm)
  const stemmedPadded = ` ${stemmed} `
  console.log('padded:', padded)
  console.log('neutralPadded:', neutralPadded)
  console.log('stemmedPadded:', stemmedPadded)

  // All complaint keywords from intent-classifier.ts
  const complaintKws = [
    'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа', 'сэтгэл ханамжгүй', 'чанар',
    'complaint', 'problem', 'issue', 'broken', 'damaged', 'defective',
    'wrong', 'bad', 'terrible', 'not working', 'disappointed', 'unhappy', 'angry',
    'гомдоллох', 'гомдоол', 'асуудал гарсан', 'проблем',
    'муухай', 'маш муу', 'хэрэггүй', 'буруугаар',
    'чанаргүй', 'чанар муу', 'эвдэрсэн', 'гэмтсэн', 'гэмтэл',
    'уурласан', 'бухимдсан', 'хариуцлага', 'хариуцлагагүй',
    'мөнгө буцаах', 'мөнгөө буцааж өг', 'мөнгө буцаа',
    'yaagaad', 'yaagad', 'yagaad',
    'mongoo butaaj ug', 'mongoo butaaj', 'mongoo butaa', 'mungu butaaj',
    'muu uilchilgee', 'muu uilchilge', 'muuhay',
    'zahirlaa duudaach', 'zahirlaa duu', 'zahiral hun',
    'hun heregteii', 'hun heregteй', 'operator heregteii',
    'operator duu', 'operator duudaach',
    'udaan bgan', 'udaan baina', 'udaan yum',
    'yariltsah', 'yariltsya', 'yarilts',
    'хүнтэй ярих', 'хүн дуудах', 'хүн хэрэгтэй', 'хүнтэй холбогдох',
    'амьд хүн', 'оператор дуудах', 'менежер дуудах', 'менежер хэрэгтэй',
    'ярих уу', 'яриад болох уу', 'хүнтэй харилцах',
    'irehgui', 'ireegui', 'ireedgui', 'baraa irehgui', 'baraa ireegui',
  ]

  let score = 0
  for (const kw of complaintKws) {
    const nkw = normalizeText(kw)
    if (padded.includes(` ${nkw} `)) {
      score += 1
      console.log(`  [+1.0 exact] "${kw}" → norm="${nkw}"`)
    } else if (neutralPadded.includes(` ${neutralizeVowels(nkw)} `)) {
      score += 1
      console.log(`  [+1.0 vowel-neutral] "${kw}" → neutral="${neutralizeVowels(nkw)}"`)
    } else {
      const mw = prefixMatchWord(norm, nkw)
      if (mw) {
        score += 0.5
        console.log(`  [+0.5 prefix] "${kw}" matched word "${mw}"`)
      }
    }
    // Stem check
    const stemKw = stemKeyword(nkw)
    if (stemmedPadded.includes(` ${stemKw} `) && stemKw !== nkw) {
      console.log(`  [stem match] "${kw}" → stem="${stemKw}"`)
    }
  }
  console.log(`\nTotal from known complaint keywords: ${score}`)
  console.log('(actual classifier says 4.0 — some keywords must be missing from this list)')
})
