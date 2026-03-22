/**
 * Intent classification for Mongolian customer messages.
 * Keyword-based classification with exact, vowel-neutral, and prefix matching.
 */

import { normalizeText, neutralizeVowels } from './text-normalizer'
import { stemText, stemKeyword } from './mn-stemmer'
// Note: trie-based optimization explored but padded.includes() approach needed
// for substring matching behavior. Current perf is <1ms per classification.

// ---------------------------------------------------------------------------
// Keyword lists
// ---------------------------------------------------------------------------

/**
 * Keyword lists with aliases: misspellings, slang, informal forms, and
 * transliterated variants that Mongolian customers commonly use.
 */
const INTENT_KEYWORDS: Record<string, string[]> = {
  product_search: [
    // Core
    'бүтээгдэхүүн', 'бараа', 'ямар', 'хувцас', 'гутал', 'цүнх',
    'пүүз', 'аксессуар', 'хайх', 'харуулна уу',
    'үнэ', 'үнэтэй', 'хямд', 'шинэ', 'сонирхож', 'авмаар', 'худалдаж',
    'зарна', 'зарах', 'категори', 'төрөл',
    // Product category names (common search terms)
    'цамц', 'даашинз', 'өмд', 'куртка', 'пальто', 'хүрэм', 'дээл',
    'малгай', 'кашемир', 'ноолуур', 'ноолууран',
    'оймс', 'бээлий', 'ороолт', 'цүнхний',
    // Common product terms from real conversations
    // (stemmer handles: загварууд→загвар, өнгөтэй→өнгө, боолтууд→боолт)
    'загвар', 'өнгө', 'өнгөөр',
    'тирко', 'турсик', 'леевчик', 'боолт',
    'бензэн', 'комд', 'дотортой', 'шилэн', 'гуятай', 'гуягүй',
    // English
    'product', 'products', 'item', 'buy', 'purchase', 'shop', 'catalog',
    'price', 'cheap', 'expensive', 'new arrival', 'show me', 'browse',
    'search', 'find', 'looking for', 'want to buy', 'how much',
    'available', 'in stock',
    // English product names (also triggers product_search intent)
    'cashmere', 'shirt', 'hat', 'bag', 'shoes', 'pants', 'jacket',
    'coat', 'watch', 'earphone', 'headphone', 'charger', 'toy', 'lego',
    'shampoo', 'cream',
    // Aliases — misspellings, informal, transliterated
    'бутээгдэхүүн', 'бутээгдхүүн', 'бүтээгдхүүн',
    'барааа', 'бараагаа',
    'хувцаас', 'хувцс',
    'гуталаа', 'гутлаа',
    // stemmer handles: цүнхээ→цүнх, пүүзээ→пүүз
    'цунх',
    'пууз',
    'аксесуар', 'аксесор',
    // stemmer handles: үнээ→үнэ, хямдралтай→хямдрал
    'унэ', 'унэтэй',
    'хямдхан', 'хямдрал', 'хямдарсан', 'үнэгүй',
    'шинэхэн', 'шинээр',
    'авах', 'авъя', 'авья', 'авмааар',
    'хайж', 'хайна', 'хайлт',
    // stemmer handles: үзүүлээд→үзүүл
    'харуул', 'үзүүл', 'үзүүлнэ үү',
    'каталог', 'жагсаалт',
    // Interest/desire expressions (stemmer handles: сонирхоод→сонирх, сонирхож→сонирхо)
    'сонирхож', 'сонирхох', 'сонирхи', 'сонирх',
    // Purchase intent (from real FB conversations)
    'авий', 'авии', 'ави', 'авья',
    'авбал', 'авлаа', 'авсан',
    'захиалъя', 'захиалья', 'захиалах', 'захиалая',
    // Availability check (very common in FB Messenger)
    // ('авч болох' removed — overlaps with "зээлээр авч болох уу" = payment intent)
    'байгаа юу', 'бий юу', 'бга юу', 'бгаа юу',
    'байна уу', 'болох уу',
    // Short forms from Latin typing
    'бга ю', 'бгаа', 'бга', 'бий', 'плаж',
    // Price inquiry (common in product search context)
    'хэд', 'хэдээр',
    // NOTE: 'хд' removed — 2-char substring fires inside 'худалдаж', 'ахдаа', etc.
    // 'хэд' (line above) already handles "how much?" queries.
    // Latin aliases for product category names
    'умд', 'цамц',
    // Image/photo requests (stemmer handles: зургийг/зургыг→зург, зурагтай→зураг, үзүүлээд→үзүүл)
    // 'зургиин' added: Latin 'ii'→'ии' doesn't normalize to 'ий', so "zurgiin"→"зургиин" won't stem to "зург"
    'зураг', 'зургаа', 'фото', 'зургиин',
    'photo', 'picture', 'pic', 'image', 'show photo', 'show picture',
    'үзүүлээч', 'харуулаач', 'харуулаад',
    // Product composition/material questions (common in clothing/textile stores)
    'материал', 'даавуу', 'бүтэц',
    // Product selection/option queries (beats menu_availability's 'сонголт' compound prefix match)
    'сонголт',
    // Inventory status — "is it sold out?" (applies to products, not just menu items)
    'дууссан', 'дуусав', 'дуусчихсан',
    // Questions without proper grammar particles (informal)
    'үнэ хэд', 'байгаа',
    // Latin transliterations (common in Messenger)
    'tsunx', 'tsunh', 'puuz', 'hamt', 'hemjee', 'ongo', 'tsagaan',
    'baraa', 'bga uu', 'bga yum', 'bgaa', 'bii uu', 'bn uu',
    'haruulna uu', 'haruu', 'uzuul', 'shine baraa',
    'hed turgurug', 'hed', 'une', 'yamr',
  ],
  order_status: [
    // Core
    'захиалга', 'хаана', 'илгээсэн', 'явсан',
    'статус', 'трэк', 'дугаар', 'хэзээ', 'захиалсан', 'хүлээж',
    // English
    'order', 'order status', 'tracking', 'track', 'where is', 'shipped',
    'delivery status', 'when will', 'my order', 'order number',
    // Aliases (stemmer handles: захиалгаа→захиалг, дугаараа/дугаарыг→дугаар, хүлээсэн→хүлээ)
    'захялга', 'захиалг', 'захиалаа',
    'ирэхүү', 'ирэх үү', 'ирэхгүй',
    'илгээсэнүү', 'явуулсан',
    'трэкинг',
    'хүлээлгэ',
    'шалгах', 'шалгана', 'шалгамаар',
    'хэзээ ирэх',
    // Time-based arrival phrases (order tracking, not generic shipping)
    'маргааш ирэх', 'өглөө ирэх', 'өнөөдөр ирэх', 'орой ирэх',
    // Ready/completion status
    'бэлэн болох', 'бэлэн болно', 'бэлэн болсон',
    // Elapsed time complaints — "X hours/days have passed, where is my order?"
    'цаг боллоо', 'өдөр боллоо', 'хоног боллоо',
    'цаг болж', 'өдөр болж', 'хоног болж',
    // Latin transliterations for order status queries (e.g. "minii zahialga yamar baina")
    'zahialga', 'zahialgaa', 'zahialgiin', 'minii zahialga',
  ],
  greeting: [
    // Core
    'сайн байна', 'сайн уу', 'байна уу', 'сайхан',
    'өглөөний мэнд', 'мэнд',
    // English
    'hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings',
    // Aliases
    'сайн бн', 'сн бн уу', 'сайн бна', 'сайнуу', 'сайн уу',
    'юу байна', 'сонин юу байна',
    // stemmer handles: мэндээ→мэнд
    'мэнд хүргэе',
    'амар', 'амрагтай',
    'оройн мэнд',
    // Slang/abbreviations (from real FB Messenger conversations)
    'бнау', 'бна уу', 'сбну', 'сайн уу',
    'сн бну', 'сн бнуу', 'сн бн',
    'сайнбну', 'сайнбнуу', 'сн уу',
    // Latin transliterations (common in Messenger)
    'sain bn uu', 'sain uu', 'sbnuu', 'sn bn uu',
    'sn uu', 'bn', 'bna uu', 'bnuu',
    'sain bna uu', 'sainuu',
  ],
  thanks: [
    // Core
    'баярлалаа', 'гайхалтай', 'сайхан', 'маш сайн', 'рахмат', 'харин',
    // English
    'thanks', 'thank', 'thank you', 'appreciate', 'great', 'awesome',
    'perfect', 'wonderful',
    // Aliases (stemmer handles: баярласан→баярла, баярлсан/баярлж→баярл, баяртай→баяр)
    'баярлаа', 'баярлж',
    'гоё', 'гое', 'гое байна',
    'сайн байна лээ', 'зүгээр', 'за',
    'маш гоё', 'маш зөв',
    'рахмэт',
    'мерси',
  ],
  complaint: [
    // Core — negative sentiment (return keywords moved to return_exchange)
    'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа', 'сэтгэл ханамжгүй',
    'чанар',
    // English
    'complaint', 'problem', 'issue', 'broken', 'damaged', 'defective',
    'wrong', 'bad', 'terrible',
    'not working', 'disappointed', 'unhappy', 'angry',
    // Aliases (stemmer handles: гомдолтой→гомдол, асуудалтай→асуудал, буруутай→буруу, алдаатай→алдаа)
    'гомдоллох', 'гомдоол',
    'асуудал гарсан', 'проблем',
    'муухай', 'маш муу', 'хэрэггүй',
    'буруугаар',
    'чанаргүй', 'чанар муу',
    'эвдэрсэн', 'гэмтсэн', 'гэмтэл',
    'уурласан', 'бухимдсан',
    'хариуцлага', 'хариуцлагагүй',
    // Money refund complaints (strong complaint signal)
    'мөнгө буцаах', 'мөнгөө буцааж өг', 'мөнгө буцаа',
    // Latin transliterations (common in Messenger complaints)
    'yaagaad', 'yaagad', 'yagaad',
    'mongoo butaaj ug', 'mongoo butaaj', 'mongoo butaa', 'mungu butaaj',
    'muu uilchilgee', 'muu uilchilge', 'muuhay',
    'zahirlaa duudaach', 'zahirlaa duu', 'zahiral hun',
    'hun heregteii', 'hun heregteй', 'operator heregteii',
    'operator duu', 'operator duudaach',
    'udaan bgan', 'udaan baina', 'udaan yum',
    'yariltsah', 'yariltsya', 'yarilts',
    // Human agent requests (Cyrillic) — customer wants to speak to a real person
    'хүнтэй ярих', 'хүн дуудах', 'хүн хэрэгтэй', 'хүнтэй холбогдох',
    'амьд хүн', 'оператор дуудах', 'менежер дуудах', 'менежер хэрэгтэй',
    'ярих уу', 'яриад болох уу', 'хүнтэй харилцах',
    // Non-delivery complaints — Latin transliterations
    'irehgui', 'ireegui', 'ireedgui',
    'baraa irehgui', 'baraa ireegui',
  ],
  return_exchange: [
    // Core — return/exchange policy questions (moved from complaint)
    'буцаах', 'буцаалт', 'солих', 'солилт', 'солиулах',
    // stemmer handles: буцааж→буцаа, буцаагдсан→буцаа, буцаалтын→буцаалт, солилтын→солилт, солиулж→солиул
    'буцаан', 'буцаагдах', 'буцааж',
    'солиулж', 'солилцох', 'солицох',
    // Return-specific nouns
    'хураамж',
    // Policy-specific phrases
    'буцаах бодлого', 'буцаах нөхцөл', 'буцаалтын нөхцөл',
    'солих боломж', 'буцаах боломж',
    // Fit/size mismatch (common return reason)
    'тохирохгүй', 'тохиргүй', 'тааруухгүй', 'таарахгүй',
    'өөр хэмжээ', 'өөр өнгө', 'өөрчлөх',
    'багтахгүй',  // "doesn't fit" — specific return signal (unlike 'том'/'жижиг' which are size_info)
    'хэмжээ буруу', 'өнгө буруу', 'загвар буруу',
    // English
    'return', 'return policy', 'exchange', 'refund',
    'can i return', 'exchange policy', 'swap',
    'want to exchange', 'want to return', 'wrong size', 'doesnt fit',
    // Informal/aliases (stemmer handles: буцааx→буцаах, солиулаx→солиулах)
    'буцааж болох', 'солиулж болох', 'буцаалт хийх',
    'буцааж өгөх', 'солиулж өгөх',
    'солиулмаар', 'солихыг хүсч', 'буцаахыг хүсч',
    // Latin transliteration
    'butsaah', 'butsaalt', 'butsaa', 'butaah', 'butaa', 'butay',
    // "butsay" → normalizeText → "буцай" (ts→ц digraph, y→й): colloquial imperative "return it!"
    // e.g. "bara butsay" = "baraa butsaah" = "return the product"
    'буцай', 'буцаж', 'буцааж',
    // Latin: keep "butsay" raw so it also matches if normalization doesn't run
    'butsay',
    // Cyrillic forms of Latin misspellings (normalizer converts Latin→Cyrillic)
    'бутай', 'бутаах', 'бутаа',
    // Cyrillic misspellings (common typos)
    'бутаах', 'бутай өг', 'солулж болох уу', 'тохирхгүй', 'хэмжэ том',
    // Latin transliterations for size/fit issues
    'hemjee tohirohgui', 'tohirohgui', 'tohirhgui',
    'hemjee tom', 'hemjee jijig', 'tom baina', 'jijig bna',
    'soliulj boloh uu', 'soliulj', 'solih',
    'butsaah bolomj', 'butaaj ug', 'butaaj og',
  ],
  size_info: [
    // Core
    'размер', 'хэмжээ', 'size', 'том', 'жижиг', 'дунд',
    'xl', 'xxl',
    // English
    'size chart', 'size guide', 'what size', 'fit', 'measurement',
    'small', 'medium', 'large',
    // Aliases (stemmer handles: размераа/размерийн→размер, сайзаа→сайз, хэмжээний/хэмжээгээ→хэмжээ)
    // Keep хэмжээтэй — needs full-weight match to beat product_search's "ямар"
    'хэмжээтэй', 'сайз',
    'томхон', 'жижигхэн', 'дундаж',
    'тохирох', 'тохируулах',
    'урт', 'богино', 'өргөн', 'нарийн',
    // Body measurements
    'кг', 'см', 'kg', 'cm',
    // stemmer handles: жинтэй→жин, өндөртэй→өндөр
    'жин', 'өндөр',
    'биеийн', 'бие', 'али нь', 'алинийг',
    'тохирно', 'тохирох уу', 'таарах', 'таарна',
    // "тааруу" — sizing-specific form ("болох уу" removed — too generic, conflicts with payment/return)
    'тааруу',
    // Latin-typed (common FB Messenger abbreviations)
    'hemjee', 'razmer', 'saiz',
  ],
  payment: [
    // Core
    'төлбөр', 'төлөх', 'данс', 'шилжүүлэг', 'qpay', 'карт',
    'бэлэн', 'зээл', 'хуваах',
    // English
    'payment', 'pay', 'how to pay', 'bank transfer', 'card', 'cash',
    'installment', 'credit', 'invoice',
    // Aliases (stemmer handles: төлбөрөө→төлбөр, дансаар/дансруу→данс, картаар/картаа→карт, зээлээр→зээл)
    'төлье', 'төлъе', 'төлсөн',
    'данс руу',
    'шилжүүлэх', 'шилжүүлье', 'шилжүүлэг хийх', 'шилжүүлнэ',
    'бэлнээр', 'бэлэнээр', 'бэлэн мөнгө', 'кашаар',
    'хуваалаа', 'хуваа', 'хувааж', 'хуваан',
    'хэрхэн төлөх', 'яаж төлөх',
    'мөнгө', 'мөнгөө',
    // Installment specific
    'хуваан төлөх', 'хуваан төлж', 'хуваан төлбөр', 'хуваалттай',
    'хэсэгчилсэн', 'хэсэгчлэх', 'хэсэгчилж', 'хэсэгч төлбөр',
    // Mongolian payment methods
    'кюпэй', 'сошиал пэй', 'socialpay', 'монпэй', 'monpay',
    'хипэй', 'hipay', 'лэнд', 'лизинг',
    'сторпэй', 'storepay',
    'голомт', 'хаан', 'хас', 'тиби', 'state bank',
    // Payment method types
    'банкны карт', 'картаар', 'картаа', 'visa', 'mastercard',
    'дансаар', 'дансаа', 'банк шилжүүлэг',
    // Latin transliterations (common in Messenger)
    'huvaaan tuluh', 'huvaaan toloh', 'huvaan tuluh',
    'huvaj tolno', 'huvaj tuluh', 'huvaaj',
    'hesgchlen', 'hesgchilen', 'hesgch',
    'QPay-aar', 'QPay-eer', 'qpayaar',
    'belneer', 'belnaar', 'belen mungu',
  ],
  shipping: [
    // Core
    'хүргэлт', 'хүргэх', 'хаяг', 'хотод', 'хөдөө', 'шуудан',
    'унаа', 'өдөр', 'хоног', 'ирэх',
    // English
    'shipping', 'delivery', 'deliver', 'address', 'express',
    'how long', 'when arrive', 'ship to', 'courier',
    // Aliases (stemmer handles: хүргэлтийн→хүргэлт, хаягаа/хаягийн/хаягаар→хаяг)
    'хүргүүлэх', 'хүргээд', 'хүргэнэ үү',
    // stemmer handles: хөдөөрүү→хөдөө
    'хотруу', 'хот руу',
    'хөдөө рүү',
    'шууданаар',
    'хэдэн өдөр', 'хэдэн хоног',
    'хурдан', 'яаралтай хүргэлт',
    'өнөөдөр хүргэх', 'маргааш',
    // Delivery price / cost queries (compound keywords so shipping beats product_search's "үнэ")
    'хүргэлтийн үнэ', 'хүргэлт үнэ', 'хүргэлтийн зардал', 'хүргэлтийн хөлс',
    'хүргэлт хэд', 'хүргэлт хэдэн',
    'delivery cost', 'delivery fee', 'delivery price',
    // Latin transliterations (from real FB conversations)
    'хургелт', 'хургэлт',
    // хүргүүлэх verb forms (have it delivered) — Latin 'hurguul*' prefix-matches all typo variants
    // e.g. "hurguuleeed" → norm "хургуулееед" → prefixMatch with 'хургуул' → +0.5
    'хургуул', 'хургуулэх', 'хургуулнэ',
    // Delivery timing — "before X o'clock" (өнөөдөр 3 цагаас өмнө хүргэж болох уу)
    'цагаас өмнө', 'цагийн өмнө',
    // Mongolian geography-specific
    'аймаг', 'сум', 'дүүрэг', 'хороо', 'орон нутаг',
    'хан уул', 'баянгол', 'сүхбаатар', 'чингэлтэй', 'баянзүрх',
    'сонгинохайрхан', 'налайх', 'багануур',
    // Address structure (customer providing delivery address)
    'байр', 'баир', 'давхар', 'тоот', 'орц', 'хотхон', 'хороолол',
  ],
  // Restaurant-specific intents
  table_reservation: [
    // Core — compound/specific forms preferred to avoid generic false positives
    // ('захиал'/'захиалах' removed — too generic, order_collection handles e-commerce orders)
    // ('хүн'/'хүний' removed — too generic, 'хүнтэй ярих' in complaint covers human agent requests)
    // ('цаг' removed — too generic, "72 цаг боллоо" = "72 hours passed" ≠ reservation)
    // ('суудал' standalone removed — catches clothing/product "суудал авах" questions unrelated to tables)
    'ширээ', 'резерв', 'бронь',
    // ('орой'/'үдийн'/'оройн' standalone removed — delivery messages also say "орой хүргэнэ үү")
    // ('цагт' removed — "4n tsagt awtobus" bus schedule, not restaurant reservation)
    // ('өглөө' standalone removed — "өглөө 11 цагт ажилладаг уу" = business hours, not reservation)
    'зочин',
    'хоол', 'зоогийн',
    'өглөөний хоол',
    // Table-specific (compound forms only — 'сул'/'чөлөөтэй' standalone too generic)
    'байна уу', 'бий юу',
    'суух', 'суудлын',
    'сул ширээ', 'чөлөөтэй ширээ',
    // English
    'table', 'reservation', 'reserve', 'book', 'booking',
    'seat', 'seats', 'party', 'dinner', 'lunch',
    // Aliases — compound forms only (avoid false positives from prefix matching)
    'ширээний', 'ширээ авах', 'ширээ захиалах',
    'суудал авах', 'суудал захиалах',
    'резервлэх', 'броньлох',
    'орой хоол', 'үдийн хоол',
  ],
  allergen_info: [
    // Core allergens
    'харшил', 'харшлийн', 'аллерги', 'орц', 'найрлага',
    'глютен', 'глютенгүй', 'сүү', 'сүүний', 'самар',
    'самрын', 'өндөг', 'өндөгний', 'загас', 'далайн',
    // Dietary preferences
    'вега', 'веган', 'вегетари', 'халал', 'халяль',
    'цэвэр', 'органик',
    // Spicy level — 'халуун'/'ногоон' standalone removed (common in product descriptions: "халуун бараа", "ногоон цамц")
    'халуун чинжүү', 'халуунтай хоол', 'ногоон чинжүү', 'амт',
    // English
    'allergy', 'allergies', 'allergen', 'ingredient',
    'gluten', 'gluten-free', 'dairy', 'nuts', 'egg',
    'vegan', 'vegetarian', 'halal', 'spicy',
    // Aliases (stemmer handles: аллергитай→аллерги, харшилтай→харшил)
    'ямар орц', 'юу орсон', 'орц найрлага',
    'глютенгүй юу', 'сүү орсон уу',
  ],
  menu_availability: [
    // Core
    'цэс', 'меню', 'өнөөдрийн', 'бэлэн',
    'дууссан', 'үлдсэн', 'байна уу', 'идэж',
    // Food items
    'хоол', 'хоолны', 'уух', 'ундаа',
    // Availability check (restaurant-specific)
    // ('авч болох' moved to product_search — too generic, applies to any product not just menu)
    'байгаа юу', 'бий юу',
    // English
    // ('today' removed — "today ipeh bl uu" = delivery timing, not restaurant menu)
    'menu', 'available', 'sold out',
    'in stock', 'can order',
    // Aliases ('өнөөдөр' standalone removed — delivery timing also says "өнөөдөр"; 'одоо байгаа' removed — 'одоо' prefix-matches compound)
    'өнөөдрийн цэс', 'яг одоо',
    'хоол байна уу', 'ямар хоол', 'юу захиалах',
    'дуусчхсан уу', 'дуусав уу',
    // Selection/option queries — compound forms only ('сонголт' alone catches product color/size selections)
    'сонголт байна уу', 'сонголт бга уу', 'ямар сонголт',
    // Dietary/cuisine availability ('ногоон' removed — it's a product color in e-commerce)
    'цагаан хоол', 'мах багатай', 'загасны',
  ],
  order_collection: [
    // Core order keywords (moved from product_search for clearer intent separation)
    'захиалах', 'захиална', 'захиалъя', 'захиалья', 'захиалая',
    'захиалж', 'захиалаа', 'захиалсан', 'захиалмаар',
    // Purchase intent
    'авъя', 'авья', 'авий', 'авии', 'ави',
    'авна', 'авах', 'авмаар', 'авмааар', 'авбал', 'авлаа', 'авсан',
    'худалдаж ав', 'худалдаж авна', 'худалдаж авах',
    // English
    'order', 'place order', 'want to order', 'will order', 'lets order',
    'buy', 'purchase', 'will buy', 'want to buy',
    // Aliases
    'захялах', 'захялъя', 'захялна',
    // Common misspellings (Cyrillic)
    'захялна', 'захиалъя', 'худалж ав',
    // Informal verb forms (emphatic, definite future)
    'авчхна', 'захиалчихъя', 'захиалчихья', 'үзчихье', 'авъяа',
    // Latin transliterations (very common in Messenger)
    'zahialna', 'zahialu', 'zahialya', 'zahial',
    'avmaar', 'avya', 'avii', 'avi', 'avna', 'avah',
    'hudaldaj av', 'hudaldaj avna',
  ],
  gift_card_purchase: [
    // Compound phrases — high confidence (require "бэлгийн" genitive form, avoids false-matching bare "бэлэг")
    'бэлгийн карт авмаар', 'бэлгийн карт авах', 'бэлгийн карт авъя',
    'бэлгийн карт захиалах', 'бэлгийн карт худалдаж',
    'бэлгийн картаар',
    // Core noun — medium confidence ("бэлгийн" is genitive, won't match bare "бэлэг")
    'бэлгийн карт', 'гифт карт',
    // Latin / English (full phrases only)
    'gift card', 'gift kart', 'belgiin kart',
  ],
}

