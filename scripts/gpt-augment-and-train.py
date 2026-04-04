#!/usr/bin/env python3
"""Use GPT-4o-mini to augment weak intents, then retrain BERT."""

import json
import os
import random
import time
from pathlib import Path
from collections import Counter

# ── Config ──
DATA_PATH = Path("src/lib/ai/training-data.json")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")

# Load from .env.local if not in env
if not OPENAI_KEY:
    env_path = Path(".env.local")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                OPENAI_KEY = line.split("=", 1)[1].strip().strip('"')
                break

if not OPENAI_KEY:
    raise RuntimeError("No OPENAI_API_KEY found")

import openai
client = openai.OpenAI(api_key=OPENAI_KEY)

# ── Load existing data ──
with open(DATA_PATH) as f:
    data = json.load(f)

counts = Counter(d["intent"] for d in data)
print("CURRENT distribution:")
for intent, count in counts.most_common():
    print(f"  {intent}: {count}")
print(f"  TOTAL: {len(data)}")

# ── Define intents that need augmentation ──
# Target: bring weak intents up to ~500 each
INTENT_DESCRIPTIONS = {
    "greeting": "Мэндчилгээ, сайн байна уу, юу байна гэх мэт. Хэрэглэгч чатботтой анх ярилцаж эхлэхэд хэлдэг үгс.",
    "thanks": "Баярлалаа, гоё, сайн, тэнкс гэх мэт. Хэрэглэгч хариултад сэтгэл хангалуун байгааг илэрхийлэх.",
    "complaint": "Гомдол, санал гомдол, муу үйлчилгээ, удаан, эвдэрсэн, чанар муу гэх мэт. Хэрэглэгч сэтгэл дундуур байгааг илэрхийлэх.",
    "return_exchange": "Буцаалт, солилт, буцааж болох уу, солиулъя, хэмжээ тохирохгүй гэх мэт.",
    "payment": "Төлбөр, данс, QPay, карт, шилжүүлэг, нэхэмжлэх гэх мэт.",
    "menu_availability": "Цэс, бүтээгдэхүүний жагсаалт, юу байна, каталог, үнийн жагсаалт гэх мэт.",
    "table_reservation": "Ширээ захиалга, суудал авах, reservation, хэдэн хүн гэх мэт. Ресторан/кафе-д ширээ захиалах.",
    "allergen_info": "Харшил, аллерги, тэсвэршил, глютен, лактоз, самрын харшил гэх мэт. Хоолны найрлага, харшлын мэдээлэл асуух.",
    "general": "Ерөнхий асуулт, бусад ангилалд хамаарахгүй асуултууд. Жишээ нь: хаяг хаана вэ, хэдэн цагт ажилладаг, утас хэд вэ.",
    "order_status": "Захиалгын явц, хаана байна, хэзээ ирэх, tracking, захиалга шалгах.",
    "size_info": "Хэмжээ, размер, S/M/L/XL, хэмжээний хүснэгт, ямар размер тохирох.",
}

# How many examples to generate per intent
TARGETS = {}
for intent, count in counts.items():
    if count < 400:
        TARGETS[intent] = 400 - count
    elif count < 600:
        TARGETS[intent] = 200

print(f"\nWill augment {len(TARGETS)} intents:")
for intent, needed in TARGETS.items():
    print(f"  {intent}: +{needed} (current: {counts[intent]})")

# ── Generate with GPT-4o-mini ──
all_new = []

for intent, needed in TARGETS.items():
    desc = INTENT_DESCRIPTIONS.get(intent, f"{intent} intent")
    existing_examples = [d["text"] for d in data if d["intent"] == intent][:20]
    examples_str = "\n".join(f"- {e}" for e in existing_examples)

    prompt = f"""Монгол хэлээр ecommerce чатбот-д зориулсан training data үүсгэ.

Intent: {intent}
Тайлбар: {desc}

Одоо байгаа жишээнүүд:
{examples_str}

Дүрэм:
1. {needed} ширхэг ШИНЭ, ДАВТАГДААГҮЙ жишээ үүсгэ
2. Бодит хэрэглэгчид бичдэг шиг байх (богино, аяндаа, заримдаа алдаатай)
3. Кирилл болон латин (монгол залуусын бичдэг) хольж бич (жишээ: "sain bnu", "zahialga haana bn")
4. Заримыг emoji-тай бич (жишээ: "баярлалаа 🙏", "хэзээ ирэх вэ 😤")
5. Заримыг маш богино бич (1-3 үг)
6. Заримыг урт бич (бүтэн өгүүлбэр)
7. Бүгдийг JSON array болгож өг

Зөвхөн JSON array буцаа, өөр тайлбар бичих хэрэггүй:
["жишээ 1", "жишээ 2", ...]"""

    print(f"\n→ Generating {needed} examples for '{intent}'...")

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.9,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": "You generate Mongolian language training data for an ecommerce chatbot. Output ONLY valid JSON arrays."},
                {"role": "user", "content": prompt}
            ]
        )

        content = response.choices[0].message.content.strip()
        # Clean markdown code blocks if any
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]

        examples = json.loads(content)

        for text in examples:
            if isinstance(text, str) and text.strip():
                all_new.append({"text": text.strip(), "intent": intent})

        print(f"  ✓ Got {len(examples)} examples")
        tokens = response.usage.total_tokens if response.usage else 0
        print(f"  Tokens used: {tokens}")

        time.sleep(0.5)  # Rate limit

    except Exception as e:
        print(f"  ✗ Error: {e}")

print(f"\n{'='*60}")
print(f"Total new examples generated: {len(all_new)}")

# ── Deduplicate ──
existing_texts = {d["text"].lower().strip() for d in data}
unique_new = [e for e in all_new if e["text"].lower().strip() not in existing_texts]
print(f"After dedup: {len(unique_new)} unique new examples")

# ── Merge ──
merged = data + unique_new

# ── Balance: cap product_search at 2000 ──
product_search = [d for d in merged if d["intent"] == "product_search"]
other = [d for d in merged if d["intent"] != "product_search"]
random.seed(42)
if len(product_search) > 2000:
    product_search = random.sample(product_search, 2000)
balanced = other + product_search
random.shuffle(balanced)

# ── Remove tiny intents (< 5 examples) ──
final_counts = Counter(d["intent"] for d in balanced)
valid_intents = {k for k, v in final_counts.items() if v >= 5}
balanced = [d for d in balanced if d["intent"] in valid_intents]

final_counts = Counter(d["intent"] for d in balanced)
print(f"\nFINAL distribution ({len(balanced)} total):")
for intent, count in final_counts.most_common():
    print(f"  {intent}: {count}")

# ── Save ──
with open(DATA_PATH, 'w') as f:
    json.dump(balanced, f, ensure_ascii=False, indent=2)
print(f"\n✅ Saved to {DATA_PATH}")
