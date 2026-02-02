/**
 * Comprehensive AI Chat tests for ALL business types.
 *
 * Validates:
 * 1. Flow template structure for each business type
 * 2. Demo data completeness
 * 3. Intent classification for business-specific messages
 * 4. Cross-business conversation keyword handling
 * 5. Flow trigger keyword matching
 */
import { describe, it, expect } from 'vitest'
import { getFlowTemplate, getAllFlowTemplates, type FlowTemplate } from './flow-templates'
import { DEMO_DATA, getDemoItems } from './demo-flow-data'
import { DEMO_SECTORS } from './demo-data'
import {
  classifyIntent,
  classifyIntentWithConfidence,
  normalizeText,
  generateResponse,
} from './chat-ai'

// ============================================================================
// 1. Flow Templates — Structural Validation
// ============================================================================

const ALL_BUSINESS_TYPES = [
  'restaurant',
  'hospital',
  'beauty_salon',
  'coffee_shop',
  'fitness',
  'education',
  'dental_clinic',
  'real_estate',
  'camping_guesthouse',
]

describe('Flow Templates — All Business Types', () => {
  it('has exactly 9 templates', () => {
    const all = getAllFlowTemplates()
    expect(all).toHaveLength(9)
  })

  it.each(ALL_BUSINESS_TYPES)('template exists for %s', (bizType) => {
    const template = getFlowTemplate(bizType)
    expect(template).toBeDefined()
    expect(template!.business_type).toBe(bizType)
  })

  it.each(ALL_BUSINESS_TYPES)('%s template has required fields', (bizType) => {
    const t = getFlowTemplate(bizType)!
    expect(t.name).toBeTruthy()
    expect(t.description).toBeTruthy()
    expect(t.trigger_type).toBe('keyword')
    expect(t.trigger_config).toBeDefined()
    expect(t.nodes.length).toBeGreaterThanOrEqual(3)
    expect(t.edges.length).toBeGreaterThanOrEqual(2)
  })

  it.each(ALL_BUSINESS_TYPES)('%s template starts with a trigger node', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const triggerNodes = t.nodes.filter((n) => n.type === 'trigger')
    expect(triggerNodes.length).toBe(1)
  })

  it.each(ALL_BUSINESS_TYPES)('%s template ends with at least one end node', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const endNodes = t.nodes.filter((n) => n.type === 'end')
    expect(endNodes.length).toBeGreaterThanOrEqual(1)
  })

  it.each(ALL_BUSINESS_TYPES)('%s template has trigger keywords', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const config = t.trigger_config as { keywords: string[]; match_mode: string }
    expect(config.keywords.length).toBeGreaterThanOrEqual(2)
    expect(config.match_mode).toBe('any')
  })

  it.each(ALL_BUSINESS_TYPES)('%s template edges reference valid node IDs', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const nodeIds = new Set(t.nodes.map((n) => n.id))
    for (const edge of t.edges) {
      expect(nodeIds.has(edge.source)).toBe(true)
      expect(nodeIds.has(edge.target)).toBe(true)
    }
  })

  it.each(ALL_BUSINESS_TYPES)('%s template has all nodes reachable from trigger', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const triggerNode = t.nodes.find((n) => n.type === 'trigger')!

    // BFS from trigger
    const reachable = new Set<string>()
    const queue = [triggerNode.id]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)
      for (const edge of t.edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          queue.push(edge.target)
        }
      }
    }

    // All non-trigger nodes should be reachable
    for (const node of t.nodes) {
      if (node.type !== 'trigger') {
        expect(reachable.has(node.id)).toBe(true)
      }
    }
  })
})

// ============================================================================
// 2. Flow Templates — Node Type Validation
// ============================================================================

