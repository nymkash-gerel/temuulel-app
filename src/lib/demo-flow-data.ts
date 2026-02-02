/**
 * Static demo products/services for each of the 8 business types.
 *
 * Used by the demo flow executor so visitors can experience
 * flow templates without any database or signup.
 */

export interface DemoItem {
  id: string
  name: string
  base_price: number
  description?: string
  category?: string
  duration_minutes?: number
  images?: string[]
  status: 'active'
}

interface DemoDataSet {
  products: DemoItem[]
  services: DemoItem[]
}

export const DEMO_DATA: Record<string, DemoDataSet> = {
  // ------------------------------------------------------------------
  // 1. Restaurant
  // ------------------------------------------------------------------
  restaurant: {
    products: [
      { id: 'r1', name: 'Хуушуур (4ш)', base_price: 8000, category: 'Үндсэн', status: 'active' },
      { id: 'r2', name: 'Бууз (8ш)', base_price: 12000, category: 'Үндсэн', status: 'active' },
      { id: 'r3', name: 'Цуйван', base_price: 10000, category: 'Үндсэн', status: 'active' },
      { id: 'r4', name: 'Шарсан мах', base_price: 18000, category: 'Үндсэн', status: 'active' },
      { id: 'r5', name: 'Ногоотой шөл', base_price: 7000, category: 'Шөл', status: 'active' },
      { id: 'r6', name: 'Сүүтэй цай', base_price: 2500, category: 'Ундаа', status: 'active' },
    ],
    services: [],
  },

  // ------------------------------------------------------------------
  // 2. Hospital
  // ------------------------------------------------------------------
  hospital: {
    products: [],
    services: [
      { id: 'h1', name: 'Ерөнхий үзлэг', base_price: 15000, category: 'general', duration_minutes: 20, status: 'active' },
      { id: 'h2', name: 'Дотрын үзлэг', base_price: 25000, category: 'internal', duration_minutes: 30, status: 'active' },
      { id: 'h3', name: 'Нүдний шинжилгээ', base_price: 20000, category: 'eye', duration_minutes: 25, status: 'active' },
      { id: 'h4', name: 'Хүүхдийн үзлэг', base_price: 18000, category: 'pediatric', duration_minutes: 20, status: 'active' },
      { id: 'h5', name: 'Цус шинжилгээ', base_price: 12000, category: 'general', duration_minutes: 10, status: 'active' },
    ],
  },

  // ------------------------------------------------------------------
  // 3. Beauty Salon
  // ------------------------------------------------------------------
  beauty_salon: {
    products: [],
    services: [
      { id: 'b1', name: 'Үс засалт (эмэгтэй)', base_price: 25000, category: 'Үсчин', duration_minutes: 45, status: 'active' },
      { id: 'b2', name: 'Үс будалт', base_price: 55000, category: 'Үсчин', duration_minutes: 90, status: 'active' },
      { id: 'b3', name: 'Гель маникюр', base_price: 25000, category: 'Маникюр/Педикюр', duration_minutes: 60, status: 'active' },
      { id: 'b4', name: 'Педикюр', base_price: 20000, category: 'Маникюр/Педикюр', duration_minutes: 50, status: 'active' },
      { id: 'b5', name: 'Гүнзгий цэвэрлэгээ', base_price: 35000, category: 'Нүүр арчилгаа', duration_minutes: 40, status: 'active' },
      { id: 'b6', name: 'Нүүрний массаж', base_price: 30000, category: 'Массаж', duration_minutes: 30, status: 'active' },
      { id: 'b7', name: 'Биений массаж', base_price: 50000, category: 'Массаж', duration_minutes: 60, status: 'active' },
    ],
  },

  // ------------------------------------------------------------------
  // 4. Coffee Shop
  // ------------------------------------------------------------------
  coffee_shop: {
    products: [
      { id: 'c1', name: 'Американо', base_price: 5500, category: 'Кофе', status: 'active' },
      { id: 'c2', name: 'Латте', base_price: 6500, category: 'Кофе', status: 'active' },
      { id: 'c3', name: 'Капучино', base_price: 6500, category: 'Кофе', status: 'active' },
      { id: 'c4', name: 'Мокка', base_price: 7000, category: 'Кофе', status: 'active' },
      { id: 'c5', name: 'Ногоон цай', base_price: 4000, category: 'Цай', status: 'active' },
      { id: 'c6', name: 'Чизкейк', base_price: 8000, category: 'Бялуу', status: 'active' },
    ],
    services: [],
  },

  // ------------------------------------------------------------------
  // 5. Fitness
  // ------------------------------------------------------------------
  fitness: {
    products: [],
    services: [
      { id: 'f1', name: 'Сарын гишүүнчлэл', base_price: 120000, category: 'membership', duration_minutes: 0, status: 'active' },
      { id: 'f2', name: '3 сарын гишүүнчлэл', base_price: 300000, category: 'membership', duration_minutes: 0, status: 'active' },
      { id: 'f3', name: 'Туршилт (3 удаа)', base_price: 30000, category: 'trial', duration_minutes: 0, status: 'active' },
      { id: 'f4', name: 'Хувийн дасгалжуулагч', base_price: 50000, category: 'personal', duration_minutes: 60, status: 'active' },
    ],
  },

  // ------------------------------------------------------------------
  // 6. Education
  // ------------------------------------------------------------------
  education: {
    products: [],
    services: [
      { id: 'e1', name: 'Англи хэл (Суурь)', base_price: 150000, category: 'language', duration_minutes: 90, status: 'active' },
      { id: 'e2', name: 'Англи хэл (Дунд)', base_price: 180000, category: 'language', duration_minutes: 90, status: 'active' },
      { id: 'e3', name: 'Програмчлал (Python)', base_price: 250000, category: 'tech', duration_minutes: 120, status: 'active' },
      { id: 'e4', name: 'Дизайн (Figma)', base_price: 200000, category: 'tech', duration_minutes: 90, status: 'active' },
      { id: 'e5', name: 'IELTS бэлтгэл', base_price: 300000, category: 'language', duration_minutes: 120, status: 'active' },
    ],
  },

  // ------------------------------------------------------------------
  // 7. Dental Clinic
  // ------------------------------------------------------------------
  dental_clinic: {
    products: [],
    services: [
      { id: 'dc1', name: 'Шүдний үзлэг', base_price: 15000, category: 'general', duration_minutes: 20, status: 'active' },
      { id: 'dc2', name: 'Шүд цэвэрлэгээ', base_price: 30000, category: 'cleaning', duration_minutes: 40, status: 'active' },
      { id: 'dc3', name: 'Шүд ломбодох', base_price: 45000, category: 'filling', duration_minutes: 30, status: 'active' },
      { id: 'dc4', name: 'Шүд авах', base_price: 35000, category: 'extraction', duration_minutes: 30, status: 'active' },
      { id: 'dc5', name: 'Шүдний гэрэлтүүлэг', base_price: 80000, category: 'whitening', duration_minutes: 60, status: 'active' },
    ],
  },

  // ------------------------------------------------------------------
  // 8. Real Estate
  // ------------------------------------------------------------------
  real_estate: {
    products: [
      { id: 're1', name: '2 өрөө, Баянгол 13-р хороолол', base_price: 85000000, category: 'Орон сууц', status: 'active', description: '56м², 5/12 давхар' },
      { id: 're2', name: '3 өрөө, Сүхбаатар', base_price: 150000000, category: 'Орон сууц', status: 'active', description: '82м², 8/16 давхар' },
      { id: 're3', name: 'Газар, Налайх 800м²', base_price: 45000000, category: 'Газар', status: 'active', description: 'Амины орон сууцны зориулалт' },
      { id: 're4', name: '1 өрөө студио, Чингэлтэй', base_price: 600000, category: 'Түрээс', status: 'active', description: 'Тавилгатай, сарын түрээс' },
      { id: 're5', name: 'Оффис, Сүхбаатар 50м²', base_price: 1500000, category: 'Оффис', status: 'active', description: 'Сарын түрээс, засвартай' },
    ],
    services: [],
  },

  // ------------------------------------------------------------------
  // 9. Camping / Guesthouse
  // ------------------------------------------------------------------
  camping_guesthouse: {
    products: [],
    services: [
      { id: 'cg1', name: 'Монгол гэр (Стандарт)', base_price: 80000, category: 'ger', duration_minutes: 0, status: 'active', description: '2 хүн, халуун ус' },
      { id: 'cg2', name: 'Монгол гэр (Люкс)', base_price: 120000, category: 'ger', duration_minutes: 0, status: 'active', description: '4 хүн, халуун ус, wifi' },
      { id: 'cg3', name: 'Стандарт өрөө', base_price: 60000, category: 'room', duration_minutes: 0, status: 'active', description: '2 хүн, TV, wifi' },
      { id: 'cg4', name: 'Люкс өрөө', base_price: 100000, category: 'room', duration_minutes: 0, status: 'active', description: '2 хүн, мини бар, тагт' },
      { id: 'cg5', name: 'Майхны талбай', base_price: 15000, category: 'tent_site', duration_minutes: 0, status: 'active', description: 'Цахилгаан, ус' },
      { id: 'cg6', name: 'Модон байшин', base_price: 150000, category: 'cabin', duration_minutes: 0, status: 'active', description: '4 хүн, гал тогоо, зуух' },
    ],
  },
}

/**
 * Get demo items for a business type and table.
 * Supports optional ilike category filtering.
 */
export function getDemoItems(
  businessType: string,
  table: 'products' | 'services',
  options?: { category?: string; limit?: number }
): DemoItem[] {
  const data = DEMO_DATA[businessType]
  if (!data) return []

  let items = table === 'products' ? data.products : data.services

  if (options?.category) {
    const cat = options.category.toLowerCase().replace(/%/g, '')
    items = items.filter(
      i => i.category?.toLowerCase().includes(cat)
    )
  }

  if (options?.limit) {
    items = items.slice(0, options.limit)
  }

  return items
}
