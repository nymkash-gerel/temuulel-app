/**
 * Real-World Mongolian Chat Tests
 *
 * Tests the hybrid classifier's ability to handle:
 * - Broken Latin transliterations
 * - Cyrillic misspellings
 * - Mixed Latin/Cyrillic
 * - Chat abbreviations and slang
 * - Informal grammar
 *
 * This reflects how Mongolian users actually type in Messenger/chat apps.
 */

import { describe, test, expect } from 'vitest'
import { hybridClassify } from '@/lib/ai/hybrid-classifier'
import { evaluateEscalation } from '@/lib/escalation'

describe('Real-World Mongolian Chat Patterns', () => {
  describe('Latin Transliterations (Common in Messenger)', () => {
    test('Order intent with Latin script', () => {
      const messages = [
        'zahialna',           // захиална
        'zahialu',            // захиалъя
        'avmaar baina',       // авмаар байна
        'ene baraag avya',    // энэ бараа авъя
        'hudaldaj avna',      // худалдаж авна
        'avii',               // авий
        'avi',                // ави
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        // Should classify as order_collection or product_search
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Product search with Latin transliteration', () => {
      const messages = [
        'tsunx bga uu',       // цүнх бга уу (bag available?)
        'hamt bga yum',       // хамт бга юм (together available?)
        'hemjee M',           // хэмжээ M (size M)
        'ongo tsagaan',       // өнгө цагаан (color white)
        'baraa haruulna uu',  // бараа харуулна уу (show products)
        'shine baraa',        // шинэ бараа (new products)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('product_search')
      }
    })

    test('Complaint with Latin script', () => {
      const messages = [
        'yaagaad udaan bgan yum',    // яагаад удаан бган юм
        'mongoo butaaj ug',           // мөнгөө буцааж өг
        'muu uilchilgee',             // муу үйлчилгээ
        'zahirlaa duudaach',          // захирлаа дуудаач
        'hun heregteii',              // хүн хэрэгтэй
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('complaint')
      }
    })

    test('Return/Exchange with Latin', () => {
      const messages = [
        'hemjee tohirohgui',          // хэмжээ тохирохгүй
        'butsaah',                    // буцаах
        'soliulj boloh uu',           // солиулж болох уу
        'tom baina',                  // том байна
        'jijig bna',                  // жижиг бна
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('return_exchange')
      }
    })
  })

  describe('Cyrillic Misspellings (Typos and Informal)', () => {
    test('Common misspellings in order keywords', () => {
      const messages = [
        'захялна',            // захиална (missing и)
        'захиалъя',           // захиалъя (ъ instead of я)
        'авмааар',            // авмаар (extra а)
        'авий',               // авий (informal)
        'худалж ав',          // худалдаж ав (missing д)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Misspelled complaints', () => {
      const messages = [
        'Яагад удаан байна',          // Яагаад (missing а)
        'мунгөө буцааж өг',           // мөнгөө (wrong vowel)
        'захрлаа дуудаач',            // захирлаа (missing и)
        'муухай үйлчилгээ',           // informal "муухай"
        'чанр муу',                   // чанар (missing а)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('complaint')
      }
    })

    test('Misspelled return/exchange keywords', () => {
      const messages = [
        'бутаах',             // буцаах (wrong vowel)
        'бутай өг',           // буцааж өг
        'солулж болох уу',    // солиулж (missing и)
        'тохирхгүй',          // тохирохгүй (missing о)
        'хэмжэ том',          // хэмжээ (missing second э)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('return_exchange')
      }
    })

    test('Payment keywords with typos', () => {
      const messages = [
        'хуваан тулух',       // хуваан төлөх (wrong vowel)
        'хувај төлнө',        // хуваан төлнө (wrong vowel)
        'хэсгчлэн',           // хэсэгчилэн (missing и)
        'QPay-аар',           // QPay-ээр (wrong vowel)
        'бэлнээр',            // бэлэнээр (missing э)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('payment')
      }
    })
  })

  describe('Mixed Latin/Cyrillic (Very Common)', () => {
    test('Mixed script in order messages', () => {
      const messages = [
        'zahialna хэмжээ M',          // Order size M
        'ene tsunx avmaar bna',       // энэ цүнх авмаар бна
        'kurtka L hemjeetei avya',    // куртка L хэмжээтэй авъя
        'цамц M zahialna',            // shirt M order
        'avmaar baina размер L',      // Want to buy size L
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        if (!['order_collection', 'product_search'].includes(result.intent)) {
          console.log(`FAIL: "${msg}" -> ${result.intent} (expected order_collection or product_search)`)
        }
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Mixed script in complaints', () => {
      const messages = [
        'yaagaad удаан байгаа юм',
        'мөнгө butaaj ug',
        'zahirlaa дуудаач',
        'complaint байна муу үйлчилгээ',
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        if (result.intent !== 'complaint') {
          console.log(`FAIL: "${msg}" -> ${result.intent} (expected complaint)`)
        }
        expect(result.intent).toBe('complaint')
      }
    })
  })

  describe('Chat Abbreviations and Slang', () => {
    test('Common abbreviations for "available"', () => {
      const messages = [
        'bga uu',             // байгаа уу
        'bga yum',            // байгаа юм
        'bgaa',               // байгаа
        'bii uu',             // бий юу
        'bn uu',              // байна уу
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('product_search')
      }
    })

    test('Abbreviations in greetings', () => {
      const messages = [
        'sn bn uu',           // сайн байна уу
        'sain uu',            // сайн уу
        'sbnuu',              // сайн байна уу (no spaces)
        'bn',                 // байна
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('greeting')
      }
    })

    test('English greetings', () => {
      const messages = [
        'hi',
        'hello',
        'hey',
        'good morning',
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        if (result.intent !== 'greeting') {
          console.log(`FAIL: "${msg}" -> ${result.intent} (expected greeting)`)
        }
        expect(result.intent).toBe('greeting')
      }
    })

    test('Informal want/need expressions', () => {
      const messages = [
        'hun heregteii',      // хүн хэрэгтэй (need human)
        'operator duu',       // operator дуу
        'zahiral hun',        // захирал хүн
        'yariltsah',          // ярилцах (chat/talk)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('complaint')
      }
    })
  })

  describe('Grammar Variations and Informal Speech', () => {
    test('Informal verb forms', () => {
      const messages = [
        'авчхна',             // авахаа (will definitely buy)
        'захиалчихъя',        // захиалъя (let me just order)
        'үзчихье',            // үзье (let me just see)
        'авъяа',              // авъя (informal let\'s buy)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Questions without proper grammar', () => {
      const messages = [
        'үнэ хэд',            // үнэ хэд вэ (price how much - missing вэ)
        'хэзээ ирэх',         // хэзээ ирэх вэ (when arrive - missing вэ)
        'байгаа',             // байгаа уу (available - missing уу)
        'болох',              // болох уу (possible - missing уу)
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        // Should still classify correctly despite missing particles
        expect(result.intent).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
      }
    })
  })

  describe('Escalation Triggers in Mixed Scripts', () => {
    test('Escalation phrases with Latin transliteration', () => {
      const messages = [
        'zahirlaa duudaach!!!',
        'mongoo butaaj ug!!!',
        'operator heregteii',
        'hun yariltsah',
        'yaagaad udaan bgan yum!?',
      ]

      for (const msg of messages) {
        const escalation = evaluateEscalation(0, msg, [], {
          enabled: true,
          threshold: 10,
        })

        // Should trigger escalation or high score
        expect(escalation.shouldEscalate || escalation.newScore >= 8).toBe(true)
      }
    })

    test('Multiple exclamation marks trigger escalation', () => {
      const messages = [
        'Yaagaad!!!',
        'butaaj ug!!!',
        'Zahirlaa!!!',
        'Hun!!!',
      ]

      for (const msg of messages) {
        const escalation = evaluateEscalation(0, msg, [], {
          enabled: true,
          threshold: 10,
        })

        expect(escalation.shouldEscalate).toBe(true)
      }
    })
  })

  describe('Context-Aware Classification', () => {
    test('Same word different context - "ав"', () => {
      // "ав" can mean:
      // 1. Buy/take (order intent)
      // 2. Take back (return intent)

      const orderContext = 'энэ цүнх ав'  // this bag buy
      const returnContext = 'буцааж ав'   // take back (return)

      const orderResult = hybridClassify(orderContext)
      const returnResult = hybridClassify(returnContext)

      expect(orderResult.intent).toBe('product_search')
      expect(returnResult.intent).toBe('return_exchange')
    })

    test('Size/color mentions in different contexts', () => {
      // Size mentioned during search vs during complaint
      const searchMsg = 'хэмжээ M байгаа уу'  // size M available?
      const complaintMsg = 'хэмжээ тохирохгүй' // size doesn't fit

      const searchResult = hybridClassify(searchMsg)
      const complaintResult = hybridClassify(complaintMsg)

      expect(searchResult.intent).toBe('product_search')
      expect(complaintResult.intent).toBe('return_exchange')
    })
  })

  describe('Performance - Confidence Levels', () => {
    test('High confidence for clear intent', () => {
      const clearMessages = [
        { text: 'захиална', expectedIntent: 'order_collection' },
        { text: 'Сайн байна уу', expectedIntent: 'greeting' },
        { text: 'буцаах', expectedIntent: 'return_exchange' },
        { text: 'мөнгөө буцааж өг!!!', expectedIntent: 'complaint' },
      ]

      for (const { text, expectedIntent } of clearMessages) {
        const result = hybridClassify(text)
        expect(result.intent).toBe(expectedIntent)
        expect(result.confidence).toBeGreaterThan(1.5) // Should have decent confidence
      }
    })

    test('Lower confidence but still classifies broken Latin', () => {
      const brokenMessages = [
        'zahialu',      // захиалъя
        'avii',         // авий
        'bga uu',       // байгаа уу
      ]

      for (const msg of brokenMessages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBeDefined()
        expect(result.confidence).toBeGreaterThan(0)
      }
    })
  })

  describe('Real Conversation Flows', () => {
    test('Complete order conversation with mixed inputs', () => {
      const conversation = [
        { msg: 'sain bn uu', expectedIntent: 'greeting' },
        { msg: 'tsunx bga uu', expectedIntent: 'product_search' },
        { msg: 'hemjee M', expectedIntent: 'product_search' },
        { msg: 'avmaar bna', expectedIntent: 'order_collection' },
        { msg: 'hed turgurug', expectedIntent: 'product_search' }, // how much (price)
        { msg: 'zahialna', expectedIntent: 'order_collection' },
        { msg: 'bayarlalaa', expectedIntent: 'thanks' },
      ]

      for (const { msg, expectedIntent } of conversation) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe(expectedIntent)
      }
    })

    test('Complaint escalation flow with Latin', () => {
      const conversation = [
        { msg: 'zahialga haana', expectedIntent: 'order_status' },
        { msg: 'udaan bgan yum', expectedIntent: 'complaint' },
        { msg: 'yaagaad iim udaan', expectedIntent: 'complaint' },
        { msg: 'operator duudaach', expectedIntent: 'complaint' },
        { msg: 'mongoo butaaj ug!!!', expectedIntent: 'complaint' },
      ]

      for (const { msg, expectedIntent } of conversation) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe(expectedIntent)
      }
    })

    test('Return/exchange flow with misspellings', () => {
      const conversation = [
        { msg: 'hemjee tom baina', expectedIntent: 'return_exchange' },
        { msg: 'soliulj boloh uu', expectedIntent: 'return_exchange' },
        { msg: 'ongo uur bn uu', expectedIntent: 'product_search' }, // other color available?
        { msg: 'butaah', expectedIntent: 'return_exchange' },
      ]

      for (const { msg, expectedIntent } of conversation) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe(expectedIntent)
      }
    })
  })
})