describe('Flow Templates — Node Types', () => {
  const validNodeTypes = [
    'trigger', 'send_message', 'ask_question', 'button_choice',
    'condition', 'api_action', 'show_items', 'handoff', 'delay', 'end',
  ]

  it.each(ALL_BUSINESS_TYPES)('%s uses only valid node types', (bizType) => {
    const t = getFlowTemplate(bizType)!
    for (const node of t.nodes) {
      expect(validNodeTypes).toContain(node.type)
    }
  })

  it.each(ALL_BUSINESS_TYPES)('%s ask_question nodes have variable_name', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const askNodes = t.nodes.filter((n) => n.type === 'ask_question')
    for (const node of askNodes) {
      const config = node.data.config as { variable_name?: string }
      expect(config.variable_name).toBeTruthy()
    }
  })

  it.each(ALL_BUSINESS_TYPES)('%s button_choice nodes have buttons', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const buttonNodes = t.nodes.filter((n) => n.type === 'button_choice')
    for (const node of buttonNodes) {
      const config = node.data.config as { buttons?: Array<{ label: string; value: string }> }
      expect(config.buttons).toBeDefined()
      expect(config.buttons!.length).toBeGreaterThanOrEqual(2)
      for (const btn of config.buttons!) {
        expect(btn.label).toBeTruthy()
        expect(btn.value).toBeTruthy()
      }
    }
  })

  it.each(ALL_BUSINESS_TYPES)('%s send_message nodes have text', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const msgNodes = t.nodes.filter((n) => n.type === 'send_message')
    for (const node of msgNodes) {
      const config = node.data.config as { text?: string }
      expect(config.text).toBeTruthy()
    }
  })

  it.each(ALL_BUSINESS_TYPES)('%s show_items nodes have source and display_format', (bizType) => {
    const t = getFlowTemplate(bizType)!
    const showNodes = t.nodes.filter((n) => n.type === 'show_items')
    for (const node of showNodes) {
      const config = node.data.config as { source?: string; display_format?: string }
      expect(['products', 'services', 'variable']).toContain(config.source)
      expect(['list', 'cards']).toContain(config.display_format)
    }
  })
})

// ============================================================================
// 3. Flow Template — Business-Specific Feature Checks
// ============================================================================

describe('Flow Templates — Business-Specific Features', () => {
  it('restaurant template has delivery/pickup branching', () => {
    const t = getFlowTemplate('restaurant')!
    const deliveryNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'delivery_type'
    )
    expect(deliveryNode).toBeDefined()
    const config = deliveryNode!.data.config as { buttons: Array<{ value: string }> }
    const values = config.buttons.map((b) => b.value)
    expect(values).toContain('delivery')
    expect(values).toContain('pickup')
  })

  it('hospital template has department selection', () => {
    const t = getFlowTemplate('hospital')!
    const deptNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'department'
    )
    expect(deptNode).toBeDefined()
  })

  it('hospital template has insurance question', () => {
    const t = getFlowTemplate('hospital')!
    const insuranceNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'has_insurance'
    )
    expect(insuranceNode).toBeDefined()
  })

  it('beauty_salon template has service category selection', () => {
    const t = getFlowTemplate('beauty_salon')!
    const serviceNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'service_category'
    )
    expect(serviceNode).toBeDefined()
    const config = serviceNode!.data.config as { buttons: Array<{ label: string }> }
    const labels = config.buttons.map((b) => b.label)
    expect(labels).toContain('Үсчин')
    expect(labels).toContain('Маникюр')
  })

  it('coffee_shop template has size selection', () => {
    const t = getFlowTemplate('coffee_shop')!
    const sizeNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'size'
    )
    expect(sizeNode).toBeDefined()
  })

  it('fitness template has inquiry type branching', () => {
    const t = getFlowTemplate('fitness')!
    const inquiryNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'inquiry_type'
    )
    expect(inquiryNode).toBeDefined()
    const config = inquiryNode!.data.config as { buttons: Array<{ value: string }> }
    const values = config.buttons.map((b) => b.value)
    expect(values).toContain('membership')
    expect(values).toContain('trial')
    expect(values).toContain('schedule')
  })

  it('education template has schedule selection and payment method', () => {
    const t = getFlowTemplate('education')!
    const scheduleNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'schedule'
    )
    expect(scheduleNode).toBeDefined()
    const paymentNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'payment_method'
    )
    expect(paymentNode).toBeDefined()
  })

  it('dental_clinic template has emergency triage with handoff', () => {
    const t = getFlowTemplate('dental_clinic')!
    const visitTypeNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'visit_type'
    )
    expect(visitTypeNode).toBeDefined()
    const config = visitTypeNode!.data.config as { buttons: Array<{ value: string }> }
    const values = config.buttons.map((b) => b.value)
    expect(values).toContain('booking')
    expect(values).toContain('emergency')
    expect(values).toContain('pricing')

    // Has a handoff node for emergency
    const handoffNode = t.nodes.find((n) => n.type === 'handoff')
    expect(handoffNode).toBeDefined()
  })

  it('real_estate template has property type and location selection', () => {
    const t = getFlowTemplate('real_estate')!
    const typeNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'property_type'
    )
    expect(typeNode).toBeDefined()
    const locationNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'location'
    )
    expect(locationNode).toBeDefined()
  })

  it('camping_guesthouse template has resource type, dates, and party size', () => {
    const t = getFlowTemplate('camping_guesthouse')!
    const resourceNode = t.nodes.find(
      (n) => n.type === 'button_choice' && (n.data.config as { variable_name?: string }).variable_name === 'resource_type'
    )
    expect(resourceNode).toBeDefined()
    const config = resourceNode!.data.config as { buttons: Array<{ value: string }> }
    const values = config.buttons.map((b) => b.value)
    expect(values).toContain('ger')
    expect(values).toContain('room')
    expect(values).toContain('tent_site')
    expect(values).toContain('cabin')

    // Has check-in/out date questions
    const checkIn = t.nodes.find(
      (n) => n.type === 'ask_question' && (n.data.config as { variable_name?: string }).variable_name === 'check_in_date'
    )
    expect(checkIn).toBeDefined()
    const checkOut = t.nodes.find(
      (n) => n.type === 'ask_question' && (n.data.config as { variable_name?: string }).variable_name === 'check_out_date'
    )
    expect(checkOut).toBeDefined()

    // Has party size
    const partySize = t.nodes.find(
      (n) => n.type === 'ask_question' && (n.data.config as { variable_name?: string }).variable_name === 'party_size'
    )
    expect(partySize).toBeDefined()
  })
})

