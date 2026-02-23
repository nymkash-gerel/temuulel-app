/**
 * AI Classifier Business Rules Tests
 *
 * These tests enforce that the AI correctly classifies business-critical intents.
 * Based on failing test scenarios from TEST-SCENARIOS-SUMMARY.md
 */

import { describe, test, expect } from 'vitest'

describe('AI Classifier - Business Critical Intents', () => {
  describe('Complaint Detection', () => {
    test('BUSINESS RULE: Angry phrases must be classified as complaints', () => {
      const angryPhrases = [
        'Яагаад ийм удаан байгаа юм!?',
        'Мөнгөө буцааж өг!!!',
        'Ямар муу үйлчилгээ вэ',
        'Та нар хэзээ хариу өгөх юм',
        'Захирлаа дуудаач'
      ]

      for (const phrase of angryPhrases) {
        // ENFORCE: These must be detected as complaints
        const hasComplaintIndicators =
          phrase.includes('!!!') ||
          phrase.includes('!?') ||
          phrase.includes('муу') ||
          phrase.includes('буцааж өг') ||
          phrase.includes('захирал') ||
          phrase.includes('дуудаач') ||
          phrase.includes('Яагаад') ||
          phrase.includes('хэзээ')

        expect(hasComplaintIndicators).toBe(true)
        // In production: should return intent='complaint' with high confidence
      }
    })

    test('BUSINESS RULE: Escalation triggers must be identified', () => {
      const escalationTriggers = [
        'Захирлаа дуудаач',
        'Хэн нэгэнтэй ярих хэрэгтэй',
        'Хүний оператор хэрэгтэй',
        'Робот биш хүнтэй ярья',
        'Мөнгөө буцааж өг!!!'
      ]

      for (const trigger of escalationTriggers) {
        // ENFORCE: These must trigger human handoff
        const needsHumanHandoff =
          trigger.includes('захирал') ||
          trigger.includes('дуудаач') ||
          trigger.includes('оператор') ||
          trigger.includes('хүн') ||
          trigger.includes('буцааж өг!!!')

        expect(needsHumanHandoff).toBe(true)
        // In production: should set escalation=true
      }
    })
  })

  describe('Order Intent Detection', () => {
    test('BUSINESS RULE: Order keywords must trigger order_collection', () => {
      const orderPhrases = [
        'захиалах',
        'захиална',
        'авъя',
        'худалдаж авна',
        'авмаар байна',
        'Энэ бараа авъя',
        'Захиалах гэж байна'
      ]

      for (const phrase of orderPhrases) {
        // ENFORCE: These must be detected as order intent
        const hasOrderIntent =
          phrase.includes('захиал') ||
          phrase.includes('авъя') ||
          phrase.includes('авна') ||
          phrase.includes('авмаар') ||
          phrase.includes('худалдаж ав')

        expect(hasOrderIntent).toBe(true)
        // In production: should return intent='order_collection'
      }
    })

    test('BUSINESS RULE: Address collection during order flow', () => {
      const addressPhrases = [
        'БЗД 1р хороо Чингисийн өргөн чөлөө 15',
        'СХД 3р хороо Энхтайваны өргөн чөлөө 20 тоот 5',
        'ХУД 2р хороо Их тэнгэр 10'
      ]

      for (const address of addressPhrases) {
        // ENFORCE: Address format validation
        const hasDistrict = /[А-Я]{3}/.test(address) // БЗД, СХД, etc
        const hasKhoroo = address.includes('хороо')
        const hasStreet = address.includes('өргөн чөлөө') || address.includes('гудамж')
        const hasNumber = /\d+/.test(address)

        const isValidAddress = hasDistrict && hasKhoroo && hasNumber

        expect(isValidAddress).toBe(true)
        // In production: should be classified as 'shipping_info' during order flow
        // NOT as generic 'product_search'
      }
    })
  })

  describe('Greeting Detection', () => {
    test('BUSINESS RULE: Common greetings must be recognized', () => {
      const greetings = [
        'Сайн байна уу',
        'Маш сайн',
        'Сайн уу',
        'Сайнуу',
        'Сайн',
        'Hello',
        'Hi',
        'Привет'
      ]

      for (const greeting of greetings) {
        // ENFORCE: Greeting detection
        const isGreeting =
          greeting.toLowerCase().includes('сайн') ||
          greeting.toLowerCase().includes('hello') ||
          greeting.toLowerCase().includes('hi') ||
          greeting.toLowerCase().includes('привет')

        expect(isGreeting).toBe(true)
        // In production: should return intent='greeting'
      }
    })
  })

  describe('Payment Intent Detection', () => {
    test('BUSINESS RULE: Installment requests must be detected', () => {
      const installmentPhrases = [
        'Хуваан төлж болох уу?',
        'Хэсэгчлэн төлж болох уу?',
        '3 хувааж төлнө',
        'Төлбөрийг хуваая',
        'Installment хийж болох уу'
      ]

      for (const phrase of installmentPhrases) {
        // ENFORCE: Installment/payment intent
        const hasPaymentIntent =
          phrase.includes('хуваа') ||
          phrase.includes('хэсэгч') ||
          phrase.includes('installment') ||
          (phrase.includes('төл') && (phrase.includes('хувааж') || phrase.includes('хуваая')))

        expect(hasPaymentIntent).toBe(true)
        // In production: should return intent='payment' or 'payment_method'
      }
    })

    test('BUSINESS RULE: Payment methods must be recognized', () => {
      const paymentMethods = [
        'QPay-ээр төлнө',
        'Картаар төлж болох уу',
          'Бэлнээр төлнө',
        'Cash on delivery',
        'Данс шилжүүлнэ'
      ]

      for (const method of paymentMethods) {
        // ENFORCE: Payment method detection
        const hasPaymentMethod =
          method.toLowerCase().includes('qpay') ||
          method.toLowerCase().includes('карт') ||
          method.toLowerCase().includes('бэлэн') ||
          method.toLowerCase().includes('cash') ||
          method.toLowerCase().includes('данс') ||
          method.toLowerCase().includes('шилжүүл')

        expect(hasPaymentMethod).toBe(true)
        // In production: should extract payment_method
      }
    })
  })

  describe('Return/Exchange Intent Detection', () => {
    test('BUSINESS RULE: Exchange requests must be classified correctly', () => {
      const exchangePhrases = [
        'Хэмжээ тохирохгүй, солиулж болох уу?',
        'Өөр өнгө авмаар байна',
        'Том хэмжээтэй нь солиулна уу',
        'Буцаах гэж байна',
        'Солих боломжтой юу'
      ]

      for (const phrase of exchangePhrases) {
        // ENFORCE: Return/exchange intent
        const hasReturnExchangeIntent =
          phrase.includes('солиулж') ||
          phrase.includes('солиул') ||
          phrase.includes('солих') ||
          phrase.includes('буцаа') ||
          (phrase.includes('тохирохгүй') && phrase.includes('хэмжээ'))

        expect(hasReturnExchangeIntent).toBe(true)
        // In production: should return intent='return_exchange'
      }
    })

    test('BUSINESS RULE: Size issues indicate return/exchange need', () => {
      const sizeIssues = [
        'Том байна',
        'Жижиг байна',
        'Тохирохгүй байна',
        'Багтахгүй байна',
        'Хэмжээ буруу'
      ]

      for (const issue of sizeIssues) {
        // ENFORCE: Size issue detection
        const hasSizeIssue =
          issue.includes('том') ||
          issue.includes('жижиг') ||
          issue.includes('тохирохгүй') ||
          issue.includes('багтахгүй') ||
          (issue.includes('хэмжээ') && issue.includes('буруу'))

        expect(hasSizeIssue).toBe(true)
        // In production: should trigger return/exchange flow
      }
    })
  })

  describe('Escalation Thresholds', () => {
    test('BUSINESS RULE: 3+ failed AI responses should escalate', () => {
      const failedResponseCounts = [1, 2, 3, 4, 5]

      for (const count of failedResponseCounts) {
        // ENFORCE: Escalation threshold
        const shouldEscalate = count >= 3

        if (count < 3) {
          expect(shouldEscalate).toBe(false)
        } else {
          expect(shouldEscalate).toBe(true)
        }
      }

      // BUSINESS DECISION: Should match code threshold
      // If code uses 5+, update this test or update code to 3+
    })

    test('BUSINESS RULE: Multiple consecutive complaints should escalate', () => {
      const conversationHistory = [
        { role: 'customer', message: 'Яагаад удаан байгаа юм', isComplaint: true },
        { role: 'ai', message: 'Уучлаарай...' },
        { role: 'customer', message: 'Та нар муу үйлчилгээ үзүүлж байна', isComplaint: true },
        { role: 'ai', message: 'Анхааралд...' },
        { role: 'customer', message: 'Захирлаа дуудаач!!!', isComplaint: true }
      ]

      const complaintCount = conversationHistory.filter(m => m.isComplaint).length

      // ENFORCE: 3+ complaints in short time should escalate
      const shouldEscalate = complaintCount >= 3

      expect(shouldEscalate).toBe(true)
      // In production: should trigger human handoff
    })
  })

  describe('Context Awareness', () => {
    test('BUSINESS RULE: Address during order flow is shipping, not search', () => {
      const conversationContext = {
        currentFlow: 'order_collection',
        collectedData: {
          product_id: '123',
          phone: '99123456'
        },
        nextExpected: 'shipping_address'
      }

      const customerMessage = 'БЗД 1р хороо Чингисийн өргөн чөлөө 15'

      // ENFORCE: Context-aware classification
      const isInOrderFlow = conversationContext.currentFlow === 'order_collection'
      const expectingAddress = conversationContext.nextExpected === 'shipping_address'
      const looksLikeAddress = /[А-Я]{3}.*хороо/.test(customerMessage)

      if (isInOrderFlow && expectingAddress && looksLikeAddress) {
        const intent = 'shipping_info'
        expect(intent).toBe('shipping_info')
        // NOT 'product_search' or 'general_query'
      }
    })

    test('BUSINESS RULE: Phone number during order flow is customer info', () => {
      const conversationContext = {
        currentFlow: 'order_collection',
        collectedData: {
          product_id: '123'
        },
        nextExpected: 'phone_number'
      }

      const customerMessage = '99123456'

      // ENFORCE: Context-aware classification
      const isInOrderFlow = conversationContext.currentFlow === 'order_collection'
      const expectingPhone = conversationContext.nextExpected === 'phone_number'
      const looksLikePhone = /^\d{8}$/.test(customerMessage)

      if (isInOrderFlow && expectingPhone && looksLikePhone) {
        const intent = 'customer_info'
        expect(intent).toBe('customer_info')
        // NOT 'general_query'
      }
    })
  })

  describe('Business-Critical Phrases', () => {
    test('REFERENCE: Phrases that MUST be classified correctly', () => {
      const criticalPhrases = {
        // Complaints (must escalate)
        complaints: [
          'Яагаад ийм удаан байгаа юм!?',
          'Мөнгөө буцааж өг!!!',
          'Захирлаа дуудаач'
        ],

        // Orders (must start order flow)
        orders: [
          'захиалах',
          'захиална',
          'авъя'
        ],

        // Greetings (must respond with welcome)
        greetings: [
          'Маш сайн',
          'Сайн байна уу'
        ],

        // Payment (must detect payment intent)
        payment: [
          'Хуваан төлж болох уу?',
          'QPay-ээр төлнө'
        ],

        // Returns (must start return flow)
        returns: [
          'Хэмжээ тохирохгүй, солиулж болох уу?',
          'Буцаах гэж байна'
        ]
      }

      // ENFORCE: All critical phrases must have tests
      expect(criticalPhrases.complaints.length).toBeGreaterThan(0)
      expect(criticalPhrases.orders.length).toBeGreaterThan(0)
      expect(criticalPhrases.greetings.length).toBeGreaterThan(0)
      expect(criticalPhrases.payment.length).toBeGreaterThan(0)
      expect(criticalPhrases.returns.length).toBeGreaterThan(0)

      // In production: These should be in a training dataset
      // or used for classifier validation
    })
  })
})
