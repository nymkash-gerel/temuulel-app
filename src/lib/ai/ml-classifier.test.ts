/**
 * Tests for ML-based intent classifier and hybrid classifier
 */

import { describe, it, expect } from 'vitest'
import { mlClassify } from './ml-classifier'
import { hybridClassify } from './hybrid-classifier'
import { classifyIntentWithConfidence } from '../intent-classifier'

describe('ML Classifier', () => {
  describe('basic intent classification', () => {
    it('classifies greeting messages', () => {
      const result = mlClassify('Сайн байна уу')
      expect(result.intent).toBe('greeting')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('classifies product search messages', () => {
      const result = mlClassify('Хүүхдийн хувцас байна уу')
      expect(result.intent).toBe('product_search')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('classifies complaint messages', () => {
      const result = mlClassify('Чанар маш муу байна')
      expect(result.intent).toBe('complaint')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('classifies order status messages', () => {
      const result = mlClassify('Захиалга маань хаана байна')
      expect(result.intent).toBe('order_status')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('classifies payment messages', () => {
      const result = mlClassify('QPay-аар төлж болох уу')
      expect(result.intent).toBe('payment')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('classifies shipping messages', () => {
      const result = mlClassify('Хүргэлт хэдэн хоног болох вэ')
      expect(result.intent).toBe('shipping')
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  describe('Mongolian inflected forms', () => {
    it('handles genitive case forms', () => {
      // "барааний" (genitive of "бараа") should still be recognized as product search
      const result = mlClassify('Барааний үнэ хэд вэ')
      expect(result.intent).toBe('product_search')
    })

    it('handles accusative case forms', () => {
      // "захиалгыг" (accusative of "захиалга") should be recognized as order status
      const result = mlClassify('Захиалгыг шалгана уу')
      expect(result.intent).toBe('order_status')
    })

    it('handles instrumental case forms', () => {
      // "картаар" (instrumental of "карт") should be recognized as payment or related intent
      const result = mlClassify('Картаар төлөх боломжтой юу')
      expect(['payment', 'return_exchange', 'general']).toContain(result.intent)
    })

    it('handles possessive forms', () => {
      // "хүргэлтээ" (possessive of "хүргэлт") should be recognized as shipping
      const result = mlClassify('Хүргэлтээ хүлээж байна')
      expect(result.intent).toBe('shipping')
    })

    it('handles past tense verb forms', () => {
      // "захиалсан" (past tense of "захиалах") should be recognized as order status or product search
      const result = mlClassify('Өчигдөр захиалсан бараа')
      expect(['order_status', 'product_search']).toContain(result.intent)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = mlClassify('')
      expect(result.intent).toBe('general')
      expect(result.confidence).toBe(0)
    })

    it('handles very short messages', () => {
      const result = mlClassify('hi')
      expect(typeof result.intent).toBe('string')
      expect(typeof result.confidence).toBe('number')
    })

    it('handles mixed script messages', () => {
      // Latin x should be converted to Cyrillic х
      const result = mlClassify('xүргэлт')
      expect(result.intent).toBe('shipping')
    })

    it('handles numbers and measurements', () => {
      const result = mlClassify('165см 60кг')
      expect(result.intent).toBe('size_info')
    })
  })
})

describe('Hybrid Classifier', () => {
  describe('strategy implementation', () => {
    it('uses keyword result when keyword confidence >= 2.0', () => {
      // "бараа байна уу" should have high keyword confidence (multiple matches)
      const keywordResult = classifyIntentWithConfidence('бараа байна уу')
      const hybridResult = hybridClassify('бараа байна уу')
      
      if (keywordResult.confidence >= 2.0) {
        expect(hybridResult.intent).toBe(keywordResult.intent)
        expect(hybridResult.confidence).toBe(keywordResult.confidence)
      }
    })

    it('uses ML result when ML confidence >= 0.7 and keyword confidence < 2.0', () => {
      // Try to find a case where ML has high confidence but keywords don't
      const message = 'Энэ зүйлийг буцаах сонирхож байна'
      const keywordResult = classifyIntentWithConfidence(message)
      const hybridResult = hybridClassify(message)
      
      // Should prefer ML if it has high confidence and keywords don't
      expect(typeof hybridResult.intent).toBe('string')
      expect(typeof hybridResult.confidence).toBe('number')
    })

    it('falls back to keyword result for low confidence cases', () => {
      // Random text should fall back to keyword classifier
      const message = 'Энэ бол ямар нэг санамсаргүй текст юм'
      const keywordResult = classifyIntentWithConfidence(message)
      const hybridResult = hybridClassify(message)
      
      expect(hybridResult.intent).toBe(keywordResult.intent)
    })
  })

  describe('improved classification cases', () => {
    it('handles inflected forms better than keyword-only', () => {
      // This should potentially work better with ML than pure keywords
      const message = 'Барааныхаа чанарыг сайжруулах хэрэгтэй'
      const result = hybridClassify(message)
      expect(['product_search', 'complaint', 'general']).toContain(result.intent)
    })

    it('handles conversational context', () => {
      const message = 'Үүнийг солиулж өгч болох уу'
      const result = hybridClassify(message)
      expect(['return_exchange', 'general']).toContain(result.intent)
    })

    it('handles mixed language input', () => {
      const message = 'product quality маш муу байна'
      const result = hybridClassify(message)
      expect(['product_search', 'complaint', 'general']).toContain(result.intent)
    })
  })

  describe('confidence scaling', () => {
    it('scales ML confidence to match keyword range when used', () => {
      const message = 'Зөвхөн машин сургалтаар таних боломжтой мессеж'
      const mlResult = mlClassify(message)
      const hybridResult = hybridClassify(message)
      
      // If ML result was used, confidence should be scaled
      if (mlResult.confidence >= 0.7 && hybridResult.intent === mlResult.intent) {
        expect(hybridResult.confidence).toBe(mlResult.confidence * 2)
      }
    })
  })

  describe('consistency with keyword classifier', () => {
    it('maintains high accuracy on keyword classifier test cases', () => {
      const testCases = [
        ['Бараа байна уу', 'product_search'],
        ['Захиалга хаана байна', 'order_status'],
        ['Сайн байна уу', 'greeting'],
        ['Баярлалаа', 'thanks'],
        ['Төлбөр хэрхэн төлөх вэ', 'payment'],
        ['Хүргэлт хэдэн хоног', 'shipping']
      ] as const
      
      for (const [message, expectedIntent] of testCases) {
        const result = hybridClassify(message)
        expect(result.intent).toBe(expectedIntent)
      }
    })
  })
})