import { config } from 'dotenv'
config({ path: '.env.production.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
const sb = createClient(url, key)

async function main() {
  const storeId = '236636f3-0a44-4f04-aba1-312e00d03166'

  const { error } = await sb.from('stores').update({
    address: 'Зөвхөн хүргэлтээр бараа гарна. Очиж авах боломжгүй.',
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
  }).eq('id', storeId)

  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log('✅ Store settings updated:')
    console.log('  Address: Зөвхөн хүргэлтээр (delivery only)')
    console.log('  Inner city: 5,000₮')
    console.log('  Outer city: 8,000₮')
    console.log('  Intercity: 0₮ (customer pays transport)')
    console.log('  Free shipping: 100,000₮+')
  }
}
main()
