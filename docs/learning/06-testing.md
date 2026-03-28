# 🧪 Хичээл 6: Testing

## Testing гэж юу вэ?

**Зүйрлэл:** Шинэ машин үйлдвэрээс гарахын өмнө юу хийдэг вэ? **Туршина!** Тоормос ажиллаж байна уу? Чийдэн асаж байна уу? Хөдөлгүүр зөв ажиллаж байна уу? Код бичсний дараа ч адил — код зөв ажиллаж байгаа эсэхийг тест хийж шалгана.

### Яагаад хэрэгтэй вэ?

**Тестгүй бол:**
1. Код засна → Өөр газар эвдэрнэ → Мэддэггүй
2. Шинэ feature нэмнэ → Хуучин feature ажиллахаа болино → Хэрэглэгч уурлана
3. Bug олдоно → Засна → 2 долоо хоногийн дараа яг тэр bug дахин гарна

**Тесттэй бол:**
1. Код засна → Тест ажиллуулна → Алдаа байвал ШУУД мэдэгдэнэ ✅
2. Шинэ feature нэмнэ → Бүх хуучин тест ажиллана → Юу ч эвдрээгүй гэдгийг мэднэ ✅
3. Bug олдоно → Тест бичнэ → Bug дахин гарахаас хамгаална ✅

---

## 📊 Тестийн төрлүүд

**Зүйрлэл: Машиныг туршихад 3 шат бий:**

| Төрөл | Зүйрлэл | Тайлбар |
|-------|----------|---------|
| **Unit test** | Тоормосны дэвсгэрийг ганцааранг нь шалгах | Нэг функцийг тусгаарлаж шалгана |
| **Integration test** | Тоормос + дугуй хамт ажиллаж байна уу | Хэд хэдэн хэсэг хамтдаа ажиллахыг шалгана |
| **E2E test** | Машиныг жинхэнэ замд гаргаж туршина | Browser нээж, хэрэглэгч шиг товч дарж шалгана |

```
Unit test:    [функц] → зөв үр дүн гаруулна уу?
Integration:  [API route] → database-тэй зөв ажиллана уу?
E2E:          [Browser] → хэрэглэгч бүтээгдэхүүн хайгаад захиалга өгч чадна уу?
```

---

## 🔬 Бодит тест жишээ: Hybrid Classifier тест

📁 **Файл:** `tests/real-world-chat.test.ts`

Энэ тест нь Монгол хэрэглэгчид Messenger-ээр яаж бичдэгийг шалгана:

```typescript
import { describe, test, expect } from 'vitest'
import { hybridClassify } from '@/lib/ai/hybrid-classifier'

describe('Real-World Mongolian Chat Patterns', () => {
  describe('Latin Transliterations (Common in Messenger)', () => {
    test('Order intent with Latin script', () => {
      const messages = [
        'zahialna',           // захиална
        'zahialu',            // захиалъя
        'avmaar baina',       // авмаар байна
        'ene baraag avya',    // энэ бараа авъя
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Product search with Latin transliteration', () => {
      const messages = [
        'tsunx bga uu',       // цүнх бга уу (цүнх байна уу?)
        'baraa haruulna uu',  // бараа харуулна уу
        'shine baraa',        // шинэ бараа
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('product_search')
      }
    })

    test('Complaint with Latin script', () => {
      const messages = [
        'yaagaad udaan bgan yum',    // яагаад удаан бган юм
        'mongoo butaaj ug',           // мөнгөө буцааж өг
        'muu uilchilgee',             // муу үйлчилгээ
      ]

      for (const msg of messages) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('complaint')
      }
    })
  })
})
```

### Мөр бүрийн тайлбар:

| Код | Тайлбар |
|-----|---------|
| `import { describe, test, expect } from 'vitest'` | Тест бичих хэрэгслүүдийг import хийнэ |
| `describe('...', () => { })` | Тестүүдийг бүлэглэнэ — "Бодит чат pattern" |
| `test('...', () => { })` | Нэг тест — "Latin-аар бичсэн захиалга" |
| `const result = hybridClassify(msg)` | Функцийг дуудна |
| `expect(result.intent).toBe('product_search')` | Үр дүн `'product_search'` байх ёстой |
| `expect([...]).toContain(result.intent)` | Үр дүн жагсаалтын аль нэгийг агуулах ёстой |

### expect() ямар ямар шалгалт хийж болох вэ?

