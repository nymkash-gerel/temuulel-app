import { it } from 'vitest'
import { normalizeText, neutralizeVowels } from '../src/lib/text-normalizer'
import { stemText, stemKeyword } from '../src/lib/mn-stemmer'

it('trace complaint:4.0 for availability question', () => {
  const msg = 'Цагаан нь байгаа юмуу?'
  const norm = normalizeText(msg)
  const neutralNorm = neutralizeVowels(norm)
  const padded = ` ${norm} `
  const neutralPadded = ` ${neutralNorm} `
  const stemmed = stemText(norm)
  const stemmedPadded = ` ${stemmed} `

  console.log('norm:', norm)
  console.log('neutral:', neutralNorm)
  console.log('stemmed:', stemmed)
  console.log('words:', norm.split(/\s+/))

  // Complaint keywords from intent-classifier
  const complaintKeywords = [
    'гомдол', 'асуудал', 'буруу', 'дутуу', 'хэтэрсэн', 'эвдэрсэн', 'гэмтсэн',
    'гэмтэл', 'хугарсан', 'ажиллахгүй', 'ажиллахгуй', 'хоцорсон', 'удаан', 'хүлээж',
    'ирэхгүй', 'ирдэггүй', 'авсангүй', 'ирсэнгүй', 'delivered', 'not delivered',
    'муу', 'маш муу', 'ямар муу', 'яасан муу', 'муухай',
    'луйвар', 'хуурамч', 'хулгай', 'complaint', 'angry', 'disappointed',
    'уурласан', 'бухимдсан', 'хариуцлага', 'хариуцлагагүй',
    'мөнгө буцаах', 'мөнгөө буцааж өг', 'мөнгө буцаа',
    'yaagaad', 'yaagad', 'yagaad', 'mongoo butaaj ug', 'mongoo butaaj', 'mongoo butaa', 'mungu butaaj',
    'ирехгуи', 'иреегуи', 'хүнтэй ярих', 'хүн хэрэгтэй', 'хүн дуудах', 'оператор дуудах', 'менежер дуудах',
    'яасан юм', 'яасан', 'болохгүй юу', 'боломжгүй', 'шийдэхгүй', 'яагаад болохгүй',
    'ирэхгүй байна', 'ирсэнгүй', 'явсангүй', 'байхгүй',
    'удаан байна', 'хэзээ болох',
    'гомдоллох', 'зарга', 'хариуцна', 'хариуцах',
  ]
  
  console.log('\n--- Matching complaint keywords ---')
  let totalScore = 0
  for (const kw of complaintKeywords) {
    const normKw = normalizeText(kw)
    const neutralKw = neutralizeVowels(normKw)
    const stemKw = stemKeyword(normKw)
    
    const exactMatch = padded.includes(` ${normKw} `)
    const neutralMatch = !exactMatch && neutralPadded.includes(` ${neutralKw} `)
    const stemMatch = !exactMatch && !neutralMatch && stemmedPadded.includes(` ${stemKw} `)
    
    if (exactMatch || neutralMatch || stemMatch) {
      const score = exactMatch ? 1.0 : neutralMatch ? 1.0 : 0.75
      totalScore += score
      console.log(`  [+${score}] "${kw}" (${exactMatch?'exact':neutralMatch?'vowel-neutral':'stem'})`)
    }
  }
  console.log(`Total (known keywords): ${totalScore}`)
  console.log('\nNote: actual score=4.0 — there are more complaint keywords in the real classifier')
})