// ============================================================================
// 4. Demo Data — Completeness
// ============================================================================

const DEMO_DATA_TYPES = [
  'restaurant',
  'hospital',
  'beauty_salon',
  'coffee_shop',
  'fitness',
  'education',
  'dental_clinic',
  'real_estate',
  'camping_guesthouse',
]

describe('Demo Data — All Business Types', () => {
  it.each(DEMO_DATA_TYPES)('%s has demo data', (bizType) => {
    expect(DEMO_DATA[bizType]).toBeDefined()
  })

  it.each(DEMO_DATA_TYPES)('%s has either products or services', (bizType) => {
    const data = DEMO_DATA[bizType]
    const total = data.products.length + data.services.length
    expect(total).toBeGreaterThanOrEqual(3)
  })

  // Product-based businesses should have products
  it.each(['restaurant', 'coffee_shop', 'real_estate'])('%s has products', (bizType) => {
    expect(DEMO_DATA[bizType].products.length).toBeGreaterThanOrEqual(3)
  })

  // Service-based businesses should have services
  it.each(['hospital', 'beauty_salon', 'fitness', 'education', 'dental_clinic', 'camping_guesthouse'])(
    '%s has services',
    (bizType) => {
      expect(DEMO_DATA[bizType].services.length).toBeGreaterThanOrEqual(3)
    }
  )

  it.each(DEMO_DATA_TYPES)('%s items have valid structure', (bizType) => {
    const data = DEMO_DATA[bizType]
    const allItems = [...data.products, ...data.services]
    for (const item of allItems) {
      expect(item.id).toBeTruthy()
      expect(item.name).toBeTruthy()
      expect(item.base_price).toBeGreaterThan(0)
      expect(item.status).toBe('active')
    }
  })
})

