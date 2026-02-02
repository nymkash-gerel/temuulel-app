/**
 * Seed script: Creates 10 business accounts with products/services.
 *
 * Each account gets:
 * - A Supabase auth user (email/password)
 * - A store with business_type and chatbot settings
 * - Products and/or services from industry templates
 * - Staff members (for service-based businesses)
 * - Bookable resources (for restaurant + camping)
 *
 * Usage: npx tsx scripts/seed-all-businesses.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Business definitions
// ============================================================================

interface BusinessDef {
  email: string
  password: string
  storeName: string
  slug: string
  businessType: string
  description: string
  phone: string
  chatbotSettings: Record<string, unknown>
  products?: Array<{
    name: string
    description: string
    category: string
    base_price: number
    search_aliases?: string[]
    product_faqs?: Record<string, string>
  }>
  services?: Array<{
    name: string
    description: string
    category: string
    duration_minutes: number
    base_price: number
    ai_context?: string
  }>
  staff?: Array<{
    name: string
    phone: string
    email: string
    specialties: string[]
  }>
  resources?: Array<{
    type: string
    name: string
    description: string
    capacity: number
    price_per_unit: number
    features: Record<string, unknown>
  }>
}

const BUSINESSES: BusinessDef[] = [
  // 1. Restaurant
  {
    email: 'restaurant@temuulel.test',
    password: 'test1234',
    storeName: 'Номин Ресторан',
    slug: 'nomin-restaurant',
    businessType: 'restaurant',
    description: 'Монгол уламжлалт хоолны ресторан. Бууз, хуушуур, цуйван зэрэг шилдэг хоолнууд.',
    phone: '77001001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Номин Ресторанд тавтай морил. Цэс, захиалга, ширээ захиалах талаар асууна уу! 🍽️',
      away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!',
      quick_replies: ['Өнөөдрийн тусгай цэс', 'Хүргэлт хийдэг үү?', 'Ширээ захиалах', 'Ажиллах цаг'],
      tone: 'friendly',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#ef4444',
    },
    products: [
      { name: 'Бууз (8ш)', description: 'Уламжлалт монгол бууз, махан чанартай', category: 'Үндсэн хоол', base_price: 12000, search_aliases: ['бууз', 'buuz', 'мах'] },
      { name: 'Хуушуур (4ш)', description: 'Шарсан хуушуур, халуун шинэхэн', category: 'Зууш', base_price: 8000, search_aliases: ['хуушуур', 'khuushuur'] },
      { name: 'Цуйван', description: 'Монгол шарсан гоймон, ногоотой', category: 'Үндсэн хоол', base_price: 15000, search_aliases: ['цуйван', 'tsuivan', 'гоймон'] },
      { name: 'Шарсан мах', description: 'Хонины шарсан мах, төмсөнд дэвсэж', category: 'Үндсэн хоол', base_price: 18000, search_aliases: ['шарсан мах', 'мах'] },
      { name: 'Ногоотой салат', description: 'Шинэхэн ногооны салат, заправкатай', category: 'Зууш', base_price: 8000, search_aliases: ['салат', 'ногоо'] },
      { name: 'Сүүтэй цай', description: 'Монгол сүүтэй цай (аяга)', category: 'Ундаа', base_price: 3000, search_aliases: ['цай', 'суутэй цай'] },
      { name: 'Бялуу', description: 'Өдрийн шинэхэн бялуу', category: 'Амттан', base_price: 7000, search_aliases: ['бялуу', 'амттан', 'десерт'] },
      { name: 'Вегетариан хуурга', description: 'Ногоон хүнсний хуурга, тофутай', category: 'Тусгай цэс', base_price: 10000, search_aliases: ['вегетариан', 'тофу', 'ногоо'] },
    ],
    resources: [
      { type: 'table', name: 'Ширээ 1', description: 'Цонхны дэргэдэх 2 хүний ширээ', capacity: 2, price_per_unit: 0, features: { window_view: true } },
      { type: 'table', name: 'Ширээ 2', description: '4 хүний ширээ', capacity: 4, price_per_unit: 0, features: {} },
      { type: 'table', name: 'Ширээ 3', description: '4 хүний ширээ', capacity: 4, price_per_unit: 0, features: {} },
      { type: 'table', name: 'Ширээ 4 (VIP)', description: 'Хувийн өрөө, 6 хүн', capacity: 6, price_per_unit: 0, features: { private_room: true } },
      { type: 'table', name: 'Ширээ 5 (Том)', description: '10 хүний том ширээ', capacity: 10, price_per_unit: 0, features: {} },
    ],
    staff: [
      { name: 'Батбаяр', phone: '99001001', email: 'batbayar@nomin.mn', specialties: ['менежер'] },
      { name: 'Оюунцэцэг', phone: '99001002', email: 'oyunaa@nomin.mn', specialties: ['тогооч'] },
    ],
  },

  // 2. Hospital
  {
    email: 'hospital@temuulel.test',
    password: 'test1234',
    storeName: 'Эрүүл Амьдрал Эмнэлэг',
    slug: 'eruul-amidral',
    businessType: 'hospital',
    description: 'Олон мэргэжлийн эмнэлэг. Ерөнхий үзлэг, дотрын тасаг, лаборатори.',
    phone: '77002001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Эрүүл Амьдрал Эмнэлэгт тавтай морил. Цаг захиалга, тасаг, үнийн мэдээлэл асууна уу. 🏥',
      away_message: 'Ажлын бус цагт холбогдож байна. Яаралтай тусламж: 107.',
      quick_replies: ['Цаг захиалах', 'Тасгуудын мэдээлэл', 'Даатгал хүлээн авдаг уу?', 'Ажиллах цаг'],
      tone: 'professional',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'эмч, менежер, яаралтай, оператор, гомдол',
      accent_color: '#06b6d4',
    },
    services: [
      { name: 'Ерөнхий үзлэг', description: 'Ерөнхий нарийн мэргэжлийн эмчийн үзлэг', category: 'Ерөнхий үзлэг', duration_minutes: 30, base_price: 25000 },
      { name: 'Цусны ерөнхий шинжилгээ', description: 'CBC шинжилгээ, хариу 2 цагт гарна', category: 'Лаборатори', duration_minutes: 15, base_price: 15000 },
      { name: 'Нүдний үзлэг', description: 'Нүдний харааны шалгалт, оношилгоо', category: 'Нүдний тасаг', duration_minutes: 30, base_price: 30000 },
      { name: 'Дотрын эмчийн үзлэг', description: 'Дотрын нарийн мэргэжлийн эмчийн үзлэг', category: 'Дотрын тасаг', duration_minutes: 30, base_price: 35000 },
      { name: 'Хүүхдийн үзлэг', description: 'Хүүхдийн нарийн мэргэжлийн эмчийн үзлэг', category: 'Хүүхдийн тасаг', duration_minutes: 30, base_price: 30000 },
      { name: 'ЭХО шинжилгээ', description: 'Хэвлийн ЭХО шинжилгээ', category: 'Лаборатори', duration_minutes: 20, base_price: 35000 },
      { name: 'Зүрхний ЭКГ', description: 'Зүрхний цахилгаан бичлэг', category: 'Дотрын тасаг', duration_minutes: 15, base_price: 20000 },
    ],
    staff: [
      { name: 'Д. Болормаа', phone: '99002001', email: 'bolormaa@eruul.mn', specialties: ['Ерөнхий үзлэг', 'Дотрын тасаг'] },
      { name: 'Э. Батсүх', phone: '99002002', email: 'batsukh@eruul.mn', specialties: ['Нүдний тасаг'] },
      { name: 'Н. Сарантуяа', phone: '99002003', email: 'sarantuya@eruul.mn', specialties: ['Хүүхдийн тасаг'] },
    ],
  },

  // 3. Beauty Salon
  {
    email: 'beauty@temuulel.test',
    password: 'test1234',
    storeName: 'Bella Beauty Salon',
    slug: 'bella-beauty',
    businessType: 'beauty_salon',
    description: 'Гоо сайхны салон. Үсчин, маникюр, нүүр арчилгаа, массаж.',
    phone: '77003001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Bella Beauty Salon-д тавтай морил. Үйлчилгээ, цаг захиалга, үнийн мэдээлэл авна уу! 💇',
      away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!',
      quick_replies: ['Үйлчилгээний жагсаалт', 'Цаг захиалах', 'Үнийн мэдээлэл', 'Ажиллах цаг'],
      tone: 'friendly',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#ec4899',
    },
    services: [
      { name: 'Эмэгтэй үс засалт', description: 'Эмэгтэй үс засалт, загвар', category: 'Үсчин', duration_minutes: 60, base_price: 25000 },
      { name: 'Эрэгтэй үс засалт', description: 'Эрэгтэй үс засалт', category: 'Үсчин', duration_minutes: 30, base_price: 15000 },
      { name: 'Үс будалт', description: 'Үс будах, өнгө сонголттой', category: 'Үсчин', duration_minutes: 120, base_price: 60000, ai_context: 'Богино: 45,000₮, Дунд: 60,000₮, Урт: 80,000₮' },
      { name: 'Маникюр', description: 'Маникюр, лак түрхэлт', category: 'Маникюр/Педикюр', duration_minutes: 45, base_price: 15000 },
      { name: 'Гель маникюр', description: 'Гель лак маникюр, загвартай', category: 'Маникюр/Педикюр', duration_minutes: 60, base_price: 25000 },
      { name: 'Нүүр цэвэрлэгээ', description: 'Нүүрний гүнзгий цэвэрлэгээ', category: 'Нүүр арчилгаа', duration_minutes: 60, base_price: 35000 },
      { name: 'Биеийн массаж', description: 'Бүх биеийн тайвшруулах массаж', category: 'Массаж', duration_minutes: 60, base_price: 45000 },
    ],
    staff: [
      { name: 'Ану', phone: '99003001', email: 'anu@bella.mn', specialties: ['Үсчин'] },
      { name: 'Сэлэнгэ', phone: '99003002', email: 'selenge@bella.mn', specialties: ['Маникюр/Педикюр', 'Нүүр арчилгаа'] },
      { name: 'Нандин', phone: '99003003', email: 'nandin@bella.mn', specialties: ['Массаж'] },
    ],
  },

  // 4. Coffee Shop
  {
    email: 'coffee@temuulel.test',
    password: 'test1234',
    storeName: 'Кофе Хаус',
    slug: 'kofe-haus',
    businessType: 'coffee_shop',
    description: 'Чанартай кофе, бялуу, тухтай орчин.',
    phone: '77004001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Кофе Хаус-т тавтай морил. Цэс, захиалга, хүргэлтийн талаар асууна уу! ☕',
      away_message: 'Одоогоор хаалттай байна. Маргааш 08:00-д нээгдэнэ!',
      quick_replies: ['Цэс харах', 'Хүргэлт хийдэг үү?', 'Өнөөдрийн онцлох', 'Wi-Fi нууц үг'],
      tone: 'casual',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#92400e',
    },
    products: [
      { name: 'Американо', description: 'Классик хар кофе', category: 'Кофе', base_price: 6000, search_aliases: ['американо', 'americano', 'кофе', 'хар кофе'] },
      { name: 'Латте', description: 'Эспрессо + сүү, зөөлөн амт', category: 'Кофе', base_price: 7500, search_aliases: ['латте', 'latte', 'суутэй кофе'] },
      { name: 'Капучино', description: 'Эспрессо + сүүн хөөс', category: 'Кофе', base_price: 7000, search_aliases: ['капучино', 'cappuccino'] },
      { name: 'Моча', description: 'Шоколадтай кофе, крем', category: 'Кофе', base_price: 8500, search_aliases: ['моча', 'mocha', 'шоколад кофе'] },
      { name: 'Матча латте', description: 'Япон ногоон цайн латте', category: 'Цай', base_price: 8000, search_aliases: ['матча', 'matcha', 'ногоон цай'] },
      { name: 'Ice Americano', description: 'Хүйтэн американо, мөстэй', category: 'Хүйтэн ундаа', base_price: 7000, search_aliases: ['айс', 'ice', 'хуйтэн кофе'] },
      { name: 'Чизкейк', description: 'Нью-Йорк чизкейк, нэг зүсэм', category: 'Бялуу/Амттан', base_price: 9000, search_aliases: ['чизкейк', 'cheesecake', 'бялуу'] },
      { name: 'Круассан', description: 'Шинэхэн жигнэсэн круассан', category: 'Snack', base_price: 5000, search_aliases: ['круассан', 'croissant'] },
    ],
    staff: [
      { name: 'Тэмүүлэл', phone: '99004001', email: 'temuulel@kofe.mn', specialties: ['бариста'] },
    ],
  },

  // 5. Fitness
  {
    email: 'fitness@temuulel.test',
    password: 'test1234',
    storeName: 'FitZone Gym',
    slug: 'fitzone-gym',
    businessType: 'fitness',
    description: 'Орчин үеийн фитнесс клуб. Gym, йога, пилатес, кроссфит, усан сан.',
    phone: '77005001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! FitZone Gym-д тавтай морил. Гишүүнчлэл, хичээлийн хуваарь, үнийн мэдээлэл авна уу! 💪',
      away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 07:00-д нээгдэнэ!',
      quick_replies: ['Гишүүнчлэлийн үнэ', 'Хичээлийн хуваарь', 'Хувийн дасгалжуулагч', 'Ажиллах цаг'],
      tone: 'friendly',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#8b5cf6',
    },
    services: [
      { name: 'Хувийн дасгал (1 цаг)', description: 'Хувийн дасгалжуулагчтай 1 цагийн хичээл', category: 'Хувийн дасгал', duration_minutes: 60, base_price: 40000 },
      { name: 'Йога хичээл', description: 'Бүлгийн йога хичээл', category: 'Йога', duration_minutes: 60, base_price: 15000 },
      { name: 'Пилатес', description: 'Бүлгийн пилатес хичээл', category: 'Бүлгийн хичээл', duration_minutes: 50, base_price: 15000 },
      { name: 'Кроссфит', description: 'Бүлгийн кроссфит хичээл', category: 'Бүлгийн хичээл', duration_minutes: 45, base_price: 12000 },
      { name: 'Усан сан (1 удаа)', description: 'Усан сангийн 1 удаагийн эрх', category: 'Усан сан', duration_minutes: 60, base_price: 10000 },
      { name: 'Сарын гишүүнчлэл', description: '1 сарын бүрэн гишүүнчлэл', category: 'Гишүүнчлэл', duration_minutes: 0, base_price: 120000 },
    ],
    staff: [
      { name: 'Төмөр', phone: '99005001', email: 'tomor@fitzone.mn', specialties: ['Хувийн дасгал', 'Кроссфит'] },
      { name: 'Солонго', phone: '99005002', email: 'solongo@fitzone.mn', specialties: ['Йога', 'Пилатес'] },
    ],
  },

  // 6. Education
  {
    email: 'education@temuulel.test',
    password: 'test1234',
    storeName: 'Ухаанай Сургалт',
    slug: 'ukhaanai-surgalt',
    businessType: 'education',
    description: 'Хэл сургалт, програмчлал, IELTS бэлтгэл, математик.',
    phone: '77006001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Ухаанай Сургалтын төвийн цахим туслахад тавтай морил. Курс, бүртгэл, хуваарийн талаар асууна уу! 📚',
      away_message: 'Одоогоор ажлын бус цаг байна. Даваа гарагт эргэн холбогдоно!',
      quick_replies: ['Курсуудын жагсаалт', 'Бүртгүүлэх', 'Хуваарь', 'Үнийн мэдээлэл'],
      tone: 'professional',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, багш, оператор, гомдол',
      accent_color: '#f59e0b',
      return_policy: 'Курс эхлэхээс 3 хоногийн өмнө цуцалвал 100% буцаана. Эхэлсний дараа буцаалт хийгдэхгүй.',
    },
    services: [
      { name: 'Англи хэл (Эхлэгч)', description: 'Эхлэгчдэд зориулсан англи хэлний сургалт', category: 'Хэл сургалт', duration_minutes: 90, base_price: 180000, ai_context: 'Сард 12 хичээл, 7 хоногт 3 удаа' },
      { name: 'IELTS бэлтгэл', description: 'IELTS шалгалтын бэлтгэл курс', category: 'Хэл сургалт', duration_minutes: 90, base_price: 350000, ai_context: '3 сарын курс, 7 хоногт 5 удаа' },
      { name: 'Математик (ЕБС)', description: '10-12-р ангийн математик бэлтгэл', category: 'ЕБС бэлтгэл', duration_minutes: 90, base_price: 150000 },
      { name: 'Python програмчлал', description: 'Python хэлний үндсэн курс', category: 'Програмчлал', duration_minutes: 120, base_price: 250000, ai_context: '2 сарын курс, 7 хоногт 3 удаа' },
      { name: 'Зурагийн хичээл', description: 'Уран зургийн хичээл, бүх насны', category: 'Урлаг', duration_minutes: 90, base_price: 80000 },
      { name: 'Хятад хэл (Эхлэгч)', description: 'Эхлэгчдэд зориулсан хятад хэлний курс', category: 'Хэл сургалт', duration_minutes: 90, base_price: 200000 },
    ],
    staff: [
      { name: 'Б. Мөнхжин', phone: '99006001', email: 'munkhjin@ukhaanai.mn', specialties: ['Англи хэл', 'IELTS'] },
      { name: 'Д. Ариунболд', phone: '99006002', email: 'ariunbold@ukhaanai.mn', specialties: ['Python', 'Програмчлал'] },
    ],
  },

  // 7. Dental Clinic
  {
    email: 'dental@temuulel.test',
    password: 'test1234',
    storeName: 'Инээмсэглэл Шүдний',
    slug: 'ineemseglel-dental',
    businessType: 'dental_clinic',
    description: 'Шүдний эмнэлэг. Үзлэг, цэвэрлэгээ, ломбо, импланат.',
    phone: '77007001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Инээмсэглэл Шүдний Эмнэлэгт тавтай морил. Цаг захиалга, үйлчилгээ, үнийн мэдээлэл авна уу! 🦷',
      away_message: 'Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00 цагт үйлчилнэ.',
      quick_replies: ['Цаг захиалах', 'Үйлчилгээний үнэ', 'Шүдний цэвэрлэгээ', 'Даатгал хүлээн авдаг уу?'],
      tone: 'professional',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'эмч, менежер, яаралтай, оператор, гомдол',
      accent_color: '#14b8a6',
    },
    services: [
      { name: 'Шүдний үзлэг', description: 'Шүдний ерөнхий үзлэг, оношилгоо', category: 'Оношилгоо', duration_minutes: 30, base_price: 15000 },
      { name: 'Шүдний цэвэрлэгээ', description: 'Мэргэжлийн шүдний цэвэрлэгээ', category: 'Гоо сайхны', duration_minutes: 45, base_price: 40000 },
      { name: 'Ломбо тавих', description: 'Шүдний ломбо, материал сонголттой', category: 'Эмчилгээ', duration_minutes: 45, base_price: 35000, ai_context: 'Энгийн ломбо: 35,000₮. Гэрлийн ломбо: 50,000₮.' },
      { name: 'Шүд авалт', description: 'Шүд авах мэс ажилбар', category: 'Мэс засал', duration_minutes: 30, base_price: 30000 },
      { name: 'Шүдний импланат', description: 'Импланат суулгах, зөвлөгөө', category: 'Мэс засал', duration_minutes: 90, base_price: 800000, ai_context: 'Үнэ импланатын төрлөөс хамаарна. Зөвлөгөөг үнэгүй авна.' },
      { name: 'Шүд цайруулах', description: 'Мэргэжлийн шүд цайруулалт', category: 'Гоо сайхны', duration_minutes: 60, base_price: 120000 },
      { name: 'Хүүхдийн шүдний үзлэг', description: 'Хүүхдэд зориулсан шүдний үзлэг', category: 'Хүүхдийн', duration_minutes: 20, base_price: 10000 },
    ],
    staff: [
      { name: 'Д. Нарангэрэл', phone: '99007001', email: 'narangerel@dental.mn', specialties: ['Оношилгоо', 'Эмчилгээ'] },
      { name: 'Б. Энхбаяр', phone: '99007002', email: 'enkhbayar@dental.mn', specialties: ['Мэс засал', 'Импланат'] },
    ],
  },

  // 8. Real Estate
  {
    email: 'realestate@temuulel.test',
    password: 'test1234',
    storeName: 'Green Home Realty',
    slug: 'green-home-realty',
    businessType: 'real_estate',
    description: 'Үл хөдлөх хөрөнгийн агентлаг. Орон сууц, газар, түрээс.',
    phone: '77008001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Green Home Realty-д тавтай морил. Орон сууц, газар, түрээсийн мэдээлэл авна уу! 🏠',
      away_message: 'Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00.',
      quick_replies: ['Орон сууц хайх', 'Газрын зар', 'Түрээсийн зар', 'Зээлийн зөвлөгөө'],
      tone: 'professional',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'агент, менежер, хүн, оператор, гомдол',
      accent_color: '#10b981',
    },
    products: [
      { name: '2 өрөө орон сууц (Баянгол)', description: '2 өрөө, 55м², 12-р давхар, шинэ засалтай', category: 'Орон сууц', base_price: 95000000, search_aliases: ['2 өрөө', 'орон сууц', 'баянгол'] },
      { name: '3 өрөө орон сууц (Сүхбаатар)', description: '3 өрөө, 85м², 7-р давхар, төв байршилтай', category: 'Орон сууц', base_price: 180000000, search_aliases: ['3 өрөө', 'сухбаатар'] },
      { name: 'Газар (Налайх 700м²)', description: '700м² газар, гэр хорооллын бүсэд', category: 'Газар', base_price: 45000000, search_aliases: ['газар', 'налайх'] },
      { name: 'Оффис (Чингэлтэй 120м²)', description: '120м² оффис, анхан давхарт, зогсоолтой', category: 'Оффис', base_price: 250000000, search_aliases: ['оффис', 'чингэлтэй'] },
      { name: '1 өрөө түрээс (ХУД)', description: '1 өрөө, 35м², тавилга бүрэн', category: 'Түрээс', base_price: 650000, search_aliases: ['түрээс', '1 өрөө'], product_faqs: { 'Барьцаа': '2 сарын түрээс' } },
      { name: '2 өрөө түрээс (БЗД)', description: '2 өрөө, 60м², шинэ засалтай', category: 'Түрээс', base_price: 1200000, search_aliases: ['түрээс', '2 өрөө'], product_faqs: { 'Барьцаа': '2 сарын түрээс' } },
    ],
    staff: [
      { name: 'Б. Ганзориг', phone: '99008001', email: 'ganzorig@greenhome.mn', specialties: ['Орон сууц', 'Газар'] },
    ],
  },

  // 9. Camping / Guesthouse
  {
    email: 'camping@temuulel.test',
    password: 'test1234',
    storeName: 'Хустай Кемпинг',
    slug: 'khustai-camping',
    businessType: 'camping_guesthouse',
    description: 'Монгол гэр, модон байшин, майхны талбай. Морь унах, сур харвалт.',
    phone: '77009001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Хустай Кемпинг-д тавтай морил. Байр захиалга, үнэ, хөтөлбөрийн талаар асууна уу! ⛺',
      away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 09:00-д холбогдоно.',
      quick_replies: ['Байрны төрлүүд', 'Захиалга өгөх', 'Амралтын хөтөлбөр', 'Хэрхэн хүрэх вэ?'],
      tone: 'friendly',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#84cc16',
    },
    services: [
      { name: 'Морь унах', description: 'Морь унах аялал (1 цаг)', category: 'Хөтөлбөр', duration_minutes: 60, base_price: 30000 },
      { name: 'Сур харвалт', description: 'Сур харвалт, зааварчилгаатай', category: 'Хөтөлбөр', duration_minutes: 30, base_price: 20000 },
      { name: 'Байгалийн аялал', description: 'Хустай нуруу тойрох аялал', category: 'Хөтөлбөр', duration_minutes: 180, base_price: 15000 },
      { name: 'Кэмпфайр шөнийн хөтөлбөр', description: 'Галын дэргэдэх шөнийн хөтөлбөр', category: 'Хөтөлбөр', duration_minutes: 120, base_price: 10000 },
    ],
    resources: [
      { type: 'ger', name: 'Монгол гэр (Стандарт) №1', description: '2 хүн, халуун ус', capacity: 2, price_per_unit: 80000, features: { hot_water: true } },
      { type: 'ger', name: 'Монгол гэр (Стандарт) №2', description: '2 хүн, халуун ус', capacity: 2, price_per_unit: 80000, features: { hot_water: true } },
      { type: 'ger', name: 'Монгол гэр (Люкс)', description: '4 хүн, wifi, халуун ус', capacity: 4, price_per_unit: 120000, features: { hot_water: true, wifi: true } },
      { type: 'room', name: 'Стандарт өрөө №1', description: '2 хүн, TV, wifi', capacity: 2, price_per_unit: 60000, features: { tv: true, wifi: true } },
      { type: 'room', name: 'Люкс өрөө', description: '2 хүн, мини бар, тагт', capacity: 2, price_per_unit: 100000, features: { mini_bar: true, balcony: true, wifi: true } },
      { type: 'tent_site', name: 'Майхны талбай №1', description: 'Цахилгаан, усны холболттой', capacity: 4, price_per_unit: 15000, features: { electricity: true, water: true } },
      { type: 'tent_site', name: 'Майхны талбай №2', description: 'Цахилгаан, усны холболттой', capacity: 4, price_per_unit: 15000, features: { electricity: true, water: true } },
      { type: 'cabin', name: 'Модон байшин', description: '4 хүн, гал тогоо, зуух', capacity: 4, price_per_unit: 150000, features: { kitchen: true, fireplace: true } },
    ],
    staff: [
      { name: 'Б. Ганболд', phone: '99009001', email: 'ganbold@khustai.mn', specialties: ['менежер'] },
      { name: 'Д. Мөнхбат', phone: '99009002', email: 'munkhbat@khustai.mn', specialties: ['морь', 'аялал'] },
    ],
  },

  // 10. Online Shop (Ecommerce)
  {
    email: 'shop@temuulel.test',
    password: 'test1234',
    storeName: 'Монгол Маркет',
    slug: 'mongol-market',
    businessType: 'ecommerce',
    description: 'Онлайн дэлгүүр. Хувцас, электроник, гэр ахуй, гоо сайхны бүтээгдэхүүн.',
    phone: '77010001',
    chatbotSettings: {
      welcome_message: 'Сайн байна уу! Монгол Маркет онлайн дэлгүүрт тавтай морил. Бүтээгдэхүүн хайх, захиалга өгөх, хүргэлтийн мэдээлэл авна уу! 🛒',
      away_message: 'Баярлалаа! Ажлын цагт (09:00-21:00) эргэн холбогдоно.',
      quick_replies: ['Бүтээгдэхүүн хайх', 'Захиалга шалгах', 'Хүргэлтийн мэдээлэл', 'Буцаалтын бодлого'],
      tone: 'friendly',
      language: 'mongolian',
      show_product_prices: true,
      max_product_results: 5,
      auto_handoff: true,
      handoff_keywords: 'менежер, хүн, оператор, гомдол',
      accent_color: '#3b82f6',
      return_policy: 'Бүтээгдэхүүн хүлээж авснаас 14 хоногийн дотор буцаалт хийх боломжтой. Шошго, баглаа боодол бүрэн байх шаардлагатай.',
    },
    products: [
      { name: 'Кашемир цамц', description: 'Монгол кашемир, эрэгтэй/эмэгтэй, S-XL размер', category: 'Хувцас', base_price: 189000, search_aliases: ['кашемир', 'цамц', 'cashmere', 'sweater'] },
      { name: 'Ноосон малгай', description: 'Монгол ноосон малгай, өвлийн улирал', category: 'Хувцас', base_price: 35000, search_aliases: ['малгай', 'ноос', 'hat'] },
      { name: 'Арьсан цүнх', description: 'Жинхэнэ арьсан гар цүнх', category: 'Хувцас', base_price: 120000, search_aliases: ['цүнх', 'bag', 'арьс'] },
      { name: 'Утасгүй чихэвч (Bluetooth)', description: 'ANC чихэвч, 30 цагийн батерей', category: 'Электроник', base_price: 85000, search_aliases: ['чихэвч', 'bluetooth', 'earbuds', 'headphones'] },
      { name: 'Ухаалаг цаг', description: 'Фитнесс трекер, зүрхний цохилт, GPS', category: 'Электроник', base_price: 125000, search_aliases: ['ухаалаг цаг', 'smartwatch', 'фитнесс'] },
      { name: 'USB-C цэнэглэгч (65W)', description: 'Хурдан цэнэглэгч, зөөврийн компьютерт тохиромжтой', category: 'Электроник', base_price: 45000, search_aliases: ['цэнэглэгч', 'charger', 'usb-c'] },
      { name: 'Нүүрний тос (Витамин C)', description: 'Нүүрний арчилгааны тос, 50мл', category: 'Гоо сайхан', base_price: 28000, search_aliases: ['нүүрний тос', 'cream', 'витамин'] },
      { name: 'Шампунь + Кондиционер', description: 'Байгалийн орц найрлагатай, 2х250мл', category: 'Гоо сайхан', base_price: 32000, search_aliases: ['шампунь', 'shampoo', 'ус засал'] },
      { name: 'Гэрийн чимэглэл (Зурагтын тавиур)', description: 'Модон ханын тавиур, 3 тавцантай', category: 'Гэр ахуй', base_price: 55000, search_aliases: ['тавиур', 'shelf', 'чимэглэл'] },
      { name: 'Хүүхдийн тоглоом (Лего)', description: 'Барилгын блок, 150+ хэсэг, 5+ нас', category: 'Хүүхэд', base_price: 42000, search_aliases: ['тоглоом', 'лего', 'lego', 'хүүхэд'], product_faqs: { 'Насны ангилал': '5 наснаас дээш' } },
    ],
    staff: [
      { name: 'Б. Тэмүүлэн', phone: '99010001', email: 'temuulen@mongolmarket.mn', specialties: ['менежер', 'борлуулалт'] },
      { name: 'Д. Сарнай', phone: '99010002', email: 'sarnai@mongolmarket.mn', specialties: ['хүргэлт', 'агуулах'] },
    ],
  },
]

// ============================================================================
// Seed functions
// ============================================================================

async function createUser(email: string, password: string): Promise<string> {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = existing?.users?.find((u: any) => u.email === email)
  if (found) {
    console.log(`  ⟳ User ${email} already exists (${found.id})`)
    // Ensure public.users row exists too
    await ensurePublicUser(found.id, email)
    return found.id
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`)
  console.log(`  ✓ User created: ${email} (${data.user.id})`)

  // Insert into public.users (stores.owner_id references this table)
  await ensurePublicUser(data.user.id, email)
  return data.user.id
}

async function ensurePublicUser(userId: string, email: string): Promise<void> {
  const { data: existingPublic } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existingPublic) {
    return // already exists
  }

  const { error } = await supabase.from('users').insert({
    id: userId,
    email,
    role: 'owner',
    is_verified: true,
    email_verified: true,
  })
  if (error) throw new Error(`Failed to create public user ${email}: ${error.message}`)
  console.log(`  ✓ Public user record created`)
}


  // Check if store already exists for this user
  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (existing) {
    // Update the store
    await supabase
      .from('stores')
      .update({
        name: biz.storeName,
        slug: biz.slug,
        business_type: biz.businessType,
        description: biz.description,
        phone: biz.phone,
        chatbot_settings: biz.chatbotSettings,
        ai_auto_reply: true,
      })
      .eq('id', existing.id)
    console.log(`  ⟳ Store updated: ${biz.storeName} (${existing.id})`)
    return existing.id
  }

  const { data, error } = await supabase
    .from('stores')
    .insert({
      owner_id: userId,
      name: biz.storeName,
      slug: biz.slug,
      business_type: biz.businessType,
      description: biz.description,
      phone: biz.phone,
      chatbot_settings: biz.chatbotSettings,
      ai_auto_reply: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create store ${biz.storeName}: ${error.message}`)
  console.log(`  ✓ Store created: ${biz.storeName} (${data.id})`)
  return data.id
}


  if (!products || products.length === 0) return

  // Delete existing products for this store
  await supabase.from('products').delete().eq('store_id', storeId)

  const rows = products.map((p) => ({
    store_id: storeId,
    name: p.name,
    description: p.description,
    category: p.category,
    base_price: p.base_price,
    status: 'active',
    images: [],
  }))

  const { error } = await supabase.from('products').insert(rows)
  if (error) throw new Error(`Failed to seed products: ${error.message}`)
  console.log(`  ✓ ${products.length} products created`)
}

// Note: seedServices, seedStaff, seedResources removed.
// These tables are not in PostgREST schema cache (migration 013+).
// SQL file is generated instead — run it in Supabase SQL Editor.

// ============================================================================
// SQL generation for tables not in PostgREST schema cache
// ============================================================================

function escSql(s: string): string {
  return s.replace(/'/g, "''")
}

function generateFullSqlSeed(userMap: Map<string, string>): string {
  const lines: string[] = [
    '-- Full seed: public.users, stores, products, services, staff, bookable_resources.',
    '-- Run this in Supabase SQL Editor.',
    '',
    "NOTIFY pgrst, 'reload schema';",
    '',
  ]

  for (const biz of BUSINESSES) {
    const userId = userMap.get(biz.email)
    if (!userId) continue

    lines.push(`-- ═══════════════════════════════════════════════`)
    lines.push(`-- ${biz.storeName} (${biz.businessType})`)
    lines.push(`-- ═══════════════════════════════════════════════`)

    // 1. Ensure public.users row (omit role — use database default)
    lines.push(`INSERT INTO users (id, email, password_hash, is_verified, email_verified)`)
    lines.push(`  VALUES ('${userId}', '${biz.email}', 'supabase_auth', true, true)`)
    lines.push(`  ON CONFLICT (id) DO NOTHING;`)

    // 2. Upsert store
    lines.push(`INSERT INTO stores (owner_id, name, slug, business_type, description, phone, chatbot_settings, ai_auto_reply)`)
    lines.push(`  VALUES ('${userId}', '${escSql(biz.storeName)}', '${biz.slug}', '${biz.businessType}', '${escSql(biz.description)}', '${biz.phone}', '${JSON.stringify(biz.chatbotSettings).replace(/'/g, "''")}', true)`)
    lines.push(`  ON CONFLICT (slug) DO UPDATE SET`)
    lines.push(`    name = EXCLUDED.name, business_type = EXCLUDED.business_type,`)
    lines.push(`    description = EXCLUDED.description, phone = EXCLUDED.phone,`)
    lines.push(`    chatbot_settings = EXCLUDED.chatbot_settings, ai_auto_reply = EXCLUDED.ai_auto_reply;`)

    // Use a DO block to get store_id by slug for subsequent inserts
    lines.push(`DO $$`)
    lines.push(`DECLARE v_store_id UUID;`)
    lines.push(`BEGIN`)
    lines.push(`  SELECT id INTO v_store_id FROM stores WHERE slug = '${biz.slug}';`)

    // 3. Products
    if (biz.products && biz.products.length > 0) {
      lines.push(`  DELETE FROM products WHERE store_id = v_store_id;`)
      for (const p of biz.products) {
        lines.push(`  INSERT INTO products (store_id, name, description, category, base_price, status, images)`)
        lines.push(`    VALUES (v_store_id, '${escSql(p.name)}', '${escSql(p.description)}', '${escSql(p.category)}', ${p.base_price}, 'active', '[]');`)
      }
    }

    // 4. Services
    if (biz.services && biz.services.length > 0) {
      lines.push(`  DELETE FROM services WHERE store_id = v_store_id;`)
      for (const s of biz.services) {
        lines.push(`  INSERT INTO services (store_id, name, description, category, duration_minutes, base_price, status, ai_context, images)`)
        lines.push(`    VALUES (v_store_id, '${escSql(s.name)}', '${escSql(s.description)}', '${escSql(s.category)}', ${s.duration_minutes}, ${s.base_price}, 'active', ${s.ai_context ? `'${escSql(s.ai_context)}'` : 'NULL'}, '[]');`)
      }
    }

    // 5. Staff
    if (biz.staff && biz.staff.length > 0) {
      lines.push(`  DELETE FROM staff WHERE store_id = v_store_id;`)
      for (const st of biz.staff) {
        lines.push(`  INSERT INTO staff (store_id, name, phone, email, specialties, status)`)
        lines.push(`    VALUES (v_store_id, '${escSql(st.name)}', '${st.phone}', '${st.email}', ARRAY[${st.specialties.map(s => `'${escSql(s)}'`).join(',')}], 'active');`)
      }
    }

    // 6. Bookable resources
    if (biz.resources && biz.resources.length > 0) {
      lines.push(`  DELETE FROM bookable_resources WHERE store_id = v_store_id;`)
      for (let i = 0; i < biz.resources.length; i++) {
        const r = biz.resources[i]
        lines.push(`  INSERT INTO bookable_resources (store_id, type, name, description, capacity, price_per_unit, features, images, status, sort_order)`)
        lines.push(`    VALUES (v_store_id, '${r.type}', '${escSql(r.name)}', '${escSql(r.description)}', ${r.capacity}, ${r.price_per_unit}, '${JSON.stringify(r.features)}', '[]', 'available', ${i});`)
      }
    }

    lines.push(`END $$;`)
    lines.push('')
  }

  lines.push("NOTIFY pgrst, 'reload schema';")
  return lines.join('\n')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== Seeding all business accounts ===\n')
  console.log('Step 1: Creating auth users (via Supabase Auth API)...\n')

  const userMap = new Map<string, string>() // email -> user_id

  for (const biz of BUSINESSES) {
    try {
      const userId = await createUser(biz.email, biz.password)
      userMap.set(biz.email, userId)
    } catch (err) {
      console.error(`  ✗ Error creating ${biz.email}: ${(err as Error).message}`)
    }
  }

  // Step 2: Generate comprehensive SQL for everything else
  console.log('\nStep 2: Generating SQL for stores, products, services, staff, resources...')
  const sqlContent = generateFullSqlSeed(userMap)
  const sqlPath = join(__dirname, 'seed-all-data.sql')
  writeFileSync(sqlPath, sqlContent, 'utf-8')
  console.log(`✓ SQL file generated: ${sqlPath}`)

  console.log('\n\n=== All Accounts ===\n')
  console.log('| # | Business Type      | Store Name              | Email                        | Password |')
  console.log('|---|--------------------|-------------------------|------------------------------|----------|')
  BUSINESSES.forEach((biz, i) => {
    if (userMap.has(biz.email)) {
      console.log(`| ${i + 1} | ${biz.businessType.padEnd(18)} | ${biz.storeName.padEnd(23)} | ${biz.email.padEnd(28)} | ${biz.password} |`)
    }
  })
  console.log('\n→ NEXT: Paste the contents of scripts/seed-all-data.sql into Supabase SQL Editor and run it.')
}

main().catch(console.error)
