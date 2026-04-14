#!/usr/bin/env python3
"""
Extract customer messages from Facebook exports 6 & 7,
auto-label with keyword classifier, merge into training-data.json
"""
import json, os, re, sys
from collections import Counter

# ── Config ──────────────────────────────────────────────────────────
FB_BASE = "/Users/nyamgerelshijir/Downloads/facebook data"
FB_DIRS = [
    f"{FB_BASE}/this_profile's_activity_across_facebook_6",
    f"{FB_BASE}/this_profile's_activity_across_facebook_7",
]
STORE_NAMES = {"GOOD TRADE", "Sunny store"}
TRAINING_DATA = "src/lib/ai/training-data.json"
OUTPUT_RAW = "scripts/data/fb-raw-messages-67.json"
OUTPUT_LABELED = "scripts/data/fb-labeled-67.json"

# ── Intent keyword rules (Mongolian ecommerce) ─────────────────────
INTENT_RULES = {
    "greeting": {
        "keywords": [
            r"\bсайн\s*байна\s*уу\b", r"\bсайн\s*уу\b", r"\bбайна\s*уу\b",
            r"\bбну\b", r"\bсайхан\s*амраарай\b", r"\bөглөө\s*мэнд\b",
            r"\bмэнд\b", r"\bhello\b", r"\bhi\b", r"\bсайн\b(?!.*[үүнэхэд])",
            r"\bздр\b", r"\bздравствуйте\b",
        ],
        "weight": 1.5,
    },
    "product_search": {
        "keywords": [
            r"юу\s*(сайн|байна|бэ)", r"бараа", r"ямар\s*ямар", r"төрөл",
            r"шинэ\s*бараа", r"бий\s*юу", r"байна\s*уу\s*\?",
            r"ямар.*байна", r"хайж\s*байна", r"үлдсэн", r"нөөц",
            r"стокт", r"stock", r"бий\s*юу", r"бий\s*болсон",
            r"авахаар\s*бэлэн", r"бэлэн\s*бий", r"байгаа\s*юу",
            r"энэ\s*юу\s*вэ", r"ямар\s*үнэ", r"хэд\s*вэ",
        ],
        "weight": 1.0,
    },
    "order_collection": {
        "keywords": [
            r"захиал", r"авъя", r"авья", r"авмаар", r"авах\s*гэсэн",
            r"авна\s*шүү", r"авна\s*шв", r"авах\s*вэ", r"авах\s*уу",
            r"авахаар", r"авна\b", r"авч\s*болох", r"захиалга",
            r"захиалах", r"order", r"авлаа", r"авсан",
            r"\d+\s*ш(ирхэг)?", r"авъяа", r"авмаар\s*байна",
            r"аваад\s*өгөөч", r"авмаар\s*бна",
        ],
        "weight": 1.2,
    },
    "shipping": {
        "keywords": [
            r"хүргэлт", r"хүргэ", r"хаяг", r"хот\s*хоорондын",
            r"орон\s*нутаг", r"шуудан", r"хүргүүл", r"хүргэнэ\s*үү",
            r"давхар.*тоот", r"байр.*тоот", r"хороо.*хороолол",
            r"дүүрэг", r"аймаг", r"сум", r"баг",
            r"хаягаа\s*өгье", r"хүргэж\s*өг", r"deliver",
            r"код\s*#?\d+", r"орцны\s*код",
        ],
        "weight": 1.3,
    },
    "size_info": {
        "keywords": [
            r"\b[xX]?[sSmMlLxX]{1,3}\b", r"размер", r"хэмжээ",
            r"\b\d{2,3}\s*кг\b", r"\b\d{2,3}\s*см\b",
            r"өндөр\s*\d+", r"жин\s*\d+", r"биед\s*тохирох",
            r"size", r"том\s*юм\s*уу", r"жижиг\s*юм\s*уу",
        ],
        "weight": 1.1,
    },
    "order_status": {
        "keywords": [
            r"хэзээ\s*(ирэх|хүрэх|бэлэн)", r"захиалга.*хаана",
            r"илгээсэн\s*үү", r"явуулсан\s*уу", r"ирсэн\s*үү",
            r"хэдэн\s*хоног", r"хүлээж\s*байна", r"мэдээлэл",
            r"трек", r"track", r"status", r"хаана\s*явж",
        ],
        "weight": 1.2,
    },
    "payment": {
        "keywords": [
            r"төлбөр", r"шилжүүл", r"данс", r"хаан\s*банк",
            r"голомт", r"төг", r"₮", r"мөнгө", r"qpay", r"QPay",
            r"шилжүүлсэн", r"төлсөн", r"баримт", r"нэхэмжлэх",
            r"\d{4}\s*\d{4}", r"social\s*pay", r"lend",
        ],
        "weight": 1.3,
    },
    "complaint": {
        "keywords": [
            r"гомдол", r"буруу", r"андуур", r"эвдэр", r"муу\s*чанар",
            r"хуурамч", r"залил", r"таарахгүй", r"тохирохгүй",
            r"сэтгэл\s*дундуур", r"гэмтэ", r"хагар",
        ],
        "weight": 1.5,
    },
    "return_exchange": {
        "keywords": [
            r"буцаа", r"солих", r"солиул", r"буцааж", r"return",
            r"exchange", r"өөрчлөх", r"сольж\s*болох",
        ],
        "weight": 1.4,
    },
    "thanks": {
        "keywords": [
            r"баярлалаа", r"гоё", r"гое", r"маш\s*их", r"рахмат",
            r"thanks", r"thank\s*you", r"мундаг", r"баярлаа",
            r"амжилт", r"баярласан",
        ],
        "weight": 1.3,
    },
    "menu_availability": {
        "keywords": [
            r"цэс", r"menu", r"жагсаалт", r"каталог", r"catalog",
        ],
        "weight": 1.0,
    },
}