// ---------------------------------------------------------------------------
// Pre-computed normalized keywords
// ---------------------------------------------------------------------------

/** Pre-compute normalized keyword lists (done once at module load) */
const NORMALIZED_INTENT_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => [
    intent,
    keywords.map((kw) => normalizeText(kw)),
  ])
)

/** Pre-compute stemmed keyword lists for stem-based matching */
const STEMMED_INTENT_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(NORMALIZED_INTENT_KEYWORDS).map(([intent, keywords]) => [
    intent,
    [...new Set(keywords.map((kw) => stemKeyword(kw)))],
  ])
)

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/** Minimum prefix length for partial matching (trigram) */
const MIN_PREFIX_LEN = 4

/**
 * Find a message word that prefix-matches the keyword.
 * Returns the matching word or null. Used for dedup tracking.
 */
function prefixMatchWord(normalizedMsg: string, keyword: string): string | null {
  if (keyword.length < MIN_PREFIX_LEN) return null
  const words = normalizedMsg.split(' ')
  return words.find((w) => w.startsWith(keyword) || keyword.startsWith(w) && w.length >= MIN_PREFIX_LEN) ?? null
}

/** Regex patterns that strongly indicate size_info intent */
const SIZE_PATTERNS = [
  /\d+\s*кг/,    // 60кг, 60 кг
  /\d+\s*см/,    // 165см, 165 см
  /\d+\s*kg/i,   // 60kg (pre-normalization)
  /\d+\s*cm/i,   // 165cm (pre-normalization)
]

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log intent classification results for monitoring.
 * Logs to console in structured JSON format for serverless environments (Vercel).
 */
