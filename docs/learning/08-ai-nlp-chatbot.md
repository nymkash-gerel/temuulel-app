# 🤖 Хичээл 8: AI & NLP Chatbot

## AI chatbot яаж ажилладаг вэ?

**Зүйрлэл:** Зоогийн газрын зөөгч бодоорой. Зочин "Энд юу байна?" гэхэд зөөгч цэс харуулна. "Хамгийн эрэлттэй юу вэ?" гэхэд зөвлөгөө өгнө. "Захиалъя!" гэхэд захиалга авна. AI chatbot бол ухаалаг "зөөгч" — хэрэглэгчийн үгийг ойлгож, зөв хариу өгнө.

### Temuulel Chatbot-ын Flow:

```
Хэрэглэгч мессеж бичнэ: "Цамц бга юу?"
        │
        ▼
1. 📝 Текст нормализаци — "цамц бга юу" → "цамц бга юу"
        │
        ▼
2. 🎯 Intent Classification — Юу хүсэж байна? → "product_search"
        │
        ▼
3. 🔍 Мэдээлэл хайх — Database-аас цамц хайна
        │
        ▼
4. 💬 Хариу үүсгэх — "Бидэнд 3 төрлийн цамц байна: ..."
        │
        ▼
5. 📤 Хариу илгээх → Messenger / Widget
```

---

## 🎯 Intent Classification — Зорилго таних

**Зүйрлэл:** "Цамц байна уу?" гэхэд → **бараа хайж байна** (product_search). "Хэзээ ирэх вэ?" гэхэд → **хүргэлт асууж байна** (shipping). Хэрэглэгчийн мессежээс юу хүсэж байгааг олох процесс.

### Temuulel-д 3 түвшний classifier бий:

```
Level 1: Keyword Matching (хурдан, энгийн)
   ↓ итгэлцэл бага бол
Level 2: ML Classifier (машин сургалт)
   ↓ итгэлцэл бага бол
Level 3: GPT-4o-mini (хамгийн ухаалаг, удаан)
```

---

## 📖 Level 1: Keyword Matching

📁 **Файл:** `src/lib/intent-classifier.ts`

**Зүйрлэл:** Толь бичиг бодоорой. "Цамц" гэсэн үг байвал = бараа хайж байна. Маш хурдан, энгийн.

```typescript
const INTENT_KEYWORDS: Record<string, string[]> = {
  product_search: [
    // Монгол
    'бүтээгдэхүүн', 'бараа', 'хувцас', 'гутал', 'цүнх',
    'үнэ', 'хямд', 'шинэ', 'авмаар', 'хайх',
    'цамц', 'даашинз', 'өмд', 'куртка', 'малгай',
    // English
    'product', 'buy', 'price', 'search', 'available',
    // Aliases — зөв бичээгүй, слэнг
    'барааа', 'хувцаас', 'цунх', 'пууз',
    'авий', 'авии', 'захиалъя', 'захиалья',
    // Availability check
    'байгаа юу', 'бий юу', 'бга юу',
    // Зураг хүсэх
    'зураг', 'фото', 'photo', 'picture',
  ],

  complaint: [
    'гомдол', 'муу', 'удаан', 'хэзээ', 'буцааж',
    'мөнгөө', 'захирал', 'дуудаач', 'уурлаж',
    'алдаа', 'буруу', 'эвдэрсэн',
    'bad', 'terrible', 'refund', 'manager',
  ],

  greeting: [
    'сайн байна уу', 'сн бну', 'мэнд', 'hello', 'hi',
    'өглөөний мэнд', 'оройн мэнд',
  ],
  // ... бусад intent-ууд
}
```

### Яаж ажилладаг:

```
"Цамц бга юу?" →
  1. "цамц" = product_search keyword ✅
  2. "бга юу" = product_search keyword ✅
  → Intent: product_search (итгэлцэл: 2.0)
```

---

## 🧠 Level 2: ML Classifier

📁 **Файл:** `src/lib/ai/ml-classifier.ts`

**Зүйрлэл:** Keyword бол толь бичиг — яг тэр үг байх ёстой. ML бол **хүүхэд** — олон жишээ харсан, шинэ зүйлийг ойлгож чадна.

ML classifier нь **сургалтын өгөгдөл** (training data) дээрээс сурсан:

```
"ямар ямар бараа бий?"     → product_search
"энэ юу вэ?"               → product_search
"хүргэлт хэр удаан вэ?"    → shipping
"захиалга хаана яваа?"     → order_status
"муу үйлчилгээ!"           → complaint
```

Тэгвэл шинэ мессеж ирэхэд ("Өмд бну?") өмнөх жишээнүүдтэй адил pattern-г таньж, intent олно.

---

## 🔄 Level 3: Hybrid Classifier

📁 **Файл:** `src/lib/ai/hybrid-classifier.ts`

Энэ бол Temuulel-ийн **гол classifier** — Keyword + ML + Morphology + GPT хамтдаа:

```typescript
export function hybridClassify(message: string): IntentResult {
  // 1. Keyword classifier-ийн үр дүн авах
  const keywordResult = classifyIntentWithConfidence(message)

  // 2. ML classifier-ийн үр дүн авах
  const mlResult = mlClassify(message)

  // 3. Keyword итгэлцэл >= 2.0 бол → keyword итгэ
  if (keywordResult.confidence >= 2.0) {
    return keywordResult
  }

  // 4. Морфологийн шинжилгээ — Монгол хэлний дагавар, залгал
  const normalized = normalizeText(message)
  const morphFeatures = extractMorphFeatures(normalized)
  const morphSignals = deriveMorphIntentSignals(morphFeatures)

  // 5. ML итгэлцэл >= 0.7 бол → ML итгэ
  if (mlResult.confidence >= 0.7) {
    // Гэхдээ ML "greeting" гэсэн ч бараа нэр + "бну" байвал → product_search
    if (mlResult.intent === 'greeting') {
      const hasAvailabilitySuffix = AVAILABILITY_SUFFIXES.test(normalized)
      // "Skims бну?" = product_search, "Сн бну?" = greeting
      // ...
    }
    return mlResult
  }

  // 6. Бүгд бага итгэлцэлтэй → keyword-д итгэ (fallback)
  return keywordResult
}
```

