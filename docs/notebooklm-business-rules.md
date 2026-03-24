# Temuulel Chatbot — Business Rules & Intent Classification

This document contains ALL business rules for the Temuulel e-commerce chatbot platform.
Upload this to NotebookLM as a source to improve intent classification accuracy.

---

## 1. Intent Classification (13 Intents)

| Intent | Description | Example Messages |
|--------|-------------|------------------|
| product_search | Browse/search products | "Цамц байна уу?", "leevchik bgaa yu" |
| order_status | Check order tracking | "Захиалга маань хаана явж байна?" |
| greeting | Salutations | "Сайн байна уу", "Mash sain" |
| thanks | Gratitude | "Баярлалаа" |
| complaint | Issues/problems | "Яагаад ийм удаан байгаа юм!?" |
| return_exchange | Return/refund requests | "Буруу бараа ирсэн солиулж болох уу?" |
| size_info | Size/fit queries | "M size байна уу?" |
| payment | Payment methods | "Хуваан төлж болох уу?" |
| shipping | Delivery cost/timing | "Хүргэлт хэд вэ?" |
| order_collection | Place an order | "Захиалмаар байна", "1" (product selection) |
| gift_card_purchase | Gift card queries | "Бэлгийн карт авъя" |
| table_reservation | Restaurant booking | "Ширээ захиалах" |
| allergen_info | Dietary restrictions | "Глютенгүй бий юу?" |

### Priority/Tiebreaker Rules (IMPORTANT)

When multiple intents match, these rules determine which wins:

1. return_exchange/complaint BEATS product_search
2. complaint BEATS return_exchange (for money refund signals)
3. shipping BEATS product_search (when "хүргэлт" + price words)
4. size_info BEATS product_search (unless product noun present)
5. return_exchange BEATS size_info (for fit problems: "тохирохгүй", "том", "жижиг")
6. order_collection BEATS size_info (with purchase intent words)
7. shipping → complaint (delivery failure: "ирсэнгүй", "ирэхгүй")

---

## 2. Complaint Detection — Word Boundary Rules

### CRITICAL: "муу" word boundary fix

The word "муу" (bad) must ONLY match as a whole word, NOT inside other words.

**Correct behavior:**
- "муу бараа" → complaint (correct: "муу" is standalone)
- "Яагаад ийм муу бараатай байна вэ?" → complaint (correct)
- "энэ юмуу тэр юмуу?" → NOT complaint (correct: "юмуу" contains "муу" but is a different word meaning "things")

**Rule:** All complaint keywords use whole-word token matching. The text is split by spaces and each token is checked for exact match.

### Complaint Keywords
- Cyrillic: гомдол, асуудал, муу, буруу, алдаа, эвдэрсэн, гэмтсэн
- Latin: gomdol, asuudal, muu, buruu, aldaa

---

## 3. Latin Transliteration (Mongolian typed in Latin)

Many Mongolian customers type in Latin characters. The system converts Latin to Cyrillic before classification.

### Digraph Conversions (applied first, longest match)
- ts → ц, sh → ш, ch → ч, kh → х, zh → ж
- yu → ю, ya → я, yo → ё, ye → е

### Single Character Mapping
a→а, b→б, d→д, e→е, g→г, i→и, j→ж, k→к, l→л, m→м, n→н, o→о, p→п, r→р, s→с, t→т, u→у, v→в, w→в, z→з

### Examples
- "leevchik bgaa yu" → "леевчик бгаа ю" → product_search
- "zahialmaar baina" → "захиалмаар байна" → order_collection
- "tiim" → "тийм" → confirmation
- "bzd 7 horoo 36 bair" → "бзд 7 хороо 36 байр" → address

### Known Classification Gaps (NotebookLM must learn these)
- "boloh uu" → should be payment intent, NOT size_info
- "ochd awbal haana we" → should be shipping intent
- Customer names in Latin (e.g., "Bat", "Shinebayar", "Batchimeg") during order flow must NOT be classified as greeting

---

## 4. Delivery Fee Calculator

### Zone-Based Fees (Ulaanbaatar)

| Zone | Districts | Fee |
|------|-----------|-----|
| Central (Төв бүс) | Сүхбаатар (СБД/sbd), Чингэлтэй (ЧД/chd), Баянгол (БГД/bgd) | 3,000₮ |
| Mid (Дунд бүс) | Хан-Уул (ХУД/hud), Баянзүрх (БЗД/bzd), Сонгинохайрхан (СХД/shd) | 5,000₮ |
| Outer (Алслагдсан бүс) | Налайх, Багануур, Багахангай | 8,000₮ |
| Default | No match | 5,000₮ |

### Free Shipping Threshold
Orders over 100,000₮ get FREE shipping (0₮ delivery fee).

### Intercity Delivery
Cities: Дархан, Эрдэнэт, Чойбалсан, Мөрөн, Улаангом, Ховд, Алтай, Баянхонгор, Арвайхээр, Мандалговь, Сайншанд, Даланзадгад, Зуунмод, Хархорин, Цэцэрлэг, Өлгий, Баруун-Урт
- Fee: 0₮ (cash on delivery at bus station/post)

---

## 5. Escalation Rules

### Scoring System

