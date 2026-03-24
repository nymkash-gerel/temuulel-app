/**
 * Full store setup — adds all settings needed for the AI chat agent to use
 * real data instead of hallucinating.
 */
import { config } from 'dotenv'
config({ path: '.env.production.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
const sb = createClient(url, key)

const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166'

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  Монгол Маркет — Full Store Setup')
  console.log('═══════════════════════════════════════\n')

  // 1. Store info
  console.log('1. Store info...')
  const { error: storeErr } = await sb.from('stores').update({
    address: 'Зөвхөн хүргэлтээр бараа гарна. Очиж авах боломжгүй.',
    phone: '77010001',
    email: 'info@mongolmarket.mn',
    shipping_settings: {
      delivery_enabled: true,
      inner_city: {
        enabled: true,
        price: 5000,
        districts: ['Баянгол', 'Сүхбаатар', 'Чингэлтэй', 'Хан-Уул', 'Баянзүрх', 'Сонгинохайрхан'],
      },
      outer_city: {
        enabled: true,
        price: 8000,
        districts: ['Налайх', 'Багануур', 'Багахангай'],
      },
      intercity: {
        enabled: true,
        price: 0,
        note: 'Орон нутгийн тээврийн зардлыг захиалагч хариуцна',
      },
      free_shipping_minimum: 100000,
      estimated_delivery: {
        inner_city: '24-48 цаг',
        outer_city: '2-3 ажлын өдөр',
        intercity: '3-7 ажлын өдөр',
      },
    },
    payment_settings: {
      cod_enabled: true,
      bank_transfer_enabled: true,
      bank_name: 'Хаан банк',
      bank_account: '5022000123',
      bank_holder: 'Монгол Маркет ХХК',
      qpay_enabled: false,
    },
    chatbot_settings: {
      tone: 'friendly_professional',
      language: 'mn',
      custom_instructions: 'Та "Монгол Маркет" дэлгүүрийн туслах. Монгол хэлээр хариулна. Найрсаг, мэргэжлийн байдлаар хариулна. Үргэлж үнийг ₮-тэй бич.',
      return_policy: 'Бараа хүлээн авснаас хойш 14 хоногт буцаах боломжтой. Шошго, баглаа боодол бүрэн байх ёстой. Буцаалтын хураамж 5,000₮.',
      max_products: 5,
      escalation_threshold: 60,
      social_links: {
        facebook: 'https://facebook.com/mongolmarket',
        instagram: 'https://instagram.com/mongolmarket',
        website: 'https://mongolmarket.mn',
      },
    },
  }).eq('id', STORE_ID)
  console.log(storeErr ? `  🔴 ${storeErr.message}` : '  ✅ Store info updated')

  // 2. Product details — add fit_note, ai_context, product_faqs to each product
  console.log('\n2. Product details...')

  const productUpdates = [
    {
      name: 'Кашемир цамц',
      description: 'Монгол кашемир, эрэгтэй/эмэгтэй. 100% ноолуур, хуурай цэвэрлэгээнд өгнө.',
      ai_context: 'Монголын дээд зэрэглэлийн 100% ноолуур. Зөөлөн, дулаан, хөнгөн. Хуурай цэвэрлэгээнд өгөх шаардлагатай. Бэлэгт тохиромжтой.',
      product_faqs: {
        'Материал юу вэ?': '100% Монгол ноолуур (кашемир)',
        'Яаж угаах вэ?': 'Хуурай цэвэрлэгээнд өгнө. Гараар угааж болохгүй.',
        'Хэмжээний зөвлөмж': 'S: 45-55кг, M: 55-65кг. Жин өндрөөс чухал.',
      },
    },
    {
      name: 'Гэрийн чимэглэл',
      description: 'Зурагтын тавиур — модон ханын тавиур, 3 тавцантай, орчин үеийн загвар. 55 инчийн телевиз тавихад тохиромжтой.',
      ai_context: 'Модон тавиур, 3 тавцантай. Өргөн 120см, Өндөр 45см, Гүн 35см. 55 инч хүртэлх телевизэнд тохирно. Угсрах заавар дагалдана.',
      product_faqs: {
        'Хэмжээ ямар вэ?': 'Өргөн 120см, Өндөр 45см, Гүн 35см',
        'Хэдэн инчийн ТВ тавих вэ?': '55 инч хүртэлх телевиз тавихад тохиромжтой',
        'Угсрах уу?': 'Тийм, угсрах заавар болон шурагтай ирнэ',
      },
    },
    {
      name: 'Нүүрний тос',
      description: 'Витамин C нүүрний тос — арьсыг гэрэлтүүлэх, чийгшүүлэх. Бүх төрлийн арьсанд тохиромжтой.',
      ai_context: 'Витамин C сыворотка. Арьсыг гэрэлтүүлж, толбыг бүдгэрүүлнэ. Өдөр бүр өглөө, орой хэрэглэнэ. Нарнаас хамгаалах тос хамт хэрэглэвэл илүү үр дүнтэй.',
      product_faqs: {
        'Ямар арьсанд тохирох вэ?': 'Бүх төрлийн арьсанд тохирно. Мэдрэг арьстай бол эхлээд бага хэмжээгээр турших',
        'Хэрхэн хэрэглэх вэ?': 'Өглөө, орой нүүр угаасны дараа 2-3 дусал түрхэнэ',
      },
    },
    {
      name: 'Ухаалаг цаг',
      description: 'Фитнесс трекер, зүрхний цохилт, GPS, алхам тоологч, унтлагын мониторинг.',
      ai_context: 'Ухаалаг цаг — GPS, зүрхний цохилт хэмжигч, алхам тоологч, унтлагын мониторинг. Усны хамгаалалт IP68. Батерей 7 хоног тэсвэрлэнэ. iOS/Android дэмждэг.',
      product_faqs: {
        'Батерей хэр удаан тэсвэрлэх вэ?': '7 хоног хүртэл тэсвэрлэнэ',
        'Усанд ордог уу?': 'IP68 усны хамгаалалттай. Шүршүүрт ордог, усанд шумбаж болохгүй',
        'Ямар утастай ажилладаг вэ?': 'iPhone болон Android аль аль нь дэмжинэ',
      },
    },
    {
      name: 'Хүүхдийн тоглоом',
      description: 'Лего загварын угсрах тоглоом — 500+ хэсэгтэй, 6+ насны хүүхдэд зориулсан.',
      ai_context: 'Лего загварын тоглоом. 500+ эд ангитай. 6 наснаас дээш хүүхдэд тохиромжтой. Бүтээлч сэтгэлгээ хөгжүүлнэ. Угсрах заавар дагалдана.',
      product_faqs: {
        'Хэдэн насныханд зориулсан вэ?': '6 наснаас дээш хүүхдэд тохиромжтой',
        'Хэдэн хэсэгтэй вэ?': '500+ эд ангитай',
      },
    },
  ]

  for (const update of productUpdates) {
    const { error } = await sb.from('products')
      .update({
        description: update.description,
        ai_context: update.ai_context,
        product_faqs: update.product_faqs,
      })
      .eq('store_id', STORE_ID)
      .ilike('name', `%${update.name}%`)
    console.log(error ? `  🔴 ${update.name}: ${error.message}` : `  ✅ ${update.name}`)
  }

  // 3. Verify
  console.log('\n3. Verification...')
  const { data: store } = await sb.from('stores')
    .select('name, address, phone, email, shipping_settings, payment_settings, chatbot_settings')
    .eq('id', STORE_ID)
    .single()

  console.log(`  Store: ${store?.name}`)
  console.log(`  Address: ${store?.address}`)
  console.log(`  Phone: ${store?.phone}`)
  console.log(`  Email: ${store?.email}`)
  console.log(`  Shipping fee: ${(store?.shipping_settings as any)?.inner_city?.price}₮`)
  console.log(`  Free shipping: ${(store?.shipping_settings as any)?.free_shipping_minimum}₮+`)
  console.log(`  Return policy: ${(store?.chatbot_settings as any)?.return_policy?.substring(0, 50)}...`)
  console.log(`  Social: ${JSON.stringify((store?.chatbot_settings as any)?.social_links)}`)

  const { data: products } = await sb.from('products')
    .select('name, ai_context, product_faqs')
    .eq('store_id', STORE_ID)
    .not('ai_context', 'is', null)

  console.log(`\n  Products with AI context: ${products?.length || 0}`)
  products?.forEach(p => {
    const faqCount = p.product_faqs ? Object.keys(p.product_faqs).length : 0
    console.log(`    • ${p.name} — ${faqCount} FAQs, AI context: ${p.ai_context?.substring(0, 40)}...`)
  })

  console.log('\n═══════════════════════════════════════')
  console.log('  Setup complete!')
  console.log('═══════════════════════════════════════')
}

main().catch(console.error)