def fix_encoding(text: str) -> str:
    """Fix Facebook's double-encoded UTF-8"""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def classify(text: str) -> tuple[str, float]:
    """Keyword-based intent classification. Returns (intent, confidence)."""
    text_lower = text.lower()
    scores: dict[str, float] = {}

    for intent, rule in INTENT_RULES.items():
        matches = 0
        for pattern in rule["keywords"]:
            if re.search(pattern, text_lower):
                matches += 1
        if matches > 0:
            scores[intent] = matches * rule["weight"]

    if not scores:
        return ("unknown", 0.0)

    best = max(scores, key=lambda k: scores[k])
    confidence = min(scores[best] / 3.0, 1.0)  # normalize to 0-1
    return (best, round(confidence, 2))


def is_valid_message(text: str) -> bool:
    """Filter: real customer text, not system/gibberish."""
    if len(text) < 3 or len(text) > 300:
        return False
    has_cyrillic = bool(re.search(r"[а-яөүёА-ЯӨҮЁ]{2,}", text))
    has_latin = bool(re.search(r"\b[a-zA-Z]{2,}\b", text))
    has_digits = bool(re.search(r"\d{4,}", text))  # phone numbers etc
    no_gibberish = not re.search(r"(.)\1{4,}", text)
    not_system = not any(
        x in text.lower()
        for x in [
            "sent an attachment", "sent a photo", "liked a message",
            "get started", "начать", "auto-label", "lead stage",
            "reacted", "removed the poll", "pinned a message",
            "named the group", "changed the theme", "set the nickname",
        ]
    )
    return (has_cyrillic or has_latin or has_digits) and no_gibberish and not_system


# ── Step 1: Extract messages ───────────────────────────────────────
print("Step 1: Extracting customer messages from FB exports 6 & 7...")
all_messages = []
file_count = 0

for d in FB_DIRS:
    for root, _, files in os.walk(d):
        for fname in files:
            if fname.startswith("message_") and fname.endswith(".json"):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r") as f:
                        data = json.load(f)
                    for msg in data.get("messages", []):
                        sender = fix_encoding(msg.get("sender_name", ""))
                        if sender in STORE_NAMES:
                            continue  # skip our own messages
                        if "content" not in msg:
                            continue
                        content = fix_encoding(msg["content"])
                        if is_valid_message(content):
                            all_messages.append(content.strip())
                    file_count += 1
                except Exception:
                    pass

unique = list(set(all_messages))
print(f"  Processed {file_count} files")
print(f"  Found {len(all_messages)} customer messages, {len(unique)} unique")

# Save raw
os.makedirs("scripts/data", exist_ok=True)
with open(OUTPUT_RAW, "w") as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)
print(f"  Saved raw → {OUTPUT_RAW}")

# ── Step 2: Classify ───────────────────────────────────────────────
print("\nStep 2: Classifying messages...")
labeled = []
intent_counts = Counter()
skipped = 0

for text in unique:
    intent, confidence = classify(text)
    if intent == "unknown" or confidence < 0.3:
        skipped += 1
        continue
    labeled.append({"text": text, "intent": intent, "confidence": confidence})
    intent_counts[intent] += 1

with open(OUTPUT_LABELED, "w") as f:
    json.dump(labeled, f, ensure_ascii=False, indent=2)

print(f"  Labeled: {len(labeled)}, Skipped (low confidence): {skipped}")
print(f"  Intent distribution:")
for intent, count in intent_counts.most_common():
    print(f"    {intent}: {count}")

# ── Step 3: Load existing training data and deduplicate ────────────
print(f"\nStep 3: Merging into {TRAINING_DATA}...")
with open(TRAINING_DATA, "r") as f:
    existing = json.load(f)

existing_texts = {item["text"] for item in existing}
print(f"  Existing training data: {len(existing)}")

new_items = []
for item in labeled:
    if item["text"] not in existing_texts:
        new_items.append({"text": item["text"], "intent": item["intent"]})
        existing_texts.add(item["text"])

print(f"  New unique items to add: {len(new_items)}")

if new_items:
    merged = existing + new_items
    with open(TRAINING_DATA, "w") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Merged! New total: {len(merged)}")

    # Show new distribution
    final_counts = Counter()
    for item in merged:
        final_counts[item["intent"]] = final_counts.get(item["intent"], 0) + 1
    print(f"\n  Final intent distribution:")
    for intent, count in sorted(final_counts.items(), key=lambda x: -x[1]):
        print(f"    {intent}: {count}")
else:
    print("  No new items to add.")

print("\n✅ Done!")
