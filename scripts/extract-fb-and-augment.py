#!/usr/bin/env python3
"""Extract FB messages from folders 6+7, label with GPT-4o-mini, merge into training data."""

import json
import os
import re
import time
import random
from pathlib import Path
from collections import Counter

# ── Config ──
FB_DIRS = [
    Path.home() / "Downloads" / "facebook data" / "this_profile's_activity_across_facebook_6" / "messages" / "inbox",
    Path.home() / "Downloads" / "facebook data" / "this_profile's_activity_across_facebook_7" / "messages" / "inbox",
]
DATA_PATH = Path("src/lib/ai/training-data.json")
FB_RAW_PATH = Path("scripts/data/fb-raw-messages-v2.json")
FB_LABELED_PATH = Path("scripts/data/fb-labeled-v2.json")

# ── Load OpenAI key ──
OPENAI_KEY = ""
env_path = Path(".env.local")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            OPENAI_KEY = line.split("=", 1)[1].strip().strip('"')
            break

if not OPENAI_KEY:
    raise RuntimeError("No OPENAI_API_KEY found in .env.local")

import openai
client = openai.OpenAI(api_key=OPENAI_KEY)

# ── Fix Facebook Mojibake encoding ──
def fix_mojibake(text):
    """Facebook exports UTF-8 text as latin1-encoded bytes. Fix it."""
    try:
        return text.encode('latin1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text

# ── Extract messages ──
print("=" * 60)
print("STEP 1: Extracting FB messages...")
print("=" * 60)

all_messages = []
store_name = None  # Will detect the page/store name

for fb_dir in FB_DIRS:
    if not fb_dir.exists():
        print(f"  ⚠ Not found: {fb_dir}")
        continue

    for conv_dir in sorted(fb_dir.iterdir()):
        if not conv_dir.is_dir():
            continue

        for msg_file in sorted(conv_dir.glob("message_*.json")):
            try:
                with open(msg_file, encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                continue

            # Detect store name (the page owner)
            if store_name is None and 'participants' in data:
                for p in data['participants']:
                    name = fix_mojibake(p.get('name', ''))
                    # The store is likely the consistent participant
                    if 'store' in name.lower() or 'sunny' in name.lower() or 'good' in name.lower():
                        store_name = name

            for msg in data.get('messages', []):
                content = msg.get('content', '')
                if not content:
                    continue

                content = fix_mojibake(content)
                sender = fix_mojibake(msg.get('sender_name', ''))

                # Skip store's own messages - we want CUSTOMER messages
                if store_name and sender == store_name:
                    continue
                # Skip system messages
                if any(x in content.lower() for x in [
                    'liked a message', 'reacted', 'sent an attachment',
                    'sent a photo', 'sent a video', 'started a call',
                    'missed a call', 'sent a sticker', 'sent a gif',
                    'named the group', 'changed the theme',
                    'you sent', 'фото илгээлээ',
                ]):
                    continue

                # Filter: 2-300 chars, has some meaningful content
                content = content.strip()
                if len(content) < 2 or len(content) > 300:
                    continue

                # Must have at least some Cyrillic or Latin letters
                has_letters = bool(re.search(r'[а-яёөүА-ЯЁӨҮA-zA-Z]', content))
                if not has_letters:
                    continue

                # Skip gibberish (too many consonants in a row, etc)
                if re.search(r'[бвгджзклмнпрстфхцчшщ]{5,}', content.lower()):
                    continue

                all_messages.append(content)

# Deduplicate
unique_msgs = list(set(all_messages))
random.seed(42)
random.shuffle(unique_msgs)

print(f"  Total extracted: {len(all_messages)}")
print(f"  After dedup: {len(unique_msgs)}")
print(f"  Store name detected: {store_name}")
print(f"  Sample messages:")
for m in unique_msgs[:10]:
    print(f"    - {m}")

# Save raw
FB_RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(FB_RAW_PATH, 'w') as f:
    json.dump(unique_msgs, f, ensure_ascii=False, indent=2)
print(f"\n  Saved raw to {FB_RAW_PATH}")

# ── Label with GPT-4o-mini ──
print(f"\n{'=' * 60}")
print("STEP 2: Labeling with GPT-4o-mini...")
print("=" * 60)

INTENTS = [
    "greeting", "thanks", "complaint", "return_exchange", "payment",
    "menu_availability", "order_status", "order_collection", "shipping",
    "size_info", "product_search", "general", "table_reservation", "allergen_info"
]

BATCH_SIZE = 50  # messages per GPT call
labeled = []
total_tokens = 0

for i in range(0, len(unique_msgs), BATCH_SIZE):
    batch = unique_msgs[i:i+BATCH_SIZE]
    batch_num = i // BATCH_SIZE + 1
    total_batches = (len(unique_msgs) + BATCH_SIZE - 1) // BATCH_SIZE

    messages_text = "\n".join(f"{j+1}. {m}" for j, m in enumerate(batch))

    prompt = f"""Доорх мессежүүдийг ecommerce чатбот-д зориулж intent-ээр ангилна уу.

Боломжит intent-үүд:
- greeting: Мэндчилгээ (сайн байна уу, hi, hello)
- thanks: Баярлалаа, талархал
- complaint: Гомдол, сэтгэл дундуур
- return_exchange: Буцаалт, солилт
- payment: Төлбөр, данс, шилжүүлэг
- menu_availability: Цэс, бараа жагсаалт асуух
- order_status: Захиалгын явц шалгах
- order_collection: Захиалга хийх, авах, очиж авах
- shipping: Хүргэлт, хаяг
- size_info: Размер, хэмжээ асуух
- product_search: Бараа хайх, тодорхой бараа асуух
- general: Ерөнхий асуулт, дээрхэд хамаарахгүй
- table_reservation: Ширээ захиалга
- allergen_info: Харшил, найрлага асуух
- SKIP: Утгагүй, ойлгомжгүй, эсвэл чатбот-д хамааралгүй

Мессежүүд:
{messages_text}

JSON array буцаа. Жишээ: [{{"text": "...", "intent": "...", "confidence": 0.9}}, ...]
confidence: 0.0-1.0 (1.0 = маш итгэлтэй)
Утгагүй мессежийг SKIP гэж тэмдэглэ."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.1,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": "You label Mongolian ecommerce chat messages by intent. Output ONLY valid JSON arrays."},
                {"role": "user", "content": prompt}
            ]
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]

        batch_labeled = json.loads(content)
        tokens = response.usage.total_tokens if response.usage else 0
        total_tokens += tokens

        # Filter: keep high confidence, skip SKIP
        good = [x for x in batch_labeled if isinstance(x, dict)
                and x.get('intent', 'SKIP') != 'SKIP'
                and x.get('confidence', 0) >= 0.7
                and x.get('intent') in INTENTS]

        labeled.extend(good)
        print(f"  Batch {batch_num}/{total_batches}: {len(batch)} msgs → {len(good)} labeled (tokens: {tokens})")

        time.sleep(0.3)

    except Exception as e:
        print(f"  Batch {batch_num} ERROR: {e}")

print(f"\n  Total labeled: {len(labeled)}")
print(f"  Total tokens used: {total_tokens}")
print(f"  Est. cost: ~${total_tokens * 0.15 / 1_000_000:.3f}")

# Save labeled
with open(FB_LABELED_PATH, 'w') as f:
    json.dump(labeled, f, ensure_ascii=False, indent=2)

label_counts = Counter(x['intent'] for x in labeled)
print(f"\n  Label distribution:")
for intent, count in label_counts.most_common():
    print(f"    {intent}: {count}")

# ── Merge into training data ──
print(f"\n{'=' * 60}")
print("STEP 3: Merging into training-data.json...")
print("=" * 60)

with open(DATA_PATH) as f:
    existing = json.load(f)

existing_texts = {d["text"].lower().strip() for d in existing}
new_entries = []
for item in labeled:
    text = item["text"].strip()
    if text.lower() not in existing_texts:
        new_entries.append({"text": text, "intent": item["intent"]})
        existing_texts.add(text.lower())

merged = existing + new_entries
random.shuffle(merged)

final_counts = Counter(d["intent"] for d in merged)
print(f"\n  Existing: {len(existing)}")
print(f"  New from FB: {len(new_entries)}")
print(f"  Total merged: {len(merged)}")
print(f"\n  Final distribution:")
for intent, count in final_counts.most_common():
    print(f"    {intent}: {count}")

with open(DATA_PATH, 'w') as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"\n✅ Saved to {DATA_PATH}")
print(f"   Colab-д дахин upload хийгээд train хий!")
