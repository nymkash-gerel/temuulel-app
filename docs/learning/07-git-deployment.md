# 🚀 Хичээл 7: Git & Deployment

## Git гэж юу вэ?

**Зүйрлэл:** Word документ дээр "Save As" хийж `report_v1.docx`, `report_v2.docx`, `report_FINAL.docx`, `report_FINAL_FINAL.docx` гэж хадгалж байсан уу? Git бол ухаалаг "Save" — бүх өөрчлөлтийн түүхийг хадгалж, хэзээ ч буцаж болно.

### Гол ойлголтууд

| Нэр | Зүйрлэл | Тайлбар |
|-----|----------|---------|
| **Repository (repo)** | Хавтас | Бүх код + түүхийг агуулсан фолдер |
| **Commit** | "Save" + тэмдэглэл | Өөрчлөлтийн агшин зураг + тайлбар |
| **Branch** | Салбар зам | Кодын тусдаа хувилбар (жишээ: feature/orders) |
| **Push** | Upload | Локал өөрчлөлтийг GitHub руу илгээх |
| **Pull** | Download | GitHub-аас шинэ өөрчлөлтийг татах |
| **Merge** | Нэгтгэх | 2 branch-ийг нэгтгэх |
| **Pull Request** | Шалгуулах | "Миний код зүгээр үү?" гэж баг дээрээ асуух |

---

## 📝 Git-ийн үндсэн командууд

```bash
# Төлөв шалгах — юу өөрчлөгдсөн бэ?
git status

# Бүх өөрчлөлтийг staging-д нэмэх
git add .

# Commit хийх — түүхэнд хадгалах
git commit -m "feat: захиалгын хуудсанд export нэмсэн"

# GitHub руу push хийх
git push

# Шинэ branch үүсгэх
git checkout -b feature/delivery-tracking

# main branch руу буцах
git checkout main

# Өөрчлөлтүүдийг татах
git pull
```

### Commit message яаж бичих вэ?

```bash
# ✅ Сайн — юу хийсэн нь ойлгомжтой
git commit -m "feat: захиалгын хуудсанд Excel export нэмсэн"
git commit -m "fix: rate limit 429 алдаа засав"
git commit -m "refactor: notification функцийг задалсан"

# ❌ Муу — юу хийсэн нь тодорхойгүй
git commit -m "update"
git commit -m "fix bug"
git commit -m "asdf"
```

**Commit message-ийн угтвар:**

| Угтвар | Утга |
|--------|------|
| `feat:` | Шинэ feature нэмсэн |
| `fix:` | Bug засварласан |
| `refactor:` | Код цэгцэлсэн (ажиллагаа өөрчлөгдөөгүй) |
| `test:` | Тест нэмсэн/засварласан |
| `docs:` | Баримт бичиг |
| `style:` | Код форматлалт |

---

## ☁️ Vercel гэж юу вэ?

**Зүйрлэл:** Чи хоолоо бэлдээд, дэлгүүрт тавьж зарна. Vercel бол чиний app-ийг интернетэд тавьж өгдөг "дэлгүүр". Code push хийхэд **автоматаар** deploy хийнэ.

### Deploy яаж ажилладаг:

```
Чи код push хийнэ (git push)
     │
     ▼
GitHub дээр код хадгалагдана
     │
     ▼
Vercel автоматаар мэдэгдэл авна
     │
     ▼
Vercel кодыг build хийнэ (npm run build)
     │
     ▼
Build амжилттай бол → temuulel.com дээр шинэ хувилбар ажиллана!
Build алдаатай бол → Хуучин хувилбар хэвээрээ, алдааг мэдэгдэнэ
```

### Vercel тохиргоо

