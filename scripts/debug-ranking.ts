import { normalizeText } from '../src/lib/chat-ai'
const query = 'тарпизан өмд'
const normalizedQuery = normalizeText(query)
const queryWords = normalizedQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 2)
const origWords = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2)
const allWords = [...new Set([...queryWords, ...origWords])]
console.log('Query words:', allWords)

const products = [
  { name: 'Кашемир цамц', desc: 'Монгол кашемир, эрэгтэй/эмэгтэй...' },
  { name: 'Тарпизан өмд', desc: 'Тарпизан материал...' },
  { name: 'Бензэн турсик (4ш)', desc: '100% хөвөн...' },
]

for (const p of products) {
  const n = p.name.toLowerCase()
  const d = p.desc.toLowerCase()
  const score = allWords.reduce((s, w) => {
    const nameMatch = n.includes(w)
    const descMatch = d.includes(w)
    console.log(`  "${w}" in "${p.name}": name=${nameMatch}, desc=${descMatch}`)
    return s + (nameMatch ? 3 : descMatch ? 1 : 0)
  }, 0)
  console.log(`  SCORE: ${score}`)
  console.log()
}
