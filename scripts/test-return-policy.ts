/**
 * Test the return/exchange policy feature with real OpenAI calls.
 *
 * Tests both the deterministic template and the contextual AI (LLM) responses
 * for return/exchange questions, with and without a configured policy.
 *
 * Usage:  npx tsx scripts/test-return-policy.ts
 */

import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import {
  classifyIntentWithConfidence,
  generateResponse,
  generateAIResponse,
  ChatbotSettings,
  MessageHistoryEntry,
} from '../src/lib/chat-ai'

// ── Standard Return Policy ──────────────────────────────────────────────────

const STANDARD_RETURN_POLICY = `Бараа хүлээн авснаас хойш 14 хоногийн дотор буцаах боломжтой.

Нөхцөлүүд:
• Шошго хадгалагдсан, хэрэглээгүй байх
• Анхны сав баглаа бүрэн байх
• Худалдан авалтын баримт шаардлагатай

Буцаалтын хураамж: 5,000₮
Солилт: Үнэгүй (зөвхөн размер, өнгө солих)
Хугацаа: Буцаалт 3-5 ажлын өдөрт шийдвэрлэгдэнэ.

Буцаах боломжгүй бараа: Дотуур хувцас, нүүрний тос, хувийн эрүүл ахуйн бүтээгдэхүүн.`

// ── Test Messages ───────────────────────────────────────────────────────────

const testMessages = [
  // Mongolian return questions
  'Буцаах боломжтой юу?',
  'Солих боломж байгаа юу?',
  'Буцаалт хийж болох уу?',
  'Хэмжээ тохирохгүй байна, өөр размер солиулж болох уу?',
  'Буцаах бодлого юу вэ?',
  'Буцаалтын хураамж хэд вэ?',

  // English return questions
  'Can I return this item?',
  'What is your return policy?',
  'I want to exchange for a different size',

  // Multi-turn conversation scenarios
  'Өчигдөр авсан хувцас тохирохгүй байна',
]

// Conversation history for multi-turn test
const multiTurnHistory: MessageHistoryEntry[] = [
  { role: 'user', content: 'Сайн байна уу' },
  { role: 'assistant', content: 'Сайн байна уу! Танд юугаар туслах вэ?' },
  { role: 'user', content: 'Өчигдөр захиалсан хувцас ирсэн' },
  { role: 'assistant', content: 'Баяр хүргэе! Хувцас таалагдсан уу?' },
]

// ── Mock products (for context) ─────────────────────────────────────────────

const mockProducts = [
  {
    id: 'p1',
    name: 'Эрэгтэй турсик XL',
    description: 'Өвлийн хар турсик, XL размер',
    category: 'clothing',
    base_price: 89000,
    images: [],
    sales_script: null,
    product_faqs: {
      size_fit: 'S: 55-60кг, M: 60-70кг, L: 70-80кг, XL: 80-90кг',
      material: '100% полиэстер, дотор нь хөвөн',
    },
  },
]

