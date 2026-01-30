/**
 * Tests for chat AI intent classification and response generation.
 * Now imports directly from the shared module.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyIntent,
  extractSearchTerms,
  formatPrice,
  generateResponse,
  ProductMatch,
  OrderMatch,
  ChatbotSettings,
} from '@/lib/chat-ai'

// ---- Tests ----

describe('classifyIntent', () => {
  it('classifies Mongolian greeting', () => {
    expect(classifyIntent('Сайн байна уу')).toBe('greeting')
  })

  it('classifies English greeting', () => {
    expect(classifyIntent('hello')).toBe('greeting')
    expect(classifyIntent('Hi there')).toBe('greeting')
  })

  it('classifies product search', () => {
    expect(classifyIntent('Хувцас байна уу')).toBe('product_search')
    expect(classifyIntent('Гутал хайх')).toBe('product_search')
    expect(classifyIntent('Ямар бараа байгаа')).toBe('product_search')
  })

  it('classifies order status inquiry', () => {
    expect(classifyIntent('Захиалга хаана байна')).toBe('order_status')
    // "Хүргэлт хэзээ ирэх вэ" = "When will delivery arrive" → shipping (delivery-focused)
    expect(classifyIntent('Хүргэлт хэзээ ирэх вэ')).toBe('shipping')
  })

  it('classifies thanks', () => {
    expect(classifyIntent('Баярлалаа')).toBe('thanks')
    expect(classifyIntent('thanks')).toBe('thanks')
  })

  it('classifies complaint', () => {
    expect(classifyIntent('Чанар муу байна, буцаах')).toBe('complaint')
    expect(classifyIntent('Асуудал гарлаа, буруу бараа')).toBe('complaint')
  })

  it('classifies size info request', () => {
    expect(classifyIntent('Размер хэмжээ хэд байна')).toBe('size_info')
  })

  it('classifies payment inquiry', () => {
    expect(classifyIntent('Төлбөр хэрхэн төлөх вэ')).toBe('payment')
    expect(classifyIntent('QPay данс руу шилжүүлэг')).toBe('payment')
  })

  it('classifies shipping inquiry', () => {
    expect(classifyIntent('Хүргэлт хөдөө хүргэх үү')).toBe('shipping')
  })

  it('returns general for unrecognized messages', () => {
    expect(classifyIntent('xyz abc def')).toBe('general')
    expect(classifyIntent('')).toBe('general')
  })

  it('picks the intent with highest keyword count', () => {
    // "бараа байна уу хайх" has 4 product_search keywords
    expect(classifyIntent('бараа байна уу хайх үнэ')).toBe('product_search')
  })
})

describe('extractSearchTerms', () => {
  it('removes Mongolian stop words', () => {
    const result = extractSearchTerms('Надад энэ гутал байна уу')
    expect(result).not.toContain('надад')
    expect(result).not.toContain('энэ')
    expect(result).toContain('гутал')
  })

  it('removes single character words', () => {
    const result = extractSearchTerms('а б гутал')
    expect(result).toBe('гутал')
  })

  it('converts to lowercase', () => {
    const result = extractSearchTerms('ГУТАЛ Цүнх')
    expect(result).toContain('гутал')
    expect(result).toContain('цүнх')
  })

  it('returns empty string for all stop words', () => {
    const result = extractSearchTerms('байна уу та надад')
    expect(result).toBe('')
  })
})

describe('formatPrice', () => {
  it('formats number with Mongolian tugrik symbol', () => {
    const result = formatPrice(15000)
    expect(result).toContain('15')
    expect(result).toContain('000')
    expect(result).toContain('₮')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toContain('0')
    expect(formatPrice(0)).toContain('₮')
  })

  it('formats large numbers', () => {
    const result = formatPrice(1500000)
    expect(result).toContain('₮')
  })
})

describe('generateResponse', () => {
  const mockProducts: ProductMatch[] = [
    {
      id: '1',
      name: 'Цагаан цамц',
      description: 'Өндөр чанартай хөвөн цамц',
      category: 'clothing',
      base_price: 35000,
      images: [],
      sales_script: 'Хамгийн борлуулалттай!',
      product_faqs: null,
    },
  ]

  const mockOrders: OrderMatch[] = [
    {
      id: '1',
      order_number: 'ORD-001',
      status: 'shipped',
      total_amount: 50000,
      tracking_number: 'TRK123',
      created_at: '2025-01-15T00:00:00Z',
    },
  ]

  it('generates greeting with store name', () => {
    const resp = generateResponse('greeting', [], [], 'TestStore')
    expect(resp).toContain('TestStore')
    expect(resp).toContain('тавтай морил')
  })

  it('uses custom welcome message from settings', () => {
    const settings: ChatbotSettings = { welcome_message: 'Custom greeting!' }
    const resp = generateResponse('greeting', [], [], 'TestStore', settings)
    expect(resp).toBe('Custom greeting!')
  })

  it('generates thanks response', () => {
    const resp = generateResponse('thanks', [], [], 'Store')
    expect(resp).toContain('Баярлалаа')
  })

  it('generates product search with results', () => {
    const resp = generateResponse('product_search', mockProducts, [], 'Store')
    expect(resp).toContain('Цагаан цамц')
    expect(resp).toContain('35')
    expect(resp).toContain('₮')
    expect(resp).toContain('Хамгийн борлуулалттай!')
  })

  it('generates product search with no results', () => {
    const resp = generateResponse('product_search', [], [], 'Store')
    expect(resp).toContain('олдсонгүй')
  })

  it('generates order status with tracking', () => {
    const resp = generateResponse('order_status', [], mockOrders, 'Store')
    expect(resp).toContain('ORD-001')
    expect(resp).toContain('Илгээсэн')
    expect(resp).toContain('TRK123')
  })

  it('generates order status with no results', () => {
    const resp = generateResponse('order_status', [], [], 'Store')
    expect(resp).toContain('олдсонгүй')
  })

  it('generates complaint response', () => {
    const resp = generateResponse('complaint', [], [], 'Store')
    expect(resp).toContain('менежер')
  })

  it('generates size info response', () => {
    const resp = generateResponse('size_info', [], [], 'Store')
    expect(resp).toContain('S -')
    expect(resp).toContain('XL')
  })

  it('generates payment info response', () => {
    const resp = generateResponse('payment', [], [], 'Store')
    expect(resp).toContain('QPay')
    expect(resp).toContain('шилжүүлэг')
  })

  it('generates shipping info response', () => {
    const resp = generateResponse('shipping', [], [], 'Store')
    expect(resp).toContain('Улаанбаатар')
    expect(resp).toContain('Хөдөө')
  })

  it('generates general response with products', () => {
    const resp = generateResponse('general', mockProducts, [], 'Store')
    expect(resp).toContain('Цагаан цамц')
  })

  it('generates general response without products', () => {
    const resp = generateResponse('general', [], [], 'Store')
    expect(resp).toContain('тусалж чадна')
  })
})