| Signal | Points | Trigger |
|--------|--------|---------|
| complaint keywords | 25 pts | гомдол, асуудал, муу, буруу, алдаа, эвдэрсэн, гэмтсэн |
| frustration signals | 20 pts | яагаад, удаан, ирсэнгүй, ирэхгүй, бухимдсан |
| return/exchange | 20 pts | буцаах, буцаалт, солих, мөнгө буцаах |
| payment dispute | 25 pts | төлбөр буруу, давхар төлсөн, мөнгөө буцаа |
| repeated message | 15 pts | Same message sent again (Jaccard similarity >= 0.8) |
| AI fail to resolve | 15 pts | 3+ consecutive customer messages with only AI replies |
| long unresolved | 10 pts | 6+ customer messages with no human reply |

### Escalation Levels
- score < 30 → low (no action)
- 30-59 → medium (monitor)
- 60-79 → high (ESCALATE — human agent notified)
- 80+ → critical (URGENT — immediate human response required)

### Default Threshold: 60 points

### Immediate Escalation Triggers (bypass scoring)
- 3+ exclamation marks ("Мөнгөө буцааж өг!!!")
- Direct operator requests: "захирал дуудаач", "оператор дуудаач", "хүнтэй ярих", "робот биш"
- Latin variants: "operator", "manager"

### Escalation Message
"Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно. Түр хүлээнэ үү!"

---

## 6. Resolution Engine (Empathy Detection)

Before AI generates a response, the Resolution Engine checks context and determines tone.

### Empathetic Tone Triggers
Intent must be one of: complaint, order_status, shipping, return_exchange

AND message contains worry words:
- Cyrillic: ирсэнгүй, ирэхгүй, удаан, хаана, буруу, гэмтсэн, муу, асуудал, гомдол, солих, буцаа
- Latin: irsengui, irekhgui, udaan, haana, buruu, gemtsen

### Empathy Prefix Examples
- Order status + worried → "Таны санааг зовсонд уучлаарай. " + response
- Complaint → Empathetic acknowledgment before solution
- Return request → Understanding tone before process explanation

---

## 7. Order Collection Flow

### Standard Order Steps
1. Product search → Customer asks about a product
2. Product selection → Customer picks a product (e.g., "1")
3. Name → Customer provides name (MUST NOT trigger greeting intent!)
4. Phone → Customer provides phone number (8 digits)
5. Address → Customer provides delivery address
6. Confirmation → Customer confirms ("Тийм", "За", "tiim")

### Critical Rule: Names During Order Flow
When the chatbot is collecting order information and the customer provides their name, it MUST NOT be classified as a greeting intent. Examples:
- "Shinebayar" → NOT greeting (it's a name during order flow)
- "Bat" → NOT greeting (it's a name)
- "Batchimeg" → NOT greeting (even though it contains "hi")
- "Болд" → NOT greeting (it's a name)
- "Бат-Эрдэнэ" → NOT greeting (it's a name)

### Cancel and Recovery
- Customer can cancel mid-order: "Захиалаагүй ээ", "Цуцлах"
- After cancellation, customer can start a NEW order immediately
- Complaint during checkout should NOT kill the order draft

---

## 8. Driver Delivery Flow (Telegram Bot)

### Delivery Statuses
pending → assigned → picked_up → delivered/delayed/failed/cancelled

### Driver Actions (Telegram Callbacks)
- `confirm_received:{id}` → Status: picked_up (driver picked up from store)
- `delivered:{id}` → Shows payment options
- `payment_full:{id}` → Order paid in full, delivery complete
- `payment_custom:{id}` → Partial payment (driver enters amount + reason)
- `payment_delayed:{id}` → Payment postponed
- `payment_declined:{id}` → Customer refused to pay
- `deny_delivery:{id}` → Driver refuses delivery → status reset to pending, driver_id = null
- `damaged:{id}` → Product damaged → status: failed, order.payment_status: failed
- `no_payment:{id}` → No payment received → order.payment_status: failed
- `unreachable:{id}` → Customer not reachable
- `delay:{id}` → Show time picker (tomorrow/week/custom)
- `delay_time:tomorrow:{id}` → Postpone to tomorrow
- `delay_time:week:{id}` → Postpone 1 week
- `delay_time:custom:{id}` → Driver types custom delay text

### Partial Payment Flow
1. Driver taps payment_custom
2. Driver types amount (e.g., "25000")
3. Driver types reason (e.g., "Бараа гэмтэлтэй байсан")
4. AI Agent evaluates: justified → accept, not justified → send QPay invoice
5. If customer has no Messenger → SMS fallback

### Metadata Rules
- damaged/no_payment handlers MUST MERGE metadata, not overwrite
- Order notes MUST be APPENDED, not overwritten
- Custom delay MUST set estimated_delivery_time for cron reactivation

### Cron Reactivation
- Delayed deliveries with past estimated_delivery_time are auto-reactivated
- Status: delayed → pending, driver_id: null
- Customer is notified and asked to reconfirm

---

## 9. Payment Follow-up Chain

When payment is delayed:
1. Reminder 1: Sent immediately (driver taps payment_delayed)
2. Reminder 2: Sent 2 hours later (cron)
3. Reminder 3: Sent 12 hours later (final warning)
4. Escalation: 24 hours passed → conversation escalated to human agent

When payment is declined:
1. order.payment_status = 'failed'
2. Store URGENTLY notified (payment_declined_urgent notification)
3. Conversation ESCALATED (score=80, status=escalated)
4. Human agent must contact customer

---

## 10. 24h Messenger Window

Facebook Messenger has a 24-hour messaging window. After 24h without customer interaction:
- Messenger send will FAIL
- System falls back to SMS notification
- delivery.metadata.partial_payment_resolution.messenger_window_expired = true
