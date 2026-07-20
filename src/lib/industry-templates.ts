/**
 * Industry-specific dashboard templates.
 *
 * Each template pre-configures chatbot settings and provides
 * sample services/products for a specific business type.
 * Applied during signup or from settings.
 */
import { EXTRA_TEMPLATES } from './industry-templates-extra'

export type BusinessCategory = 'service' | 'product' | 'hybrid'

export interface SampleService {
  name: string
  description: string
  category: string
  duration_minutes: number
  base_price: number
  ai_context?: string
}

export interface SampleProduct {
  name: string
  description: string
  category: string
  base_price: number
  ai_context?: string
  search_aliases?: string[]
}

export interface ChatbotSettingsTemplate {
  welcome_message: string
  away_message: string
  quick_replies: string[]
  tone: 'friendly' | 'professional' | 'casual'
  language: 'mongolian'
  show_product_prices: boolean
  max_product_results: number
  auto_handoff: boolean
  handoff_keywords: string
  accent_color: string
  return_policy: string
}

export interface IndustryTemplate {
  id: string
  name: string
  icon: string
  accentColor: string
  category: BusinessCategory
  chatbotSettings: ChatbotSettingsTemplate
  sampleServices?: SampleService[]
  sampleProducts?: SampleProduct[]
  categories: string[]
  sampleQuestions: { question: string; answer: string }[]
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const restaurant: IndustryTemplate = {
  id: 'restaurant',
  name: 'Ресторан / Кафе',
  icon: '🍽️',
  accentColor: '#ef4444',
  category: 'product',
  categories: ['Үндсэн хоол', 'Зууш', 'Ундаа', 'Амттан', 'Тусгай цэс'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай рестораны цахим туслахад тавтай морил. Цэс, захиалга, хүргэлтийн талаар асууна уу! 🍽️',
    away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!',
    quick_replies: ['Өнөөдрийн тусгай цэс', 'Хүргэлт хийдэг үү?', 'Ширээ захиалах', 'Ажиллах цагийн хуваарь', 'Менежертэй холбогдох'],
    tone: 'friendly',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'менежер, хүн, оператор, гомдол',
    accent_color: '#ef4444',
    return_policy: '',
  },
  sampleProducts: [
    { name: 'Бууз (8ш)', description: 'Уламжлалт монгол бууз, махан чанартай', category: 'Үндсэн хоол', base_price: 12000, search_aliases: ['бууз', 'buuz', 'мах'] },
    { name: 'Хуушуур (4ш)', description: 'Шарсан хуушуур, халуун шинэхэн', category: 'Зууш', base_price: 8000, search_aliases: ['хуушуур', 'khuushuur'] },
    { name: 'Цуйван', description: 'Монгол шарсан гоймон, ногоотой', category: 'Үндсэн хоол', base_price: 15000, search_aliases: ['цуйван', 'tsuivan', 'гоймон'] },
    { name: 'Шарсан мах', description: 'Хонины шарсан мах, төмсөнд дэвсэж', category: 'Үндсэн хоол', base_price: 18000, search_aliases: ['шарсан мах', 'мах'] },
    { name: 'Ногоотой салат', description: 'Шинэхэн ногооны салат, заправкатай', category: 'Зууш', base_price: 8000, search_aliases: ['салат', 'ногоо'] },
    { name: 'Сүүтэй цай', description: 'Монгол сүүтэй цай (аяга)', category: 'Ундаа', base_price: 3000, search_aliases: ['цай', 'суутэй цай'] },
    { name: 'Бялуу', description: 'Өдрийн шинэхэн бялуу', category: 'Амттан', base_price: 7000, search_aliases: ['бялуу', 'амттан', 'десерт'] },
  ],
  sampleQuestions: [
    { question: 'Өнөөдрийн тусгай цэс юу байна?', answer: 'Өнөөдрийн онцлох хоол: Шарсан мах + Салат + Ундаа = 25,000₮. Цэсээ бүрэн харахыг хүсвэл "цэс" гэж бичнэ үү!' },
    { question: 'Хүргэлт хийдэг үү?', answer: 'Тийм! УБ хотод хүргэлт хийнэ. Хүргэлтийн төлбөр 3,000₮. 50,000₮-с дээш захиалгад үнэгүй хүргэнэ.' },
    { question: 'Ширээ захиалах', answer: 'Ширээ захиалахыг хүсвэл утасны дугаар болон хүмүүсийн тоог бичнэ үү. Бид 2-20 хүний зочдод үйлчилнэ.' },
    { question: 'Хэдэн цагт ажилладаг?', answer: 'Даваа-Ням: 10:00 - 22:00. Амралтын өдөр: 11:00 - 23:00.' },
  ],
}

const hospital: IndustryTemplate = {
  id: 'hospital',
  name: 'Эмнэлэг / Клиник',
  icon: '🏥',
  accentColor: '#06b6d4',
  category: 'service',
  categories: ['Ерөнхий үзлэг', 'Шүдний тасаг', 'Нүдний тасаг', 'Дотрын тасаг', 'Лаборатори', 'Хүүхдийн тасаг'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай эмнэлгийн цахим туслахад тавтай морил. Цаг захиалга, тасаг, үнийн мэдээлэл асууна уу. 🏥',
    away_message: 'Ажлын бус цагт холбогдож байна. Яаралтай тусламж: 107. Ажлын цагаар: Даваа-Баасан 08:00-20:00.',
    quick_replies: ['Цаг захиалах', 'Тасгуудын мэдээлэл', 'Даатгал хүлээн авдаг уу?', 'Ажиллах цаг', 'Эмчтэй холбогдох'],
    tone: 'professional',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'эмч, менежер, яаралтай, оператор, гомдол',
    accent_color: '#06b6d4',
    return_policy: '',
  },
  sampleServices: [
    { name: 'Ерөнхий үзлэг', description: 'Ерөнхий нарийн мэргэжлийн эмчийн үзлэг', category: 'Ерөнхий үзлэг', duration_minutes: 30, base_price: 25000 },
    { name: 'Цусны ерөнхий шинжилгээ', description: 'CBC шинжилгээ, хариу 2 цагт гарна', category: 'Лаборатори', duration_minutes: 15, base_price: 15000 },
    { name: 'Нүдний үзлэг', description: 'Нүдний харааны шалгалт, оношилгоо', category: 'Нүдний тасаг', duration_minutes: 30, base_price: 30000 },
    { name: 'Дотрын эмчийн үзлэг', description: 'Дотрын нарийн мэргэжлийн эмчийн үзлэг', category: 'Дотрын тасаг', duration_minutes: 30, base_price: 35000 },
    { name: 'Хүүхдийн үзлэг', description: 'Хүүхдийн нарийн мэргэжлийн эмчийн үзлэг', category: 'Хүүхдийн тасаг', duration_minutes: 30, base_price: 30000 },
    { name: 'ЭХО шинжилгээ', description: 'Хэвлийн ЭХО шинжилгээ', category: 'Лаборатори', duration_minutes: 20, base_price: 35000 },
    { name: 'Зүрхний ЭКГ', description: 'Зүрхний цахилгаан бичлэг', category: 'Дотрын тасаг', duration_minutes: 15, base_price: 20000 },
  ],
  sampleQuestions: [
    { question: 'Цаг захиалах', answer: 'Аль тасагт үзүүлэхийг хүсэж байна вэ? Тасгаа сонгоод, боломжтой цагаас сонголтоо хийнэ үү.' },
    { question: 'Даатгал хүлээн авдаг уу?', answer: 'Тийм! Бид ЭМД, Монгол даатгал, Практик, Номин даатгалуудыг хүлээн авдаг.' },
    { question: 'Хэдэн цагт ажилладаг?', answer: 'Даваа-Баасан: 08:00-20:00. Бямба: 09:00-16:00. Яаралтай тусламж: 24/7.' },
    { question: 'Лабораторийн шинжилгээний хариу хэзээ гарах вэ?', answer: 'Ерөнхий цусны шинжилгээ: 2 цаг. Биохимийн шинжилгээ: 4-6 цаг. Тусгай шинжилгээ: 1-3 хоног.' },
  ],
}

const beautySalon: IndustryTemplate = {
  id: 'beauty_salon',
  name: 'Гоо сайхан / Үсчин',
  icon: '💇',
  accentColor: '#ec4899',
  category: 'service',
  categories: ['Үсчин', 'Маникюр/Педикюр', 'Нүүр арчилгаа', 'Массаж', 'Гоо сайхан'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай салоны цахим туслахад тавтай морил. Үйлчилгээ, цаг захиалга, үнийн мэдээлэл авна уу! 💇',
    away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 10:00-д эргэн холбогдоно!',
    quick_replies: ['Үйлчилгээний жагсаалт', 'Цаг захиалах', 'Үнийн мэдээлэл', 'Ажиллах цаг', 'Менежертэй холбогдох'],
    tone: 'friendly',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'менежер, хүн, оператор, гомдол',
    accent_color: '#ec4899',
    return_policy: '',
  },
  sampleServices: [
    { name: 'Эмэгтэй үс засалт', description: 'Эмэгтэй үс засалт, загвар', category: 'Үсчин', duration_minutes: 60, base_price: 25000 },
    { name: 'Эрэгтэй үс засалт', description: 'Эрэгтэй үс засалт', category: 'Үсчин', duration_minutes: 30, base_price: 15000 },
    { name: 'Үс будалт', description: 'Үс будах, өнгө сонголттой', category: 'Үсчин', duration_minutes: 120, base_price: 60000, ai_context: 'Үнэ үсний уртаас хамаарна. Богино: 45,000₮, Дунд: 60,000₮, Урт: 80,000₮' },
    { name: 'Маникюр', description: 'Маникюр, лак түрхэлт', category: 'Маникюр/Педикюр', duration_minutes: 45, base_price: 15000 },
    { name: 'Гель маникюр', description: 'Гель лак маникюр, загвартай', category: 'Маникюр/Педикюр', duration_minutes: 60, base_price: 25000 },
    { name: 'Нүүр цэвэрлэгээ', description: 'Нүүрний гүнзгий цэвэрлэгээ', category: 'Нүүр арчилгаа', duration_minutes: 60, base_price: 35000 },
    { name: 'Биеийн массаж', description: 'Бүх биеийн тайвшруулах массаж', category: 'Массаж', duration_minutes: 60, base_price: 45000 },
  ],
  sampleQuestions: [
    { question: 'Үс засуулах үнэ хэд вэ?', answer: 'Эмэгтэй: 25,000₮, Эрэгтэй: 15,000₮. Үс будалт: 45,000-80,000₮ (уртаас хамаарна).' },
    { question: 'Цаг захиалах', answer: 'Ямар үйлчилгээнд цаг авахыг хүсэж байна вэ? Үйлчилгээгээ сонгоод, боломжтой цагаас сонголтоо хийнэ үү.' },
    { question: 'Хэдэн цагт ажилладаг?', answer: 'Даваа-Бямба: 10:00-20:00. Ням: Амарна.' },
    { question: 'Маникюрын үнэ', answer: 'Энгийн маникюр: 15,000₮. Гель маникюр: 25,000₮ (загвар нэмэлт төлбөртэй).' },
  ],
}

const coffeeShop: IndustryTemplate = {
  id: 'coffee_shop',
  name: 'Кофе шоп',
  icon: '☕',
  accentColor: '#92400e',
  category: 'product',
  categories: ['Кофе', 'Цай', 'Хүйтэн ундаа', 'Бялуу/Амттан', 'Snack'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай кофе шопт тавтай морил. Цэс, захиалга, хүргэлтийн талаар асууна уу! ☕',
    away_message: 'Одоогоор хаалттай байна. Маргааш 08:00-д нээгдэнэ!',
    quick_replies: ['Цэс харах', 'Хүргэлт хийдэг үү?', 'Өнөөдрийн онцлох', 'Ажиллах цаг', 'Wi-Fi нууц үг'],
    tone: 'casual',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'менежер, хүн, оператор, гомдол',
    accent_color: '#92400e',
    return_policy: '',
  },
  sampleProducts: [
    { name: 'Американо', description: 'Классик хар кофе', category: 'Кофе', base_price: 6000, search_aliases: ['американо', 'americano', 'кофе', 'хар кофе'] },
    { name: 'Латте', description: 'Эспрессо + сүү, зөөлөн амт', category: 'Кофе', base_price: 7500, search_aliases: ['латте', 'latte', 'суутэй кофе'] },
    { name: 'Капучино', description: 'Эспрессо + сүүн хөөс', category: 'Кофе', base_price: 7000, search_aliases: ['капучино', 'cappuccino'] },
    { name: 'Моча', description: 'Шоколадтай кофе, крем', category: 'Кофе', base_price: 8500, search_aliases: ['моча', 'mocha', 'шоколад кофе'] },
    { name: 'Матча латте', description: 'Япон ногоон цайн латте', category: 'Цай', base_price: 8000, search_aliases: ['матча', 'matcha', 'ногоон цай'] },
    { name: 'Ice Americano', description: 'Хүйтэн американо, мөстэй', category: 'Хүйтэн ундаа', base_price: 7000, search_aliases: ['айс', 'ice', 'хуйтэн кофе'] },
    { name: 'Чизкейк', description: 'Нью-Йорк чизкейк, нэг зүсэм', category: 'Бялуу/Амттан', base_price: 9000, search_aliases: ['чизкейк', 'cheesecake', 'бялуу'] },
    { name: 'Круассан', description: 'Шинэхэн жигнэсэн круассан', category: 'Snack', base_price: 5000, search_aliases: ['круассан', 'croissant'] },
  ],
  sampleQuestions: [
    { question: 'Цэс юу байна?', answer: 'Кофе: Американо 6,000₮, Латте 7,500₮, Капучино 7,000₮, Моча 8,500₮. Амттан: Чизкейк 9,000₮, Круассан 5,000₮.' },
    { question: 'Хүргэлт хийдэг үү?', answer: 'Тийм! Glovo, Himeals ашиглан хүргэлт хийнэ. Эсвэл шууд бидэнд захиална уу.' },
    { question: 'Wi-Fi нууц үг', answer: 'Wi-Fi: CoffeeShop_Guest, Нууц үг: coffee2024. Тухтай суугаарай!' },
    { question: 'Хэдэн цагт ажилладаг?', answer: 'Даваа-Баасан: 08:00-21:00. Амралтын өдөр: 09:00-22:00.' },
  ],
}

const fitness: IndustryTemplate = {
  id: 'fitness',
  name: 'Фитнесс / Gym',
  icon: '💪',
  accentColor: '#8b5cf6',
  category: 'service',
  categories: ['Хувийн дасгал', 'Бүлгийн хичээл', 'Йога', 'Усан сан', 'Гишүүнчлэл'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай фитнесс клубт тавтай морил. Гишүүнчлэл, хичээлийн хуваарь, үнийн мэдээлэл авна уу! 💪',
    away_message: 'Одоогоор ажлын бус цаг байна. Маргааш 07:00-д нээгдэнэ!',
    quick_replies: ['Гишүүнчлэлийн үнэ', 'Хичээлийн хуваарь', 'Хувийн дасгалжуулагч', 'Ажиллах цаг', 'Менежертэй холбогдох'],
    tone: 'friendly',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'менежер, хүн, оператор, гомдол',
    accent_color: '#8b5cf6',
    return_policy: '',
  },
  sampleServices: [
    { name: 'Хувийн дасгал (1 цаг)', description: 'Хувийн дасгалжуулагчтай 1 цагийн хичээл', category: 'Хувийн дасгал', duration_minutes: 60, base_price: 40000 },
    { name: 'Йога хичээл', description: 'Бүлгийн йога хичээл', category: 'Йога', duration_minutes: 60, base_price: 15000 },
    { name: 'Пилатес', description: 'Бүлгийн пилатес хичээл', category: 'Бүлгийн хичээл', duration_minutes: 50, base_price: 15000 },
    { name: 'Кроссфит', description: 'Бүлгийн кроссфит хичээл', category: 'Бүлгийн хичээл', duration_minutes: 45, base_price: 12000 },
    { name: 'Усан сан (1 удаа)', description: 'Усан сангийн 1 удаагийн эрх', category: 'Усан сан', duration_minutes: 60, base_price: 10000 },
    { name: 'Сарын гишүүнчлэл', description: '1 сарын бүрэн гишүүнчлэл', category: 'Гишүүнчлэл', duration_minutes: 0, base_price: 120000 },
  ],
  sampleQuestions: [
    { question: 'Гишүүнчлэлийн үнэ хэд вэ?', answer: 'Сарын гишүүнчлэл: 120,000₮. 3 сар: 300,000₮. 6 сар: 550,000₮. 12 сар: 960,000₮.' },
    { question: 'Хичээлийн хуваарь', answer: 'Йога: Даваа/Лхагва/Баасан 07:00, 18:00. Пилатес: Мягмар/Пүрэв 10:00, 19:00. Кроссфит: Өдөр бүр 08:00, 17:00.' },
    { question: 'Хувийн дасгалжуулагч хэд вэ?', answer: '1 цаг: 40,000₮. 10 удаагийн багц: 350,000₮. Эхлэгчдэд зориулсан 3 удаагийн туршилт: 90,000₮.' },
    { question: 'Хэдэн цагт ажилладаг?', answer: 'Даваа-Баасан: 07:00-22:00. Амралтын өдөр: 09:00-20:00.' },
  ],
}

const education: IndustryTemplate = {
  id: 'education',
  name: 'Сургалт / Курс',
  icon: '📚',
  accentColor: '#f59e0b',
  category: 'service',
  categories: ['Хэл сургалт', 'Математик', 'Програмчлал', 'Урлаг', 'ЕБС бэлтгэл'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай сургалтын төвийн цахим туслахад тавтай морил. Курс, бүртгэл, хуваарийн талаар асууна уу! 📚',
    away_message: 'Одоогоор ажлын бус цаг байна. Даваа гарагт эргэн холбогдоно!',
    quick_replies: ['Курсуудын жагсаалт', 'Бүртгүүлэх', 'Хуваарь', 'Үнийн мэдээлэл', 'Багштай холбогдох'],
    tone: 'professional',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'менежер, багш, оператор, гомдол',
    accent_color: '#f59e0b',
    return_policy: 'Курс эхлэхээс 3 хоногийн өмнө цуцалвал 100% буцаана. Эхэлсний дараа буцаалт хийгдэхгүй.',
  },
  sampleServices: [
    { name: 'Англи хэлний курс (Эхлэгч)', description: 'Эхлэгчдэд зориулсан англи хэлний сургалт', category: 'Хэл сургалт', duration_minutes: 90, base_price: 180000, ai_context: 'Сард 12 хичээл, 7 хоногт 3 удаа' },
    { name: 'IELTS бэлтгэл', description: 'IELTS шалгалтын бэлтгэл курс', category: 'Хэл сургалт', duration_minutes: 90, base_price: 350000, ai_context: '3 сарын курс, долоо хоногт 5 удаа' },
    { name: 'Математик (ЕБС)', description: '10-12-р ангийн математик бэлтгэл', category: 'ЕБС бэлтгэл', duration_minutes: 90, base_price: 150000 },
    { name: 'Python програмчлал', description: 'Python хэлний үндсэн курс', category: 'Програмчлал', duration_minutes: 120, base_price: 250000, ai_context: '2 сарын курс, долоо хоногт 3 удаа' },
    { name: 'Зурагийн хичээл', description: 'Уран зургийн хичээл, бүх насны', category: 'Урлаг', duration_minutes: 90, base_price: 80000 },
    { name: 'Хятад хэл (Эхлэгч)', description: 'Эхлэгчдэд зориулсан хятад хэлний курс', category: 'Хэл сургалт', duration_minutes: 90, base_price: 200000 },
  ],
  sampleQuestions: [
    { question: 'Англи хэлний курс хэд вэ?', answer: 'Эхлэгч: 180,000₮/сар. IELTS бэлтгэл: 350,000₮ (3 сарын курс). Хөнгөлөлт: 2 курс бүртгүүлбэл 10% хямдарна.' },
    { question: 'Хэзээ эхлэх вэ?', answer: 'Шинэ бүлэг сар бүрийн 1, 15-нд нээгдэнэ. Бүртгэлээ одоо хийж болно!' },
    { question: 'Онлайн сургалт байгаа юу?', answer: 'Тийм! Бүх курсууд онлайн болон танхимын хувилбараар явагдана. Онлайн: 15% хямд.' },
    { question: 'Хуваарь', answer: 'Өглөөний бүлэг: 09:00-10:30. Өдрийн: 14:00-15:30. Оройн: 18:00-19:30.' },
  ],
}

const dentalClinic: IndustryTemplate = {
  id: 'dental_clinic',
  name: 'Шүдний эмнэлэг',
  icon: '🦷',
  accentColor: '#14b8a6',
  category: 'service',
  categories: ['Оношилгоо', 'Эмчилгээ', 'Гоо сайхны', 'Мэс засал', 'Хүүхдийн'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай шүдний эмнэлгийн цахим туслахад тавтай морил. Цаг захиалга, үйлчилгээ, үнийн мэдээлэл авна уу! 🦷',
    away_message: 'Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00 цагт үйлчилнэ.',
    quick_replies: ['Цаг захиалах', 'Үйлчилгээний үнэ', 'Шүдний цэвэрлэгээ', 'Даатгал хүлээн авдаг уу?', 'Эмчтэй холбогдох'],
    tone: 'professional',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'эмч, менежер, яаралтай, оператор, гомдол',
    accent_color: '#14b8a6',
    return_policy: '',
  },
  sampleServices: [
    { name: 'Шүдний үзлэг', description: 'Шүдний ерөнхий үзлэг, оношилгоо', category: 'Оношилгоо', duration_minutes: 30, base_price: 15000 },
    { name: 'Шүдний цэвэрлэгээ', description: 'Мэргэжлийн шүдний цэвэрлэгээ', category: 'Гоо сайхны', duration_minutes: 45, base_price: 40000 },
    { name: 'Ломбо тавих', description: 'Шүдний ломбо, материал сонголттой', category: 'Эмчилгээ', duration_minutes: 45, base_price: 35000, ai_context: 'Энгийн ломбо: 35,000₮. Гэрлийн ломбо: 50,000₮.' },
    { name: 'Шүд авалт', description: 'Шүд авах мэс ажилбар', category: 'Мэс засал', duration_minutes: 30, base_price: 30000 },
    { name: 'Шүдний импланат', description: 'Импланат суулгах, зөвлөгөө', category: 'Мэс засал', duration_minutes: 90, base_price: 800000, ai_context: 'Үнэ импланатын төрлөөс хамаарна. Зөвлөгөөг үнэгүй авна.' },
    { name: 'Шүд цайруулах', description: 'Мэргэжлийн шүд цайруулалт', category: 'Гоо сайхны', duration_minutes: 60, base_price: 120000 },
    { name: 'Хүүхдийн шүдний үзлэг', description: 'Хүүхдэд зориулсан шүдний үзлэг', category: 'Хүүхдийн', duration_minutes: 20, base_price: 10000 },
  ],
  sampleQuestions: [
    { question: 'Шүдний цэвэрлэгээ хэд вэ?', answer: 'Мэргэжлийн шүдний цэвэрлэгээ: 40,000₮. 6 сар тутамд хийлгэхийг зөвлөнө.' },
    { question: 'Цаг захиалах', answer: 'Ямар үйлчилгээнд цаг авахыг хүсэж байна вэ? Сонголтоо хийгээд, боломжтой цагаас сонгоно уу.' },
    { question: 'Даатгал хүлээн авдаг уу?', answer: 'Тийм! ЭМД болон хувийн даатгалуудыг хүлээн авдаг. Даатгалын хамрах хүрээг шалгаж өгнө.' },
    { question: 'Импланат хэд вэ?', answer: 'Импланат: 800,000₮-с эхлэнэ. Үнэгүй зөвлөгөө авч, төлбөрийн хуваарь тохирно.' },
  ],
}

const realEstate: IndustryTemplate = {
  id: 'real_estate',
  name: 'Үл хөдлөх хөрөнгө',
  icon: '🏠',
  accentColor: '#10b981',
  category: 'product',
  categories: ['Орон сууц', 'Газар', 'Оффис', 'Түрээс', 'Хашаа байшин'],
  chatbotSettings: {
    welcome_message: 'Сайн байна уу! Манай агентлагийн цахим туслахад тавтай морил. Орон сууц, газар, түрээсийн мэдээлэл авна уу! 🏠',
    away_message: 'Ажлын бус цагт холбогдож байна. Даваа-Баасан 09:00-18:00 цагт үйлчилнэ.',
    quick_replies: ['Орон сууц хайх', 'Газрын зар', 'Түрээсийн зар', 'Зээлийн зөвлөгөө', 'Агенттай холбогдох'],
    tone: 'professional',
    language: 'mongolian',
    show_product_prices: true,
    max_product_results: 5,
    auto_handoff: true,
    handoff_keywords: 'агент, менежер, хүн, оператор, гомдол',
    accent_color: '#10b981',
    return_policy: '',
  },
  sampleProducts: [
    { name: '2 өрөө орон сууц (Баянгол)', description: '2 өрөө, 55м², 12-р давхар, шинэ засалтай', category: 'Орон сууц', base_price: 95000000, search_aliases: ['2 өрөө', 'орон сууц', 'баянгол'] },
    { name: '3 өрөө орон сууц (Сүхбаатар)', description: '3 өрөө, 85м², 7-р давхар, төв байршилтай', category: 'Орон сууц', base_price: 180000000, search_aliases: ['3 өрөө', 'сухбаатар'] },
    { name: 'Газар (Налайх)', description: '700м² газар, гэр хорооллын бүсэд', category: 'Газар', base_price: 45000000, search_aliases: ['газар', 'налайх'] },
    { name: 'Оффис (Чингэлтэй)', description: '120м² оффис, анхан давхарт, зогсоолтой', category: 'Оффис', base_price: 250000000, search_aliases: ['оффис', 'чингэлтэй'] },
    { name: '1 өрөө түрээс (ХУД)', description: '1 өрөө, 35м², тавилга бүрэн', category: 'Түрээс', base_price: 650000, ai_context: 'Сарын түрээс. Барьцаа: 2 сарын түрээс', search_aliases: ['түрээс', '1 өрөө'] },
    { name: '2 өрөө түрээс (БЗД)', description: '2 өрөө, 60м², шинэ засалтай', category: 'Түрээс', base_price: 1200000, ai_context: 'Сарын түрээс. Барьцаа: 2 сарын түрээс', search_aliases: ['түрээс', '2 өрөө'] },
  ],
  sampleQuestions: [
    { question: 'Орон сууцны үнэ', answer: '2 өрөө: 85-120 сая₮. 3 өрөө: 150-250 сая₮. Байршил, давхраас хамаарна.' },
    { question: 'Зээлийн нөхцөл', answer: 'Банкны зээл: Жилийн 8-12%. Хугацаа: 20-30 жил. Урьдчилгаа: 20-30%. Бид зээлийн зөвлөгөө үнэгүй өгнө.' },
    { question: 'Түрээсийн зар', answer: '1 өрөө: 600,000-800,000₮/сар. 2 өрөө: 900,000-1,500,000₮/сар. Барьцаа: 2 сарын түрээс.' },
    { question: 'Агенттай уулзах', answer: 'Утасны дугаараа үлдээвэл бид тантай холбогдоно. Эсвэл манай оффист ирж болно: Даваа-Баасан 09:00-18:00.' },
  ],
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  restaurant,
  hospital,
  beautySalon,
  coffeeShop,
  fitness,
  education,
  dentalClinic,
  realEstate,
  ...EXTRA_TEMPLATES,
]

export function getTemplate(businessType: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find(t => t.id === businessType)
}

export function getAllTemplates(): IndustryTemplate[] {
  return INDUSTRY_TEMPLATES
}
