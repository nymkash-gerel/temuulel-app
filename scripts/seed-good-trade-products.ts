/**
 * Seeds 10 test products into the Good Trade (Монгол Маркет) store.
 * Products are taken from the operational test JSON.
 *
 * Usage: npx tsx scripts/seed-good-trade-products.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// Use env vars, falling back to local Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Local Supabase secret key (from `supabase status`)
  process.env.SUPABASE_SECRET_KEY!

const STORE_ID = 'ad22870d-dfa8-461b-9925-306643d6c1dc' // Good Trade

const products = [
  {
    name: 'TV тавиур',
    description: 'Орчин үеийн загвартай TV тавиур. Өргөн 120см, Өндөр 45см, Гүн 35см. 55 инчийн телевиз тавихад тохиромжтой.',
    base_price: 55000,
    category: 'Тавилга',
    status: 'active',
    stock_quantity: 15,
    ai_context: 'Хэмжээ: Өргөн 120см, Өндөр 45см, Гүн 35см. 55 инч хүртэлх TV-д тохиромжтой.',
  },
  {
    name: 'Кашемир цамц',
    description: '100% цэвэр кашемир. Монголын уламжлалт арга технологиор нэхсэн дулаан, зөөлөн цамц.',
    base_price: 189000,
    category: 'Хувцас',
    status: 'active',
    stock_quantity: 30,
    ai_context: 'Өнгө: Хар, Цагаан, Саарал, Бор. Размер: M, L, XL, 2XL байна.',
  },
  {
    name: 'USB-C цэнэглэгч 65W',
    description: '65W хурдан цэнэглэгч. MacBook, iPhone, iPad болон бүх USB-C төхөөрөмжид тохирно.',
    base_price: 45000,
    category: 'Электроник',
    status: 'active',
    stock_quantity: 50,
    ai_context: 'Apple MacBook, Samsung болон бүх USB-C төхөөрөмжтэй нийцтэй.',
  },
  {
    name: 'Витамин C нүүрний тос',
    description: 'Арьсыг гэрэлтүүлж, нөхцлийг сайжруулдаг Витамин C-тэй нүүрний тос. Бүх арьсны төрөлд тохиромжтой.',
    base_price: 28000,
    category: 'Гоо сайхан',
    status: 'active',
    stock_quantity: 40,
    ai_context: 'Цагаан өнгийн саван тунгалаг шингэн. Өглөө оройн арчилгаанд хэрэглэнэ.',
  },
  {
    name: 'Ноосон малгай',
    description: '100% монгол ноосон дулаан малгай. Өвлийн улиралд тохиромжтой.',
    base_price: 35000,
    category: 'Дагалдах хэрэгсэл',
    status: 'active',
    stock_quantity: 60,
    ai_context: 'Нэг хэмжээ бүгдэд тохирно. Өнгө: Хар, Хүрэн, Саарал, Цэнхэр.',
  },
  {
    name: 'Lego тоглоом',
    description: '6-8 насны хүүхдэд тохирсон Lego бүтээц. Хөвцөс заавартай.',
    base_price: 42000,
    category: 'Тоглоом',
    status: 'active',
    stock_quantity: 25,
    ai_context: '6-8 насны хүүхдэд. Монгол Англи хэлний хөвцөс заавартай.',
  },
  {
    name: 'Bluetooth чихэвч',
    description: 'Өндөр чанарын дуу чимэглэлтэй Bluetooth чихэвч. 30 цагийн батарей.',
    base_price: 85000,
    category: 'Электроник',
    status: 'active',
    stock_quantity: 20,
    ai_context: '30 цагийн батарей. Дуугаснаас хамгаалах функцтэй. Хар, Цагаан өнгөтэй.',
  },
  {
    name: 'Smartwatch',
    description: 'Ухаалаг цаг. Алхалт, зүрхний цохилт, нойрны хяналт. iOS болон Android-тэй нийцтэй.',
    base_price: 125000,
    category: 'Электроник',
    status: 'active',
    stock_quantity: 10,
    ai_context: 'iOS (iPhone 6+), Android (5.0+)-тэй нийцтэй. Батарей 7 хоног. Хар, Мөнгөн өнгөтэй.',
  },
  {
    name: 'Шампунь + Кондишнер багц',
    description: 'Байгалийн найрлагатай шампунь ба кондишнерийн хос багц. Бүх үстэй тохиромжтой.',
    base_price: 32000,
    category: 'Гоо сайхан',
    status: 'active',
    stock_quantity: 80,
    ai_context: '3 ба түүнээс дээш багц авбал хүргэлт үнэгүй.',
  },
  {
    name: 'Арьсан цүнх',
    description: '100% жинхэнэ арьсан цүнх. Том хэмжээ. Өргөн 35см, Өндөр 28см, Гүн 12см.',
    base_price: 120000,
    category: 'Дагалдах хэрэгсэл',
    status: 'active',
    stock_quantity: 8,
    ai_context: 'Хэмжээ: Өргөн 35см, Өндөр 28см, Гүн 12см. Өнгө: Хар, Бор, Улаан. Хүргэлт үнэгүй.',
  },
]

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Check current product count
  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', STORE_ID)

  console.log(`Current products in Good Trade: ${count}`)

  if ((count ?? 0) > 0) {
    console.log('⚠️  Products already exist. Skipping seed.')
    console.log('   To re-seed: delete products from dashboard first.')
    process.exit(0)
  }

  console.log(`Seeding ${products.length} products...`)

  for (const product of products) {
    const { data, error } = await supabase
      .from('products')
      .insert({
        store_id: STORE_ID,
        name: product.name,
        description: `${product.description} ${product.ai_context}`,
        base_price: product.base_price,
        category: product.category,
        status: product.status,
        sales_script: product.ai_context,
        sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      })
      .select('id, name')
      .single()

    if (error) {
      console.error(`  ❌ ${product.name}:`, error.message)
    } else {
      console.log(`  ✅ ${data.name} (${data.id})`)
    }
  }

  const { count: newCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', STORE_ID)

  console.log(`\nDone. Total products: ${newCount}`)
  console.log('Test your chatbot with: "цүнх байгаа уу", "smartwatch авмаар байна", etc.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