### Яагаад Hybrid хэрэгтэй вэ?

| Мессеж | Keyword | ML | Зөв хариу |
|--------|---------|-----|-----------|
| "цамц бга юу" | ✅ product_search | ✅ product_search | product_search |
| "Skims бну?" | ❓ general | ❌ greeting | product_search (Hybrid засна!) |
| "захирлаа дуудаач" | ✅ complaint | ❓ general | complaint |
| "xyz abc" | ❓ general | ❓ general | general → GPT fallback |

---

## 💬 GPT Fallback

📁 **Файл:** `src/lib/ai/hybrid-classifier.ts`

Keyword + ML хоёулаа мэдэхгүй бол → GPT-4o-mini-д асуу:

```typescript
export async function gptClassifyIntent(message: string): Promise<IntentResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,           // Тогтмол хариу (санамсаргүй биш)
      max_tokens: 30,           // Богино хариу л хэрэгтэй
      messages: [
        {
          role: 'system',
          content: `Classify the user message intent. Reply with ONLY one of:
            product_search, order_collection, order_status, shipping,
            complaint, return_exchange, greeting, general`,
        },
        { role: 'user', content: message },
      ],
    }),
    signal: AbortSignal.timeout(3000),  // 3 секундэд хариу ирэхгүй бол зогсоо
  })
  // ...
}
```

### Async flow:

```typescript
export async function hybridClassifyAsync(message: string): Promise<IntentResult> {
  const result = hybridClassify(message)  // Keyword + ML (хурдан)

  if (result.confidence >= 1) return result  // Итгэлцэл хангалттай

  // Бага итгэлцэл → GPT-д асуу (удаан, гэхдээ ухаалаг)
  const gptResult = await gptClassifyIntent(message)
  if (gptResult.confidence > 0 && gptResult.intent !== 'general') {
    return gptResult
  }

  return result
}
```

---

## 🗣️ Contextual Responder — Хариу үүсгэгч

📁 **Файл:** `src/lib/ai/contextual-responder.ts`

Intent олсны дараа GPT-4o-mini-аар **хариу үүсгэнэ**:

```typescript
let prompt = `Та "${input.storeName}" дэлгүүрийн туслах Temuulel.
Монгол хэлээр хариулна.

ДҮРЭМ:
- Богино, шууд, байгалийн хариулт.
- AI/chatbot гэж ХЭЗЭЭ Ч бүү хэл.
- Мэдэхгүй зүйлийг зохиохгүй.
- Бүтээгдэхүүн дурдах бүрт үнийг ₮-тэй бич.`
```

GPT-д дамжуулдаг мэдээлэл:
- Дэлгүүрийн нэр, тохиргоо
- Хэрэглэгчийн мессежийн түүх
- Олдсон бүтээгдэхүүнүүд (нэр, үнэ, зураг)
- Захиалгын мэдээлэл
- Intent (product_search, complaint, г.м.)

---

## 📊 Training Data — Яагаад чухал?

**Зүйрлэл:** Хүүхэд яаж суралцдаг вэ? Олон жишээ харж, дасгал хийж. ML classifier ч яг ижил — олон жишээ харах тусмаа илүү зөв ойлгоно.

```
Сургалтын жишээ цуглуулах:
1. Бодит Messenger чат-аас мессежүүд авна
2. Хүн гараар intent нэрлэнэ ("энэ мессеж = product_search")
3. ML model-д сургана
4. Тестэлнэ — зөв ангилж байна уу?
5. Буруу ангилсан жишээнүүдийг нэмж дахин сургана
```

Temuulel-ийн сургалтын өгөгдөл:

```
tests/ecommerce-test-chats.json
tests/real-world-chat.test.ts
tests/comprehensive-chat-scenarios.test.ts
```

---

## 🎯 Дасгал

### Дасгал 1: Intent тааруулах
Дараах мессежүүдийн intent юу вэ?

1. "Сн бну"
2. "Цамц хэд вэ?"
3. "Захиалга хаана яваа?"
4. "Муу үйлчилгээ, мөнгөө буцааж өг"
5. "XL размер бий юу?"

<details>
<summary>💡 Хариу харах</summary>

1. `greeting` — мэндчилгээ
2. `product_search` — бараа + үнэ асууж байна
3. `order_status` — захиалгын байдал
4. `complaint` — гомдол
5. `product_search` (эсвэл `size_info`) — размер/нөөц асууж байна
</details>

### Дасгал 2: Яагаад Hybrid?
Зөвхөн keyword classifier-тай бол ямар асуудал гарах вэ? 2 жишээ бич.

<details>
<summary>💡 Хариу харах</summary>

1. "Skims бну?" — "Skims" гэсэн бренд нэр keyword жагсаалтад байхгүй → `general` гэж буруу ангилна. Hybrid ML-ээр product_search гэж олно.
2. "энд юу бий?" — keyword жагсаалтад яг ийм хэллэг байхгүй → `general`. ML олон жишээ харсан учир `product_search` гэж зөв таньна.
</details>

---

👉 **Дараагийн хичээл:** [09-architecture.md](./09-architecture.md) — Architecture