// ── Run Tests ───────────────────────────────────────────────────────────────

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║        RETURN/EXCHANGE POLICY — OpenAI Integration Test        ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log()

  // ── Part 1: Intent Classification ──────────────────────────────────────

  console.log('━━━ PART 1: Intent Classification ━━━')
  console.log()

  for (const msg of testMessages) {
    const { intent, confidence } = classifyIntentWithConfidence(msg)
    const isReturn = intent === 'return_exchange'
    const status = isReturn ? '✅' : '⚠️'
    console.log(`${status} "${msg}"`)
    console.log(`   → intent: ${intent} (confidence: ${confidence})`)
    console.log()
  }

  // ── Part 2: Deterministic Templates ────────────────────────────────────

  console.log('━━━ PART 2: Deterministic Templates ━━━')
  console.log()

  const settingsWithPolicy: ChatbotSettings = {
    tone: 'friendly',
    language: 'mn',
    return_policy: STANDARD_RETURN_POLICY,
  }

  const settingsWithoutPolicy: ChatbotSettings = {
    tone: 'friendly',
    language: 'mn',
  }

  console.log('📋 WITH return policy configured:')
  console.log('─'.repeat(70))
  const withPolicy = generateResponse('return_exchange', [], [], 'GOOD TRADE', settingsWithPolicy)
  console.log(withPolicy)
  console.log()

  console.log('📋 WITHOUT return policy configured:')
  console.log('─'.repeat(70))
  const withoutPolicy = generateResponse('return_exchange', [], [], 'GOOD TRADE', settingsWithoutPolicy)
  console.log(withoutPolicy)
  console.log()

  // ── Part 3: AI Responses (OpenAI) ──────────────────────────────────────

  console.log('━━━ PART 3: AI Responses (OpenAI gpt-4o-mini) ━━━')
  console.log()

  const aiTestCases = [
    {
      label: 'Simple return question (with policy)',
      message: 'Буцаах боломжтой юу?',
      settings: settingsWithPolicy,
      history: [
        { role: 'user' as const, content: 'Сайн байна уу' },
        { role: 'assistant' as const, content: 'Сайн байна уу! Танд юугаар туслах вэ?' },
      ],
    },
    {
      label: 'Exchange request with product context',
      message: 'Хэмжээ тохирохгүй байна, солиулж болох уу?',
      settings: settingsWithPolicy,
      history: [
        { role: 'user' as const, content: 'Сайн байна уу' },
        { role: 'assistant' as const, content: 'Сайн байна уу! Танд юугаар туслах вэ?' },
        { role: 'user' as const, content: 'Өчигдөр турсик авсан' },
        { role: 'assistant' as const, content: 'Турсик таалагдсан уу? Ямар нэг асуулт байвал бичнэ үү!' },
      ],
    },
    {
      label: 'Return policy question (English)',
      message: 'What is your return policy?',
      settings: settingsWithPolicy,
      history: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Сайн байна уу! Танд юугаар туслах вэ?' },
      ],
    },
    {
      label: 'Refund timeline question',
      message: 'Буцаалт хэдэн хоногт шийдэгдэх вэ?',
      settings: settingsWithPolicy,
      history: [
        { role: 'user' as const, content: 'Буцаах боломжтой юу?' },
        { role: 'assistant' as const, content: 'Тийм, 14 хоногийн дотор буцаах боломжтой.' },
      ],
    },
    {
      label: 'No policy configured — should defer to manager',
      message: 'Буцаах боломжтой юу?',
      settings: settingsWithoutPolicy,
      history: [
        { role: 'user' as const, content: 'Сайн байна уу' },
        { role: 'assistant' as const, content: 'Сайн байна уу! Танд юугаар туслах вэ?' },
      ],
    },
    {
      label: 'Complex multi-turn return scenario',
      message: 'Тэгвэл буцааж өгье. Яаж буцаах вэ?',
      settings: settingsWithPolicy,
      history: multiTurnHistory,
    },
  ]

  for (const tc of aiTestCases) {
    console.log(`🤖 ${tc.label}`)
    console.log(`   Q: "${tc.message}"`)
    console.log('─'.repeat(70))

    try {
      const { intent } = classifyIntentWithConfidence(tc.message)
      const response = await generateAIResponse(
        intent,
        mockProducts,
        [],
        'GOOD TRADE',
        tc.message,
        tc.settings,
        tc.history
      )
      console.log(`   Intent: ${intent}`)
      console.log(`   AI Response:`)
      console.log(`   ${response.replace(/\n/g, '\n   ')}`)
    } catch (error) {
      console.log(`   ❌ Error: ${error}`)
    }
    console.log()
  }

  console.log('═'.repeat(70))
  console.log('TEST COMPLETE')
  console.log('═'.repeat(70))
}

runTests().catch(console.error)
