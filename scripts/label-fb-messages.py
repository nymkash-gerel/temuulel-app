#!/usr/bin/env python3
"""Extract FB messages and auto-label using existing classifier via Node.js"""
import json, glob, re, subprocess, sys

# 1. Extract all useful messages from FB export
print("Step 1: Extracting FB messages...")
patterns = [
    '/tmp/fb-export-5/this_profile*s_activity_across_facebook/messages/filtered_threads/*/message_*.json',
    '/tmp/fb-export-5/this_profile*s_activity_across_facebook/messages/archived_threads/*/message_*.json',
    '/tmp/fb-export-5/this_profile*s_activity_across_facebook/messages/inbox/*/message_*.json',
]
files = []
for p in patterns:
    files.extend(glob.glob(p))

messages = []
for f in files:
    try:
        with open(f, 'r') as fh:
            data = json.load(fh)
            for msg in data.get('messages', []):
                if msg.get('sender_name') != 'GOOD TRADE' and 'content' in msg:
                    content = msg['content']
                    try:
                        content = content.encode('latin-1').decode('utf-8')
                    except: pass
                    # Filter: real text, not gibberish
                    has_cyrillic = bool(re.search(r'[а-яөүёА-ЯӨҮЁ]{3,}', content))
                    has_latin = bool(re.search(r'\b[a-zA-Z]{3,}\b', content))
                    no_gibberish = not re.search(r'(.)\1{4,}', content)
                    not_system = not any(x in content.lower() for x in ['sent an attachment', 'sent a photo', 'liked a message', 'get started', 'начать'])
                    if (has_cyrillic or has_latin) and no_gibberish and not_system and 5 < len(content) < 300:
                        messages.append(content.strip())
    except: pass

# Deduplicate
unique = list(set(messages))
print(f"  Found {len(messages)} messages, {len(unique)} unique")

# Save raw messages
with open('scripts/data/fb-raw-messages.json', 'w') as f:
    json.dump(unique, f, ensure_ascii=False, indent=2)
print(f"  Saved to scripts/data/fb-raw-messages.json")
print("Done!")