```typescript
expect(value).toBe('hello')           // Яг энэ утга байх
expect(value).not.toBe('bye')         // Энэ утга БИШ
expect(array).toContain('item')       // Жагсаалт энэ элементтэй
expect(value).toBeTruthy()            // true эсвэл truthy
expect(value).toBeNull()              // null байх
expect(number).toBeGreaterThan(5)     // 5-аас их
expect(func).toThrow()                // Алдаа шидэх ёстой
```

---

## 🌐 E2E тест — Playwright

**Зүйрлэл:** Шинэ ажилтныг ажилд авахын өмнө "бодит ажил хий" гэж шалгадаг. E2E тест бол "бодит хэрэглэгч" шиг browser нээж, товч дарж, хуудсан дээр юу харагдаж байгааг шалгана.

📁 **Файл:** `playwright.config.ts`

```typescript
// Playwright = Browser автоматжуулалтын хэрэгсэл
// Chrome, Firefox, Safari дээр автомат тест ажиллуулна

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',                    // E2E тестүүдийн фолдер
  use: {
    baseURL: 'http://localhost:3000',  // Локал серверийг ашиглана
  },
})
```

E2E тест ямар харагддаг вэ (жишээ):

```typescript
import { test, expect } from '@playwright/test'

test('Хэрэглэгч login хийж dashboard-д орно', async ({ page }) => {
  // 1. Login хуудас руу очно
  await page.goto('/login')

  // 2. Email, password оруулна
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'secret123')

  // 3. Login товч дарна
  await page.click('button[type="submit"]')

  // 4. Dashboard хуудас ачаалагдсан эсэхийг шалгана
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('h1')).toContainText('Dashboard')
})
```

---

## 🏃 Тест ажиллуулах

```bash
# Бүх тестийг ажиллуулах
pytest                    # эсвэл:
npx vitest

# Coverage харах — хэдэн хувь нь тестээр хамрагдсан
npx vitest --coverage

# E2E тест ажиллуулах
npx playwright test

# Нэг файлын тестийг ажиллуулах
npx vitest tests/real-world-chat.test.ts
```

---

## 📊 Test бичих зөвлөмж

### 1. Нэрлэлт чухал

```typescript
// ❌ Муу нэр
test('test 1', () => { ... })

// ✅ Сайн нэр — юу шалгаж байгаа нь ойлгомжтой
test('Latin-аар бичсэн захиалга зөв intent буцаана', () => { ... })
```

### 2. AAA pattern

```typescript
test('fmtPrice тоог Монгол форматаар бичнэ', () => {
  // Arrange — бэлтгэл
  const price = 25000

  // Act — үйлдэл
  const result = fmtPrice(price)

  // Assert — шалгалт
  expect(result).toBe('25,000₮')
})
```

### 3. Edge case шалгах

```typescript
test('Хоосон мессеж general intent буцаана', () => {
  const result = hybridClassify('')
  expect(result.intent).toBe('general')
})

test('Маш урт мессежийг зөв ангилна', () => {
  const longMessage = 'а'.repeat(5000)
  const result = hybridClassify(longMessage)
  // Алдаа гарахгүй, ямар нэг intent буцаана
  expect(result.intent).toBeDefined()
})
```

---

## 🎯 Дасгал

### Дасгал 1: expect бичих
Дараах шалгалтуудыг `expect`-ээр бич:

1. `status` нь `"pending"` байх ёстой
2. `items` жагсаалт хоосон биш байх ёстой
3. `total` нь 0-ээс их байх ёстой

<details>
<summary>💡 Хариу харах</summary>

```typescript
expect(status).toBe('pending')
expect(items.length).toBeGreaterThan(0)
expect(total).toBeGreaterThan(0)
```
</details>

### Дасгал 2: Тест бичих
`fmtPrice` функцэд тест бич:
- `0` → `"0₮"`
- `1000` → `"1,000₮"`

<details>
<summary>💡 Хариу харах</summary>

```typescript
import { describe, test, expect } from 'vitest'

describe('fmtPrice', () => {
  test('0-г 0₮ гэж форматлана', () => {
    expect(fmtPrice(0)).toBe('0₮')
  })

  test('1000-г 1,000₮ гэж форматлана', () => {
    expect(fmtPrice(1000)).toBe('1,000₮')
  })
})
```
</details>

---

👉 **Дараагийн хичээл:** [07-git-deployment.md](./07-git-deployment.md) — Git & Deployment