export function logClassification(
  message: string,
  intent: string,
  confidence: number,
  processingTimeMs: number
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: message.slice(0, 100), // First 100 chars only
    intent,
    confidence,
    processing_time_ms: processingTimeMs,
  }
  
  console.log(JSON.stringify(logEntry))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface IntentResult {
  intent: string
  confidence: number  // 0 = no match, 1+ = keyword hits
}

export interface ClassificationOptions {
  log?: boolean
}

/**
 * Classify intent with confidence score.
 * Uses exact substring match (full weight) + prefix match (half weight).
 */
export function classifyIntentWithConfidence(
  message: string,
  options?: ClassificationOptions
): IntentResult {
  const startTime = Date.now()
  
  const normalized = normalizeText(message)
  const padded = ` ${normalized} `
  const neutralPadded = ` ${neutralizeVowels(normalized)} `
  const stemmedMsg = stemText(normalized)
  const stemmedPadded = ` ${stemmedMsg} `

  let bestIntent = 'general'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(NORMALIZED_INTENT_KEYWORDS)) {
    let score = 0
    const fullyMatchedWords = new Set<string>()
    const stemMatchedWords = new Set<string>()
    // Prevent the same message word from contributing prefix score more than once per intent.
    // Without this, a word like "сайн" would score 0.5 × N for every keyword beginning with "сайн",
    // inflating greeting above thanks for messages like "маш сайн".
    const prefixMatchedWords = new Set<string>()
    for (const kw of keywords) {
      if (padded.includes(` ${kw} `)) {
        score += 1
        kw.split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else if (neutralPadded.includes(` ${neutralizeVowels(kw)} `)) {
        score += 1
        neutralizeVowels(kw).split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else {
        const matchingWord = prefixMatchWord(normalized, kw)
        if (matchingWord && !fullyMatchedWords.has(matchingWord) && !prefixMatchedWords.has(matchingWord)) {
          score += 0.5
          prefixMatchedWords.add(matchingWord)
        }
      }
    }

    // Stem-based matching
    const stemmedKws = STEMMED_INTENT_KEYWORDS[intent] || []
    for (const skw of stemmedKws) {
      if (stemmedPadded.includes(` ${skw} `)) {
        const alreadyCounted = skw.split(' ').every((w) => fullyMatchedWords.has(w) || stemMatchedWords.has(w))
        if (!alreadyCounted) {
          score += 0.75
          skw.split(' ').forEach((w) => stemMatchedWords.add(w))
        }
      }
    }

    if (intent === 'size_info') {
      for (const pattern of SIZE_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(message)) {
          score += 2
          break
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  // Priority tiebreaker: return_exchange/complaint beat product_search when both match
  // e.g. "бараа буцаах" has "бараа" (product_search) + "буцаах" (return_exchange)
  // Only override for strong return/complaint signals (exact keyword match, not prefix)
  if (bestIntent === 'product_search' && bestScore > 0) {
    const RETURN_SIGNALS = ['буцаах', 'буцаалт', 'буцаан', 'солих', 'солилт', 'солиулах', 'буцааж',
      'буцай', 'буцаж',  // colloquial/imperative: "буцай" = "return it!" (e.g. "bara butsay")
      'return', 'refund', 'exchange', 'swap', 'butsaa', 'butsaah', 'butsaalt', 'butaah', 'butaa', 'butay', 'butsay', 'бутай', 'бутаах', 'бутаа', 'solih',
      'тохирохгүй', 'буруу ирсэн', 'гэмтэлтэй']
    // Note: 'эвдэрсэн' removed from RETURN_SIGNALS — it belongs to complaint (product is broken = complaint, not return request)
    const COMPLAINT_SIGNALS = ['гомдол', 'асуудал', 'муу', 'луйвар', 'хуурамч', 'complaint',
      'эвдэрсэн', 'гэмтсэн', 'гэмтэл',
      'мөнгө буцаа', 'мөнгөө буцаа', 'mongoo butaaj', 'yaagaad', 'zahirlaa', 'hun heregteii', 'operator',
      // Non-delivery complaint — normalized forms of 'irehgui'/'ireegui' (product didn't arrive)
      'ирехгуи', 'иреегуи',
      // Human agent request
      'хүнтэй ярих', 'хүн хэрэгтэй', 'хүн дуудах', 'оператор дуудах', 'менежер дуудах']
    const normalizedWords = normalized.split(/\s+/)
    const stemmedWords = stemmedMsg.split(/\s+/)

    const hasReturn = RETURN_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalizedWords.some(w => w === kw) ||
      stemmedWords.some(w => w === kw || (kw.length >= 4 && w.startsWith(kw.slice(0, 4))))
    )
    // Word-split the raw message for Latin keyword matching (avoids 'муу' matching inside 'юмуу')
    const rawMsgWords = new Set(message.toLowerCase().split(/[\s.,!?;:'"()[\]{}<>\\/|@#$%^&*+=~`]+/).filter(w => w))
    const hasComplaint = COMPLAINT_SIGNALS.some(kw => {
      if (padded.includes(` ${kw} `) || normalizedWords.some(w => w === kw)) return true
      // For multi-word Latin signals: substring check is OK (they won't accidentally match short words)
      // For single-word signals: only match whole word against raw message
      if (kw.includes(' ')) return message.toLowerCase().includes(kw)
      return rawMsgWords.has(kw)
    })

    // Shipping tiebreaker: "хүргэлт*" + price keyword = delivery price query, not product search
    // e.g. "хүргэлтийн үнэ" has "үнэ" (product_search) but is really asking about delivery cost
    const DELIVERY_STEMS = ['хүргэлт', 'хургэлт', 'хургелт', 'хүргэх', 'delivery', 'shipping']
    const PRICE_WORDS = ['үнэ', 'хэд', 'хэдэн', 'зардал', 'хөлс', 'price', 'cost', 'fee', 'уне'] // lint-ignore: paddedIncludes + endsWith guard, no raw substring match
    const hasDelivery = DELIVERY_STEMS.some(kw => normalized.includes(kw))
    const hasPriceWord = PRICE_WORDS.some(kw => padded.includes(` ${kw} `) || normalized.endsWith(kw))
    if (hasDelivery && hasPriceWord) bestIntent = 'shipping'
    else if (hasReturn) bestIntent = 'return_exchange'
    else if (hasComplaint) bestIntent = 'complaint'
    else {
      // Tiebreaker: size_info beats product_search when message is primarily about size vocabulary
      // e.g. "хэмжее", "размер", "сайз", "size chart" — standalone size queries, not product lookups
      const STRONG_SIZE_VOCAB = ['хэмж', 'размер', 'сайз', 'сизе чарт', 'сизе гайд']
      const hasStrongSize = STRONG_SIZE_VOCAB.some(kw => normalized.includes(kw))
      if (hasStrongSize) {
        // Don't override when a specific product is being referenced
        const PRODUCT_NOUNS = ['бараа', 'цүнх', 'хувцас', 'гутал', 'пүүз', 'цамц', 'бүтээгдэхүүн', 'куртка', 'малгай']
        const hasProductNoun = PRODUCT_NOUNS.some(kw => padded.includes(` ${kw} `) || normalized.includes(kw))
        // Don't override when there's explicit purchase/order intent
        const PURCHASE_SIGNALS = ['авмаар', 'авах', 'авъя', 'авья', 'авна', 'захиал', 'zahialna', 'avmaar', 'байгаа уу', 'бга уу', 'бгаа уу']
        const hasPurchaseIntent = PURCHASE_SIGNALS.some(kw => normalized.includes(kw))
        if (!hasProductNoun && !hasPurchaseIntent) bestIntent = 'size_info'
      }
    }
  }

  // Tiebreaker: complaint beats return_exchange when problem words are present
  if (bestIntent === 'return_exchange' && bestScore > 0) {
    const PROBLEM_SIGNALS = ['асуудал', 'гомдол', 'problem']
    const hasProblem = PROBLEM_SIGNALS.some(kw => padded.includes(` ${kw} `))
    if (hasProblem) bestIntent = 'complaint'
  }

  // Additional tiebreaker: complaint beats return_exchange/payment for money refund demands
  if ((bestIntent === 'return_exchange' || bestIntent === 'payment') && bestScore > 0) {
    const MONEY_COMPLAINT_SIGNALS = ['мөнгө буцаа', 'мөнгөө буцаа', 'мөнгө butaaj', 'mongoo butaaj', 'yaagaad', 'zahirlaa', 'hun heregteii', 'operator', 'butaaj ug']
    // Check with both exact match and substring for mixed script (мөнгө butaaj ug)
    const hasMoneyComplaint = MONEY_COMPLAINT_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalized.includes(kw) || message.toLowerCase().includes(kw)
    )
    // Also check if original message contains a money word with a return word
    // Catches misspellings: мунгөө (мөнгөө), мунгу (мөнгө), and Cyrillic буцааж alongside Latin butaaj
    const MONEY_WORDS = ['мөнгө', 'мунгу', 'мунгөө', 'мунго', 'мунгуу']
    const RETURN_DEMAND_WORDS = ['butaaj', 'буцааж', 'буцаа', 'butsaa']
    const hasMixedMoneyRefund = MONEY_WORDS.some(w => message.includes(w)) && RETURN_DEMAND_WORDS.some(w => message.includes(w))
    // Also check for exclamation marks (angry tone)
    const hasAngryTone = (message.match(/!/g) || []).length >= 3
    if (hasMoneyComplaint || hasMixedMoneyRefund || (hasAngryTone && padded.includes(' буцаа'))) bestIntent = 'complaint'
  }

  // Tiebreaker: return_exchange beats size_info for fit problems
  if (bestIntent === 'size_info' && bestScore > 0) {
    const FIT_PROBLEM_SIGNALS = [
      'тохирохгүй', 'тохиргүй', 'буцаах', 'солих', 'солиулах', 'буцааж', 'том бай', 'жижиг бн', 'tohirohgui',
      // "hemjee tom baina" = "size is too big" — Latin 'i'→'и' so normalized has 'баина' not 'байна'
      'том баина', 'том бна',
      // "хемжее том" (Latin 'e'→'е', 'hemjee') — covers "hemjee tom baina" and "hemjee tom"
      'хемжее том', 'хэмжэ том',
    ]
    const hasFitProblem = FIT_PROBLEM_SIGNALS.some(kw => padded.includes(` ${kw} `))
    if (hasFitProblem) bestIntent = 'return_exchange'
  }

  // Tiebreaker: product_search/order_collection beats size_info for product/order queries with size
  if (bestIntent === 'size_info' && bestScore > 0) {
    const ORDER_SIGNALS = ['захиал', 'zahial', 'avmaar', 'avya', 'avii', 'avi', 'avna', 'худалдаж', 'авмаар']
    const PRODUCT_SEARCH_SIGNALS = ['байгаа', 'бга', 'бараа', 'tsunx', 'цүнх', 'ene', 'энэ', 'baina', 'байна', 'kurtka', 'куртка']
    // Check for order intent with substring matching for Latin keywords (zahialna contains zahial)
    const hasOrderIntent = ORDER_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalized.includes(kw)
    )
    const hasProductSearch = PRODUCT_SEARCH_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalized.includes(kw)
    )

    // Keep as size_info if it has size guide/chart/measurement keywords
    // Note: 'chart'/'guide' get normalized to 'чарт'/'гуиде' — check both forms
    const hasSizeGuideWords = (
      normalized.includes('chart') ||
      normalized.includes('чарт') ||    // normalizeText('chart') = 'чарт'
      normalized.includes('guide') ||
      normalized.includes('гуиде') ||   // normalizeText('guide') = 'гуиде'
      normalized.includes('хэлбэр') ||
      normalized.includes('заавар') ||
      normalized.includes('measurement')
    )

    // Short messages like "hemjee M" or "size M" are product search, not size guide (but "size chart" stays size_info)
    // But pure size vocabulary words like "хэмжее", "размер", "сайз" stay as size_info
    const words = normalized.split(/\s+/)
    const CORE_SIZE_VOCAB = ['хэмж', 'размер', 'сайз', 'hemjee', 'razmer', 'saiz', 'сизе']
    const hasCoreSize = CORE_SIZE_VOCAB.some(kw => normalized.includes(kw))
    // Treat core size vocab as size_info only when no purchase/order context
    const PURCHASE_CTX = ['авмаар', 'авах', 'авъя', 'авна', 'захиал', 'zahialna', 'avmaar', 'байгаа уу', 'бга уу']
    const hasPurchaseCtx = PURCHASE_CTX.some(kw => normalized.includes(kw))
    const isSizeVocabOnly = hasCoreSize && !hasPurchaseCtx
    const isShortSizeQuery = words.length <= 2 && !hasSizeGuideWords && !isSizeVocabOnly

    if (hasOrderIntent && !hasSizeGuideWords && !isSizeVocabOnly) bestIntent = 'order_collection'
    else if ((hasProductSearch || isShortSizeQuery) && !hasSizeGuideWords && !isSizeVocabOnly) bestIntent = 'product_search'
  }

  // Tiebreaker: causative verb form (-уулмаар/-иулмаар = "to have something done") is NOT order_collection/complaint
  // e.g. "авахуулмаар" = want to get nails/hair done — should be product_search
  // e.g. "Муур маань хумсаа л авахуулмаар" = "I want my cat's nails done" = product_search
  if ((bestIntent === 'order_collection' || bestIntent === 'complaint') && bestScore <= 1.5) {
    const hasCausative = /авахуулмаар|авхуулмаар|хийлгэмээр|хийлгэмэр|авч өгмөөр/.test(normalized)
    if (hasCausative) bestIntent = 'product_search'
  }

  // Tiebreaker: order_collection → order_status when the message is asking about status
  // e.g. "minii zahialga yamar baina" = "what's my order status?" not "place an order"
  if (bestIntent === 'order_collection' && bestScore > 0) {
    const STATUS_QUERY_SIGNALS = [
      'йамар баина',   // yamar baina → normalized (what's the status)
      'ямар байна',
      'йамар бн',      // yamar bn
      'ямар бн',
      'минии захиалга', // minii zahialga → normalized (my order)
      'захиалга шалга', // check order
      'хаана байна',
      'статус',
    ]
    const hasStatusQuery = STATUS_QUERY_SIGNALS.some(kw => normalized.includes(kw))
    if (hasStatusQuery) bestIntent = 'order_status'
  }

  // Tiebreaker: table_reservation → shipping when message contains delivery words
  // "oroi 9 iin uyd hurgeed uguurei" = "please deliver by 9pm" hits 'орой' twice (vowel-neutral),
  // scoring 2.0 for table_reservation. If delivery intent is present, override to shipping.
  if (bestIntent === 'table_reservation' && bestScore > 0) {
    const DELIVERY_VOCAB = ['хүргэлт', 'хүргэх', 'хүргэнэ', 'хүргээд', 'хүргэгч', 'хургэлт', 'хургелт',
      'шуудан', 'delivery', 'deliver', 'хаяг', 'хороо', 'байр', 'тоот', 'давхар']
    const hasDelivery = DELIVERY_VOCAB.some(kw =>
      padded.includes(` ${kw} `) || normalized.includes(kw)
    )
    // Also catch Latin "hurgeed / hurgelt" variants that didn't fully normalize
    const hasLatinDelivery = /hur[g|г]e/.test(normalized)
    if (hasDelivery || hasLatinDelivery) bestIntent = 'shipping'
  }

  // Tiebreaker: shipping → order_collection when message contains a phone number + address words
  // Customers providing their delivery address+phone during checkout classify as shipping
  // due to 'хороо'/'байр'/'тоот' being address-structure keywords — override to order_collection.
  if (bestIntent === 'shipping' && bestScore > 0) {
    const hasPhone = /\b\d{8}\b/.test(message)
    const ADDRESS_WORDS = ['хороо', 'байр', 'тоот', 'давхар', 'орц', 'horoo', 'bair', 'toot']
    const hasAddressWord = ADDRESS_WORDS.some(kw => normalized.includes(kw))
    if (hasPhone && hasAddressWord) bestIntent = 'order_collection'
  }

  // Optional logging
  if (options?.log) {
    const processingTime = Date.now() - startTime
    logClassification(message, bestIntent, bestScore, processingTime)
  }

  return { intent: bestIntent, confidence: bestScore }
}

/** Confidence threshold below which we ask clarification instead of guessing */
export const LOW_CONFIDENCE_THRESHOLD = 0.5

/**
 * Backwards-compatible wrapper: returns just the intent string.
 */
export function classifyIntent(message: string): string {
  return classifyIntentWithConfidence(message).intent
}

// classifyIntentHybrid removed — was creating a Turbopack circular dependency
// via require('./ai/hybrid-classifier') inside intent-classifier.ts
// Use hybridClassify directly from '@/lib/ai/hybrid-classifier' instead.
