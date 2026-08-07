/**
 * Single source of truth for the business types a new store can register as.
 *
 * Every `type` here must exist as a key in `DEFAULT_MODULES` (src/lib/features.ts)
 * so the dashboard nav resolves correctly. Used by the signup flow and the
 * onboarding wizard — keep those in sync by importing from here, not by
 * hard-coding a second list (that divergence is exactly what left `cafe`,
 * `services`, `guesthouse`, `clinic`, `training_center` unregisterable before).
 */
export interface BusinessTypeOption {
  type: string
  icon: string
  label: string
  desc: string
}

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { type: 'ecommerce', icon: '🛍️', label: 'Худалдаа', desc: 'Хувцас, бараа, онлайн' },
  { type: 'retail', icon: '🏪', label: 'Жижиглэн', desc: 'POS, агуулах, нөөц' },
  { type: 'restaurant', icon: '🍽️', label: 'Ресторан', desc: 'Хоол, ундаа, захиалга' },
  { type: 'coffee_shop', icon: '☕', label: 'Кофе шоп', desc: 'Кофе, ундаа, амттан' },
  { type: 'cafe', icon: '🍰', label: 'Кафе', desc: 'Кафе, амттан, ундаа' },
  { type: 'beauty_salon', icon: '💅', label: 'Гоо сайхан', desc: 'Үсчин, маникюр, спа' },
  { type: 'wellness', icon: '🧘', label: 'Wellness', desc: 'Йога, пилатес, массаж' },
  { type: 'fitness', icon: '🏃', label: 'Фитнесс', desc: 'Дасгал, хичээл, гишүүнчлэл' },
  { type: 'gym', icon: '💪', label: 'Спорт заал', desc: 'Танхим, тоног төхөөрөмж' },
  { type: 'hospital', icon: '🏥', label: 'Эмнэлэг', desc: 'Үзлэг, оношилгоо, эм' },
  { type: 'clinic', icon: '🩺', label: 'Клиник', desc: 'Үзлэг, эмчилгээ' },
  { type: 'dental_clinic', icon: '🦷', label: 'Шүдний эмнэлэг', desc: 'Шүдний эмчилгээ' },
  { type: 'pet_services', icon: '🐾', label: 'Тэжээвэр амьтан', desc: 'Арчилгаа, эмнэлэг' },
  { type: 'education', icon: '📚', label: 'Боловсрол', desc: 'Хичээл, сургалт, курс' },
  { type: 'training_center', icon: '🎓', label: 'Сургалтын төв', desc: 'Курс, хөтөлбөр, дадлага' },
  { type: 'hotel', icon: '🏨', label: 'Зочид буудал', desc: 'Өрөө, захиалга' },
  { type: 'guesthouse', icon: '🛏️', label: 'Зочны байр', desc: 'Гэр байр, амралт' },
  { type: 'camping_guesthouse', icon: '🏕️', label: 'Жуулчны бааз', desc: 'Байр, амралт' },
  { type: 'real_estate', icon: '🏠', label: 'Үл хөдлөх', desc: 'Орон сууц, газар' },
  { type: 'laundry', icon: '👔', label: 'Хими цэвэрлэгээ', desc: 'Угаалга, индүүдэх' },
  { type: 'car_wash', icon: '🚗', label: 'Авто угаалга', desc: 'Угаалга, арчилгаа' },
  { type: 'repair_shop', icon: '🔧', label: 'Авто засвар', desc: 'Засвар, оношилгоо' },
  { type: 'photography', icon: '📷', label: 'Гэрэл зураг', desc: 'Зураг авалт, студи' },
  { type: 'venue', icon: '🎪', label: 'Арга хэмжээ', desc: 'Заал, банкет, тоглолт' },
  { type: 'coworking', icon: '💻', label: 'Коворкинг', desc: 'Хамтын оффис, ширээ' },
  { type: 'legal', icon: '⚖️', label: 'Хууль зүй', desc: 'Өмгөөлөл, зөвлөгөө' },
  { type: 'construction', icon: '🏗️', label: 'Барилга', desc: 'Төсөл, материал, баг' },
  { type: 'subscription', icon: '📦', label: 'Захиалга бокс', desc: 'Сарын захиалга' },
  { type: 'consulting', icon: '💼', label: 'Зөвлөх', desc: 'Бизнес, санхүү, IT' },
  { type: 'services', icon: '🛠️', label: 'Үйлчилгээ', desc: 'Ерөнхий үйлчилгээ, цаг захиалга' },
  { type: 'home_services', icon: '🏡', label: 'Гэрийн үйлчилгээ', desc: 'Цэвэрлэгээ, засвар' },
  { type: 'logistics', icon: '🚚', label: 'Логистик', desc: 'Ачаа тээвэр, хүргэлт' },
]