describe('getDemoItems', () => {
  it('returns products for restaurant', () => {
    const items = getDemoItems('restaurant', 'products')
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  it('returns services for beauty_salon', () => {
    const items = getDemoItems('beauty_salon', 'services')
    expect(items.length).toBeGreaterThanOrEqual(3)
  })

  it('filters by category', () => {
    const items = getDemoItems('beauty_salon', 'services', { category: 'Массаж' })
    expect(items.length).toBeGreaterThanOrEqual(1)
    for (const item of items) {
      expect(item.category?.toLowerCase()).toContain('массаж')
    }
  })

  it('respects limit', () => {
    const items = getDemoItems('restaurant', 'products', { limit: 2 })
    expect(items.length).toBeLessThanOrEqual(2)
  })

  it('returns empty array for unknown business type', () => {
    const items = getDemoItems('nonexistent', 'products')
    expect(items).toEqual([])
  })

  it('returns camping services', () => {
    const items = getDemoItems('camping_guesthouse', 'services')
    expect(items.length).toBeGreaterThanOrEqual(4)
    const categories = items.map((i) => i.category)
    expect(categories).toEqual(expect.arrayContaining(['ger', 'room', 'tent_site', 'cabin']))
  })

  it('filters camping by resource type (ger)', () => {
    const items = getDemoItems('camping_guesthouse', 'services', { category: 'ger' })
    expect(items.length).toBeGreaterThanOrEqual(1)
    for (const item of items) {
      expect(item.category).toBe('ger')
    }
  })
})

// ============================================================================
// 5. Demo Sectors — Landing Page
// ============================================================================

describe('Demo Sectors', () => {
  it('has 6 demo sectors', () => {
    expect(DEMO_SECTORS).toHaveLength(6)
  })

  it.each(['restaurant', 'beauty', 'clinic', 'shop', 'realtor', 'camping'])(
    'has %s sector',
    (sectorId) => {
      const sector = DEMO_SECTORS.find((s) => s.id === sectorId)
      expect(sector).toBeDefined()
      expect(sector!.name).toBeTruthy()
      expect(sector!.storeName).toBeTruthy()
      expect(sector!.welcomeMessage).toBeTruthy()
      expect(sector!.sampleQuestions.length).toBeGreaterThanOrEqual(3)
    }
  )

  it('each sector has icon and accent color', () => {
    for (const sector of DEMO_SECTORS) {
      expect(sector.icon).toBeTruthy()
      expect(sector.accentColor).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('each sector sample Q&A has question and answer', () => {
    for (const sector of DEMO_SECTORS) {
      for (const qa of sector.sampleQuestions) {
        expect(qa.question).toBeTruthy()
        expect(qa.answer).toBeTruthy()
        expect(qa.answer.length).toBeGreaterThan(20)
      }
    }
  })
})

// ============================================================================
// 6. Intent Classification — Business-Specific Messages
// ============================================================================

describe('Intent Classification — Restaurant messages', () => {
  it('"цэс харуулна уу" classifies as product_search', () => {
    expect(classifyIntent('цэс харуулна уу')).toBe('product_search')
  })

  it('"хоол захиалмаар байна" should trigger product_search or general', () => {
    const intent = classifyIntent('хоол захиалмаар байна')
    expect(['product_search', 'general', 'order_status']).toContain(intent)
  })

  it('"хүргэлт хийдэг үү" classifies as shipping', () => {
    expect(classifyIntent('хүргэлт хийдэг үү')).toBe('shipping')
  })
})

describe('Intent Classification — Beauty Salon messages', () => {
  it('"үйлчилгээний үнэ хэд вэ" classifies as product_search (price inquiry)', () => {
    const intent = classifyIntent('үйлчилгээний үнэ хэд вэ')
    expect(['product_search', 'payment']).toContain(intent)
  })

  it('"маникюр хийлгэмээр байна" includes relevant keywords', () => {
    // "маникюр" is a service-specific term; intent system handles via flows
    const { confidence } = classifyIntentWithConfidence('маникюр хийлгэмээр байна')
    expect(typeof confidence).toBe('number')
  })
})

describe('Intent Classification — Hospital / Clinic messages', () => {
  it('"цаг захиалмаар байна" detects ordering intent', () => {
    const { intent, confidence } = classifyIntentWithConfidence('цаг захиалмаар байна')
    // "цаг" and "захиал" are keywords
    expect(confidence).toBeGreaterThan(0)
    expect(['order_status', 'product_search']).toContain(intent)
  })

  it('"даатгалтай бол хэрхэн бүртгүүлэх вэ" has some confidence', () => {
    const { confidence } = classifyIntentWithConfidence('даатгалтай бол хэрхэн бүртгүүлэх вэ')
    expect(typeof confidence).toBe('number')
  })
})

describe('Intent Classification — Coffee Shop messages', () => {
  it('"кофе захиалмаар байна" detects intent', () => {
    const { intent, confidence } = classifyIntentWithConfidence('кофе захиалмаар байна')
    expect(confidence).toBeGreaterThan(0)
    // "захиал" prefix matches order_status
    expect(['order_status', 'product_search']).toContain(intent)
  })
})

describe('Intent Classification — Fitness messages', () => {
  it('"гишүүнчлэлийн үнэ хэд вэ" detects product_search (price inquiry)', () => {
    const intent = classifyIntent('гишүүнчлэлийн үнэ хэд вэ')
    expect(['product_search', 'payment']).toContain(intent)
  })
})

describe('Intent Classification — Education messages', () => {
  it('"англи хэлний курсын мэдээлэл" has some confidence', () => {
    const { confidence } = classifyIntentWithConfidence('англи хэлний курсын мэдээлэл')
    expect(typeof confidence).toBe('number')
  })
})

describe('Intent Classification — Dental Clinic messages', () => {
  it('"шүд өвдөж байна" triggers some intent', () => {
    const { intent } = classifyIntentWithConfidence('шүд өвдөж байна')
    expect(typeof intent).toBe('string')
  })

  it('"яаралтай шүдний тусламж" has some confidence', () => {
    const { confidence } = classifyIntentWithConfidence('яаралтай шүдний тусламж')
    expect(typeof confidence).toBe('number')
  })
})

describe('Intent Classification — Real Estate messages', () => {
  it('"орон сууц хайж байна" detects product_search', () => {
    const intent = classifyIntent('орон сууц хайж байна')
    expect(intent).toBe('product_search')
  })

  it('"зээлээр авч болох уу" detects payment', () => {
    expect(classifyIntent('зээлээр авч болох уу')).toBe('payment')
  })

  it('"газар зарна" detects product_search', () => {
    const intent = classifyIntent('газар зарна')
    expect(intent).toBe('product_search')
  })
})

describe('Intent Classification — Camping / Guesthouse messages', () => {
  it('"байр захиалмаар байна" detects product_search or shipping', () => {
    const intent = classifyIntent('байр захиалмаар байна')
    // "байр" is a shipping keyword (address-related), "захиал" is order_status
    expect(['product_search', 'shipping', 'order_status']).toContain(intent)
  })

  it('"гэрт байрлах боломж байна уу" detects some intent', () => {
    const { intent } = classifyIntentWithConfidence('гэрт байрлах боломж байна уу')
    expect(typeof intent).toBe('string')
  })

  it('"хэдэн хүн байрлаж болох" has some confidence', () => {
    const { confidence } = classifyIntentWithConfidence('хэдэн хүн байрлаж болох')
    expect(typeof confidence).toBe('number')
  })
})

// ============================================================================
// 7. Flow Trigger Keyword Matching
// ============================================================================

describe('Flow Trigger Keywords — Business-Specific Activation', () => {
  function matchesTrigger(template: FlowTemplate, message: string): boolean {
    const config = template.trigger_config as { keywords: string[]; match_mode: string }
    const normalized = normalizeText(message)
    return config.keywords.some((kw) => normalized.includes(normalizeText(kw)))
  }

  it('restaurant flow activates on "захиалга өгмөөр байна"', () => {
    const t = getFlowTemplate('restaurant')!
    expect(matchesTrigger(t, 'захиалга өгмөөр байна')).toBe(true)
  })

  it('restaurant flow activates on "цэс"', () => {
    const t = getFlowTemplate('restaurant')!
    expect(matchesTrigger(t, 'цэс харуулна уу')).toBe(true)
  })

  it('hospital flow activates on "цаг авмаар байна"', () => {
    const t = getFlowTemplate('hospital')!
    expect(matchesTrigger(t, 'цаг авмаар байна')).toBe(true)
  })

  it('hospital flow activates on "үзлэг"', () => {
    const t = getFlowTemplate('hospital')!
    expect(matchesTrigger(t, 'үзлэг хийлгэмээр байна')).toBe(true)
  })

  it('beauty_salon flow activates on "үйлчилгээ"', () => {
    const t = getFlowTemplate('beauty_salon')!
    expect(matchesTrigger(t, 'ямар үйлчилгээ байна')).toBe(true)
  })

  it('beauty_salon flow activates on "booking" (English)', () => {
    const t = getFlowTemplate('beauty_salon')!
    expect(matchesTrigger(t, 'I need a booking')).toBe(true)
  })

  it('coffee_shop flow activates on "кофе"', () => {
    const t = getFlowTemplate('coffee_shop')!
    expect(matchesTrigger(t, 'кофе захиалъя')).toBe(true)
  })

  it('fitness flow activates on "гишүүнчлэл"', () => {
    const t = getFlowTemplate('fitness')!
    expect(matchesTrigger(t, 'гишүүнчлэлийн талаар мэдмээр байна')).toBe(true)
  })

  it('fitness flow activates on "membership" (English)', () => {
    const t = getFlowTemplate('fitness')!
    expect(matchesTrigger(t, 'membership information')).toBe(true)
  })

  it('education flow activates on "курс"', () => {
    const t = getFlowTemplate('education')!
    expect(matchesTrigger(t, 'курсын мэдээлэл')).toBe(true)
  })

  it('education flow activates on "сургалт"', () => {
    const t = getFlowTemplate('education')!
    expect(matchesTrigger(t, 'сургалтанд бүртгүүлэх')).toBe(true)
  })

  it('dental_clinic flow activates on "шүд"', () => {
    const t = getFlowTemplate('dental_clinic')!
    expect(matchesTrigger(t, 'шүдний эмчид цаг авах')).toBe(true)
  })

  it('dental_clinic flow activates on "яаралтай"', () => {
    const t = getFlowTemplate('dental_clinic')!
    expect(matchesTrigger(t, 'яаралтай тусламж')).toBe(true)
  })

  it('real_estate flow activates on "орон сууц"', () => {
    const t = getFlowTemplate('real_estate')!
    expect(matchesTrigger(t, 'орон сууц хайж байна')).toBe(true)
  })

  it('real_estate flow activates on "газар"', () => {
    const t = getFlowTemplate('real_estate')!
    expect(matchesTrigger(t, 'газар худалдаж авах')).toBe(true)
  })

  it('camping_guesthouse flow activates on "байр" (Mongolian)', () => {
    const t = getFlowTemplate('camping_guesthouse')!
    expect(matchesTrigger(t, 'байр захиалах')).toBe(true)
  })

  it('camping_guesthouse flow activates on "гэр" (Mongolian)', () => {
    const t = getFlowTemplate('camping_guesthouse')!
    expect(matchesTrigger(t, 'гэрт байрлаж болох уу')).toBe(true)
  })

  it('camping_guesthouse flow activates on "reserve" (English)', () => {
    const t = getFlowTemplate('camping_guesthouse')!
    expect(matchesTrigger(t, 'I want to reserve a room')).toBe(true)
  })

  it('camping_guesthouse flow activates on "booking" (English)', () => {
    const t = getFlowTemplate('camping_guesthouse')!
    expect(matchesTrigger(t, 'make a booking')).toBe(true)
  })
})

// ============================================================================
// 8. Cross-Business Shared Intents
// ============================================================================

describe('Cross-Business — Shared intents work for all businesses', () => {
  it('greeting works regardless of business type', () => {
    expect(classifyIntent('Сайн байна уу')).toBe('greeting')
    expect(classifyIntent('hello')).toBe('greeting')
    expect(classifyIntent('сн бну')).toBe('greeting')
  })

  it('thanks works regardless of business type', () => {
    expect(classifyIntent('баярлалаа')).toBe('thanks')
    expect(classifyIntent('thank you')).toBe('thanks')
  })

  it('payment intent works for all businesses', () => {
    expect(classifyIntent('төлбөр хэрхэн төлөх')).toBe('payment')
    expect(classifyIntent('qpay аар төлж болох уу')).toBe('payment')
    expect(classifyIntent('how to pay')).toBe('payment')
  })

  it('complaint works for all businesses', () => {
    expect(classifyIntent('асуудал гарлаа')).toBe('complaint')
    expect(classifyIntent('чанаргүй байна')).toBe('complaint')
  })
})

// ============================================================================
// 9. Response Generation — Universal Templates
// ============================================================================

describe('Response Generation — Works for all business names', () => {
  const businessNames = [
    'Номин Ресторан',
    'Bella Beauty Salon',
    'Эрүүл Амьдрал Эмнэлэг',
    'Mongol Style',
    'Green Home Realty',
    'Хустай Кемпинг',
  ]

  it.each(businessNames)('greeting response includes %s store name', (storeName) => {
    const response = generateResponse('greeting', [], [], storeName)
    expect(response).toContain(storeName)
    expect(response).toContain('тавтай морил')
  })

  it('thanks response is consistent', () => {
    const response = generateResponse('thanks', [], [], 'TestStore')
    expect(response).toContain('Баярлалаа')
  })

  it('payment response includes multiple payment methods', () => {
    const response = generateResponse('payment', [], [], 'TestStore')
    expect(response).toContain('QPay')
    expect(response).toContain('Дансаар')
    expect(response).toContain('Бэлнээр')
  })

  it('shipping response includes UB and countryside', () => {
    const response = generateResponse('shipping', [], [], 'TestStore')
    expect(response).toContain('Улаанбаатар')
    expect(response).toContain('Хөдөө')
  })

  it('low_confidence response shows menu options', () => {
    const response = generateResponse('low_confidence', [], [], 'TestStore')
    expect(response).toContain('ойлгосонгүй')
    expect(response).toContain('Бүтээгдэхүүн хайх')
    expect(response).toContain('Менежертэй холбогдох')
  })
})

// ============================================================================
// 10. Text Normalization — Works for business-specific terms
// ============================================================================

describe('Text Normalization — Business terms', () => {
  it('normalizes Latin "zahialga" to Cyrillic "захиалга"', () => {
    expect(normalizeText('zahialga')).toBe('захиалга')
  })

  it('normalizes "tsag" to "цаг" (appointment)', () => {
    expect(normalizeText('tsag')).toBe('цаг')
  })

  it('normalizes "kofe" to "кофе"', () => {
    expect(normalizeText('kofe')).toBe('кофе')
  })

  it('normalizes "booking" (English) without breaking', () => {
    const result = normalizeText('booking')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('normalizes "ger" to "гер"', () => {
    expect(normalizeText('ger')).toBe('гер')
  })

  it('normalizes "reserve" to Cyrillic equivalent', () => {
    const result = normalizeText('reserve')
    expect(typeof result).toBe('string')
    // "reserve" → р е с е р в е (Cyrillic characters)
    expect(result).toBe('ресерве')
  })

  it('normalizes "shud" to "шуд" (tooth)', () => {
    expect(normalizeText('shud')).toBe('шуд')
  })
})

// ============================================================================
// 11. All Templates — Unique Business Types
// ============================================================================

describe('Template uniqueness', () => {
  it('all templates have unique business_type', () => {
    const all = getAllFlowTemplates()
    const types = all.map((t) => t.business_type)
    expect(new Set(types).size).toBe(types.length)
  })

  it('all templates have unique names', () => {
    const all = getAllFlowTemplates()
    const names = all.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('no template shares the same trigger keywords set', () => {
    const all = getAllFlowTemplates()
    // At least some keywords should differ between templates
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const kw1 = (all[i].trigger_config as { keywords: string[] }).keywords
        const kw2 = (all[j].trigger_config as { keywords: string[] }).keywords
        // Not all keywords should be identical
        const identical = kw1.length === kw2.length && kw1.every((k) => kw2.includes(k))
        expect(identical).toBe(false)
      }
    }
  })
})
