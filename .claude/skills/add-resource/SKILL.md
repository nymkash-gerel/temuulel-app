---
name: "add-resource"
description: Тэмүүлэлд шинэ resource (хүснэгт + API + dashboard хуудас + feature flag) нэмэх бүрэн урсгал. CLAUDE.md-ийн 6 алхамт хэв маягийг алхам алгасахгүй гүйцэтгэнэ. "шинэ модель нэм", "шинэ resource/entity нэм", "add a new resource/entity/table", "add-resource" гэхэд ашигла.
argument-hint: <resource-нэр (жишээ: loyalty-points)>
---

# Шинэ resource нэмэх

Тэмүүлэлд шинэ resource нэмэх **6 алхамыг ЯГ дарааллаар нь** гүйцэтгэ. Алхам бүрийн дараа шалгаж байж дараагийнх руу шилж. store_id + RLS-ийг ХЭЗЭЭ Ч бүү март — энэ бол multi-tenant SaaS.

Resource нэрийг snake_case (хүснэгт) ба kebab-case (route/хуудас)-аар тодорхойл. Жишээ: `loyalty_points` (хүснэгт) → `/dashboard/loyalty-points` (хуудас).

## Алхам 1 — Migration

`supabase/migrations/NNN_<resource>.sql` үүсгэ.

- **Дугаар:** дараагийн дугаарыг `ls supabase/migrations/ | tail -1`-ээр бодитоор шалга (гараар бүү тааварла). Одоо хамгийн сүүлийнх нь `076_*`, тэгэхээр дараагийнх `077_*`.
- **store_id багана ЗААВАЛ** нэм (`store_id uuid not null references stores(id) on delete cascade`).
- **RLS идэвхжүүл:** `alter table <resource> enable row level security;`
- **store тусгаарлалтын policy** нэм — store owner + store_members зөвхөн өөрсдийн store-ийн мөрийг харах/бичих. `USING (true)` / `WITH CHECK (true)` төрлийн задгай policy бүү бич (энэ нь security audit-д улаан туг болно).
- Ихэвчлэн query хийх багана (store_id, foreign key, status)-д **индекс** нэм.
- `created_at timestamptz default now()` нэм.

Одоо байгаа migration-ийг загвар болго — `supabase/migrations/072_*.sql` эсвэл түүнээс хойшхыг унш.

## Алхам 2 — Type

`src/lib/database.types.ts`-д шинэ хүснэгтийн Row / Insert / Update type нэм. Одоо байгаа хүснэгтийн загварыг дага.

## Алхам 3 — Validation

`src/lib/validations.ts`-д Zod schema нэм (create + update). `store_id`-г серверт тавих тул client schema-д ЗААВАЛ шаардахгүй — auth-аас авна.

## Алхам 4 — API routes

- `src/app/api/<resource>/route.ts` — GET (list) + POST (create)
- `src/app/api/<resource>/[id]/route.ts` — GET + PATCH + DELETE

Дүрэм:
- **Rate limit ЗААВАЛ** нэм (`src/lib/rate-limit.ts` эсвэл middleware global tier-ийг шалга).
- **Server-side Supabase client** ашигла (`src/lib/supabase/server.ts`). Service-role (`admin.ts`/`service.ts`) хэрэглэвэл store харьяаллыг гараар шалга.
- **`supabase.auth.getUser()`-ээр батал** — client-ийн дамжуулсан `user_id`/`store_id`-д ХЭЗЭЭ Ч бүү итгэ. store_id-г auth хэрэглэгчийн эзэмшдэг store-оос ол.
- Body-г Алхам 3-ийн Zod schema-аар шалга.
- Одоо байгаа route-ийг загвар болго (жишээ: `src/app/api/vouchers/route.ts`).

## Алхам 5 — Dashboard хуудас

`src/app/dashboard/<resource>/page.tsx` үүсгэ.

- UI текст **Монголоор**, i18n-тэй (`src/lib/i18n/`).
- Одоо байгаа dashboard хуудсыг загвар болго.

## Алхам 6 — Feature flag (nav цэсэнд харагдах бол)

`src/lib/features.ts`-д 2 газар нэм:
1. `MODULE_REGISTRY` (≈14-р мөр) — `<resource>: { href: '/dashboard/<resource>', icon: '🎯', label: 'Монгол нэр', labelKey: 'nav.<resource>' }`
2. `DEFAULT_MODULES` (≈216-р мөр) — тухайн resource ямар business_type-д харагдах ёстой бол тэдгээрийн массивт нэрийг нэм.
3. `src/lib/i18n/`-д `nav.<resource>` орчуулга (MN + EN) нэм.

## Дуусгах шалгалт

1. `npm test` — бүх тест ногоон болтол зогсохгүй.
2. `npm run build` — 0 алдаа (CLAUDE.md шаардлага).
3. Шинэ route/lib-д тест байхгүй бол `test-writer` sub-agent-аар бичүүл (multi-tenant тусгаарлалтыг заавал тест хий).
4. Migration-ийг `migration-reviewer` sub-agent-аар шалгуул (байвал).
5. `as any` бүү хэрэглэ — гарцаагүй бол `as unknown as T` + тайлбар (CLAUDE.md).

## Known Issues (ажиллуулах бүрт энд сургамжаа бич)

<!--
Энэ skill-ийг ашиглах бүрд алдаа/гэнэтийн зүйл гарвал ЭНД бич — дараагийн удаа давтахгүй.
Формат: - [огноо] Юу болсон → яаж засав.
Жишээ:
- [2026-07-20] database.types.ts гараар засахад JSONB багана `Json` type болох ёстой байсан.
-->