📁 **Файл:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 22 * * *"
    },
    {
      "path": "/api/cron/reactivate-delayed",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/payment-followup",
      "schedule": "0 9 * * *"
    }
  ]
}
```

| Cron job | Тайлбар |
|----------|---------|
| `daily-report` 22:00 | Өдрийн тайлан бэлдэнэ |
| `reactivate-delayed` 08:00 | Хоцорсон хүргэлтүүдийг дахин идэвхжүүлнэ |
| `payment-followup` 09:00 | Төлбөргүй захиалгуудыг сануулна |

---

## ⚙️ CI/CD — Автомат шалгалт

**Зүйрлэл:** Үйлдвэрийн угсрах шугам бодоорой. Эд анги → угсарна → шалгана → баглана → илгээнэ. CI/CD бол кодын "угсрах шугам".

**CI** = Continuous Integration (Тасралтгүй нэгтгэл)
**CD** = Continuous Deployment (Тасралтгүй deploy)

```
Code push
   │
   ▼
CI шалгалт автомат ажиллана:
   ├── ✅ Lint (ruff check) — кодын загвар зөв үү?
   ├── ✅ Type check (mypy) — type алдаа байна уу?
   ├── ✅ Test (pytest) — тестүүд дамжина уу?
   └── ✅ Build (next build) — app зөв бүтдэг үү?
        │
        ▼
   Бүгд дамжвал → CD: Автомат deploy
   Нэг нь fail бол → ❌ Зогсоно, алдааг засна
```

### CI дамжуулаагүй бол яах вэ?

PR (Pull Request) дээр **merge хийж болохгүй**. Ингэснээр буруу код production-д орохгүй.

---

## 🔐 .env файлууд — Нууц мэдээлэл

**Зүйрлэл:** Тусгай хаалга нээх код бодоорой. Тэр кодыг цаас дээр бичээд хүн бүрт түгээхгүй — зөвхөн мэдэх ёстой хүмүүст хэлнэ. `.env` файл бол app-ийн нууц мэдээлэл — database password, API key гэх мэт.

```bash
# .env.local (ЭНЭ ФАЙЛЫГ GIT-Д ХЭЗЭЭ Ч НЭМЭХГҮЙ!)

# Supabase холболт
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # ⚠️ Маш нууц!

# OpenAI
OPENAI_API_KEY=sk-...

# Facebook
FACEBOOK_APP_SECRET=abc123...

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# Sentry
SENTRY_DSN=https://...@sentry.io/...
```

### Яагаад .env-г Git-д нэмдэггүй вэ?

`.gitignore` файлд:

```
.env
.env.local
.env.production
```

Хэрэв `.env`-г Git-д push хийвэл:
1. GitHub дээр БҮГД харна — database password, API key-г хулгайлна
2. Халдагч таны database-г устгана эсвэл OpenAI-д таны нэрээр 1 сая хүсэлт илгээнэ
3. Bot-ууд GitHub-г сканнердаж, `.env` файлыг **секундэд** олно!

### Vercel дээр .env яаж тохируулах вэ?

Vercel Dashboard → Project → Settings → Environment Variables дотор нэмнэ. Code-д биш, Vercel-ийн аюулгүй сан дотор хадгалагдана.

---

## 🎯 Дасгал

### Дасгал 1: Git command
Дараах үйлдэлд ямар git command хэрэглэх вэ?

1. Шинэ feature бичихэд тусдаа branch үүсгэх
2. Хийсэн өөрчлөлтийг хадгалах
3. GitHub руу илгээх
4. Юу өөрчлөгдсөнийг харах

<details>
<summary>💡 Хариу харах</summary>

1. `git checkout -b feature/new-feature`
2. `git add . && git commit -m "feat: шинэ feature"`
3. `git push`
4. `git status` эсвэл `git diff`
</details>

### Дасгал 2: .env аюулгүй байдал
Дараах утгуудын алийг нь `.env`-д хадгалах вэ, алийг нь code дотор бичиж болох вэ?

1. `SUPABASE_SERVICE_ROLE_KEY`
2. Вэб сайтын нэр: `"Temuulel Commerce"`
3. `OPENAI_API_KEY`
4. Rate limit тоо: `10`

<details>
<summary>💡 Хариу харах</summary>

1. `.env` — маш нууц, admin эрхтэй түлхүүр
2. Code дотор — нийтийн мэдээлэл
3. `.env` — API түлхүүр нууц
4. Code дотор — нууц биш, тохиргоо
</details>

---

👉 **Дараагийн хичээл:** [08-ai-nlp-chatbot.md](./08-ai-nlp-chatbot.md) — AI & NLP Chatbot
