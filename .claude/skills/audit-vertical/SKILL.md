---
name: "audit-vertical"
description: Нэг business_type (vertical)-ийн бүх модулийг page ↔ backend/RLS ↔ DB хүснэгт ↔ onboarding seed-ээр end-to-end тулгаж, шинэ бизнес бүртгэхэд бэлэн эсэхийг шалгана. "vertical шалга", "beauty salon бэлэн үү", "restaurant дутуу юу байна", "audit-vertical" гэхэд ашигла.
argument-hint: <business_type (жишээ: beauty_salon, restaurant, fitness)>
---

# Vertical бэлэн байдлын аудит

Өгсөн `business_type`-д ШИНЭ бизнес бүртгэхэд dashboard бэлэн, backend бүрэн ажиллагаатай эсэхийг end-to-end шалга. Зөвхөн тайлагна — код бүү зас. Олдвор бүрийг файл байгаа эсэхийг БОДИТООР шалгасны дараа л ✅ гэж бич (таамаг хориотой).

**Санамж:** Тэмүүлэлд beauty модулиуд `route.ts` API-аар биш, **Supabase client-ээр шууд** дата авч, тусгаарлалтыг **RLS policy** хангадаг. Тиймээс "API route байхгүй" нь заавал эвдрэл БИШ — RLS policy backend-ийн үүрэг гүйцэтгэнэ. Гол шалгуур: хуудас байгаа эсэх + дата эх сурвалж (route ЭСВЭЛ store_id+RLS-тэй хүснэгт) байгаа эсэх.

## Алхам 1 — Модулийн жагсаалт

`src/lib/features.ts`-ийн `DEFAULT_MODULES[<business_type>]`-ийг унш. (Байхгүй бол `TYPE_ALIASES`-аар alias-ыг шалга.) Энэ бол шалгах модулиудын жагсаалт.

## Алхам 2 — Модуль бүрийг тулга

Модуль бүрд:
1. **Хуудас:** `MODULE_REGISTRY[module].href`-ийг ол → тэр href-т тохирох `src/app/dashboard/**/page.tsx` бодитоор байгаа эсэхийг Glob-оор шалга. (Хэд хэдэн модуль нэг href рүү заадгийг анхаар.)
2. **Backend:** хуудас ямар дата авдгийг ол —
   - `route.ts` API дуудвал: тэр `src/app/api/**/route.ts` байгаа, GET/POST/PATCH-тэй эсэх.
   - Supabase client шууд (`.from(...)`) дуудвал: тухайн хүснэгт RLS-тэй эсэх (Алхам 3).
3. **DB хүснэгт:** дата хүснэгт `supabase/migrations/`-д байгаа, `store_id` багана + `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`-той эсэх.

## Алхам 3 — Onboarding урсгал

Шинэ бизнес бүртгэх 2 урсгалыг шалга:
- `src/app/(auth)/signup/page.tsx` — тухайн business_type сонголтод байгаа эсэх; store үүсгэх; `/api/templates/apply` seed дуудах эсэх.
- `src/app/onboarding/page.tsx` — business_type сонголтод байгаа эсэх; store + store_members үүсгэх; template seed дуудах эсэх.
- `src/lib/industry-templates.ts`-д тухайн vertical-д sample дата (services/products) + chatbot тохиргоо байгаа эсэх — шинэ бизнес хоосон биш "амьд" dashboard-той эхлэх үү?
- Модуль resolve: шинэ store-д `enabled_modules` null үед `DEFAULT_MODULES[type]` ажиллаж нав цэс зөв гарах эсэх (`resolveFeatures`/`getNavItems`).

## Гаралт (Монголоор)

Хүснэгт: `Модуль | Хуудас (✅/❌+зам) | Backend (✅/❌+зам эсвэл "RLS") | DB хүснэгт (✅/❌) | Тэмдэглэл`

Дараа нь:
- **Бэлэн модулиуд** (3 давхарга бүрэн)
- **Дутуу/эвдэрсэн** — нав дээр гарах ч хуудас/backend/хүснэгт дутуу (үйлчлүүлэгчид харагдах эрсдэл). Байхгүй бол "олдсонгүй".
- **Onboarding дүгнэлт** — шинэ бизнес бүртгэхэд юу болох, seed хийгддэг эсэх, 2 урсгалын зөрүү.
- **Ерөнхий дүгнэлт:** "шинэ <business_type> үйлчлүүлэгчид үзүүлэхэд бэлэн үү?" — ТИЙМ/ҮГҮЙ + гол шалтгаан.

## Known Issues (ажиллуулах бүрт энд сургамжаа бич)

<!--
- [2026-07-20] beauty_salon аудитаас: модулиуд route.ts-гүй, RLS дээр тулгуурладаг нь зориудынх — "API байхгүй"-г эвдрэл гэж бүү тэмдэглэ. Onboarding wizard нь signup-аас ялгаатай (seed зөрүү) байсныг олсон.
- [2026-07-20] Бүх 32 vertical аудитаас илэрсэн СИСТЕМИЙН хэв маягууд (дараагийн аудитад эдгээрийг тусад нь шалга):
  * "Хагас модуль" хэв маяг: nav href нь /dashboard/<x> руу заадаг ч зөвхөн [id]/page.tsx (detail) байдаг, list page.tsx байхгүй → nav дарахад 404. Backend+DB бэлэн байсан ч. Жишээ: photography/photo_galleries, venue/venue_bookings, retail/stock_transfers, legal/case_documents, construction/project_tasks. ЗААВАЛ MODULE_REGISTRY href → dashboard/<href>/page.tsx (яг list түвшин) байгааг шалга.
  * "Orphan vertical" хэв маяг: DEFAULT_MODULES-д байгаа ч signup+onboarding аль алинд байхгүй → шинэ бизнес сонгож ЧАДАХГҮЙ. Жишээ: cafe, services, guesthouse, clinic, training_center. signup (~26 төрөл) ба onboarding (~11 төрөл) жагсаалт ЗӨРҮҮТЭЙ — хоёуланг тулга.
  * "id зөрүү" хэв маяг: signup дахь business_type товч template id-тай таарахгүй → getTemplate() undefined → seed 0 → хоосон dashboard. Жишээ: gym товч ↔ fitness template id.
  * Template ердөө 8 (industry-templates.ts): restaurant, hospital, beauty_salon, coffee_shop, fitness, education, dental_clinic, real_estate. Бусад 24 нь сонгож болох ч seed=0 → хоосон эхэлнэ.
  * Бодит дата алдаа: real_estate/commissions хуудас staff_commissions уншдаг ч generate нь agent_commissions руу бичдэг → комисс хэзээ ч харагдахгүй. Хүснэгт нэрийн зөрүүг заавал ажиглах.
-->
