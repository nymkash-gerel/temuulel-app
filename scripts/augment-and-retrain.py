#!/usr/bin/env python3
"""Augment weak intents + balance classes + retrain BERT with better hyperparams."""

import json
import random
import re
from pathlib import Path
from collections import Counter

DATA_PATH = Path("src/lib/ai/training-data.json")

# ── Load existing data ──
with open(DATA_PATH) as f:
    data = json.load(f)

counts = Counter(d["intent"] for d in data)
print("BEFORE augmentation:")
for intent, count in counts.most_common():
    print(f"  {intent}: {count}")

# ── Latin transliteration map ──
CYRILLIC_TO_LATIN = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j',
    'з':'z','и':'i','й':'i','к':'k','л':'l','м':'m','н':'n','о':'o',
    'ө':'u','п':'p','р':'r','с':'s','т':'t','у':'u','ү':'u','ф':'f',
    'х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sh','ъ':'','ы':'y','ь':'',
    'э':'e','ю':'yu','я':'ya'
}

def to_latin(text):
    return ''.join(CYRILLIC_TO_LATIN.get(c, c) for c in text.lower())

# ── Typo generator ──
def add_typo(text):
    if len(text) < 5: return text
    chars = list(text)
    i = random.randint(1, len(chars)-2)
    r = random.random()
    if r < 0.3:  # swap adjacent
        chars[i], chars[i+1] = chars[i+1], chars[i]
    elif r < 0.6:  # drop char
        chars.pop(i)
    else:  # duplicate char
        chars.insert(i, chars[i])
    return ''.join(chars)

# ── Informal shortener ──
def shorten(text):
    text = text.replace('байна уу', 'бну')
    text = text.replace('байгаа', 'бга')
    text = text.replace('болох уу', 'блху')
    text = text.replace('хэрэгтэй', 'хэрэгт')
    text = text.replace('үү', 'у')
    return text

# ── Augment weak intents ──
WEAK_INTENTS = {
    'complaint': [
        'яагаад ийм удаан бэ', 'юу болоод байгаа юм', 'хэзээ ирэх юм',
        'маш удаан', 'удаан болж байна', 'ирэхгүй байна', 'хариу өгөхгүй байна',
        'муу үйлчилгээ', 'хэтэрхий удаан', 'яагаад хариулахгүй байгаа юм',
        'гомдол гаргах', 'удаан хүлээлгэж байна', 'барааг буруу илгээсэн',
        'эвдэрсэн ирсэн', 'чанар муу', 'хэзээ шийдэх юм', 'асуудалтай байна',
        'гомдолтой байна', 'энэ юу вэ ийм муу', 'дахиж авахгүй',
        'шийдвэрлэж өгөөч', 'менежертэй ярих', 'хариуцлагагүй',
        'буцааж өгөөч мөнгөө', 'яагаад буруу юм илгээсэн бэ',
        'хүнтэй холбож өгөөч', 'хэн хариуцдаг юм', 'тун муу байна',
        'дуудлага хийж өгөөч', 'захирал хаана байна',
    ],
    'return_exchange': [
        'солиулж болох уу', 'буцааж болох уу', 'буцаалт хийх',
        'солих боломжтой юу', 'өөр размер авъя', 'тохирохгүй байна солиулъя',
        'буцаах бодож байна', 'солих уу', 'энийг буцаая', 'буцаалт',
        'хэмжээ тохирохгүй солиулна', 'өнгө таалагдахгүй байна буцаая',
        'буруу юм ирсэн солиулна', 'буцааж мөнгөө авъя', 'солилцох',
        'өөр юм авъя', 'энийг нь сольчихоорой', 'хэмжээ том байна',
        'хэмжээ жижиг байна', 'тохирохгүй', 'буцаах хүсэлт',
        'солих хүсэлт', 'буцааж авч болох уу', 'солих боломж',
        'сольж болох уу', 'буцааж авна уу', 'солилт хийнэ',
    ],
    'thanks': [
        'баярлалаа', 'гоё', 'сайхан', 'баярлаа', 'маш сайн',
        'рахмат', 'тэнкс', 'зүгээр зүгээр', 'ок баярлалаа',
        'харин тийм баярлалаа', 'баярлалаа ойлголоо', 'гайгүй баярлаа',
        'тийм ээ баярлалаа', 'зааж өгсөнд баярлалаа', 'их баярлалаа',
        'хариулсанд баярлалаа', 'мэдээлэлд баярлалаа',
    ],
    'greeting': [
        'сайн байна уу', 'сайн уу', 'юу байна', 'халло',
        'hi', 'hello', 'ямар байна', 'мэнд', 'зугаатай юу',
    ],
    'payment': [
        'төлбөр хийх', 'хэрхэн төлөх вэ', 'данс руу шилжүүлэх',
        'qpay байна уу', 'картаар төлж болох уу', 'бэлнээр төлнө',
        'нэхэмжлэх илгээгээрэй', 'данс хэд вэ', 'шилжүүлэг хийлээ',
        'төлбөрөө хийлээ', 'мөнгө шилжүүллээ', 'хэдэн дансанд шилжүүлэх',
        'дансны дугаар өгнө үү', 'QR код', 'qr илгээгээрэй',
    ],
    'menu_availability': [
        'цэс байна уу', 'юу юу байна', 'менютэй юу', 'юу зарж байна',
        'бүтээгдэхүүнүүдээ харуулаач', 'жагсаалт', 'каталог', 'цэсээ харуулаач',
        'юу юу байгаа вэ', 'бүх бараа', 'нийт бараа', 'хоолны цэс',
        'ундааны цэс', 'үнийн жагсаалт', 'прайс лист',
    ],
}

new_examples = []

for intent, templates in WEAK_INTENTS.items():
    # Add originals
    for t in templates:
        new_examples.append({"text": t, "intent": intent})
    
    # Latin versions
    for t in templates:
        latin = to_latin(t)
        new_examples.append({"text": latin, "intent": intent})
    
    # Typo versions
    for t in templates:
        new_examples.append({"text": add_typo(t), "intent": intent})
    
    # Shortened versions
    for t in templates[:10]:
        s = shorten(t)
        if s != t:
            new_examples.append({"text": s, "intent": intent})

# ── Deduplicate ──
existing_texts = {d["text"].lower().strip() for d in data}
unique_new = [e for e in new_examples if e["text"].lower().strip() not in existing_texts]
print(f"\nNew augmented examples: {len(unique_new)}")

# ── Merge ──
merged = data + unique_new

# ── Undersample product_search (4520 → 2000) ──
product_search = [d for d in merged if d["intent"] == "product_search"]
other = [d for d in merged if d["intent"] != "product_search"]
random.seed(42)
product_search_sampled = random.sample(product_search, min(2000, len(product_search)))
balanced = other + product_search_sampled
random.shuffle(balanced)

counts_after = Counter(d["intent"] for d in balanced)
print(f"\nAFTER augmentation + balancing ({len(balanced)} total):")
for intent, count in counts_after.most_common():
    print(f"  {intent}: {count}")

# ── Save ──
with open(DATA_PATH, 'w') as f:
    json.dump(balanced, f, ensure_ascii=False, indent=2)
print(f"\nSaved to {DATA_PATH}")
