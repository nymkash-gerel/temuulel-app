#!/usr/bin/env python3
"""BERT v2: Better hyperparams, balanced data, more epochs."""

import json
import numpy as np
import torch
from pathlib import Path
from collections import Counter
from datasets import Dataset
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification, AutoTokenizer,
    Trainer, TrainingArguments, EarlyStoppingCallback,
)

MODEL_NAME = "tugstugi/bert-base-mongolian-cased"
OUTPUT_DIR = Path("models/mongolian-intent-bert")
DATA_PATH = Path("src/lib/ai/training-data.json")
MAX_LEN = 128  # v1: 64 → v2: 128
EPOCHS = 8     # v1: 5 → v2: 8
BATCH_SIZE = 16  # v1: 32 → v2: 16 (more gradient updates)
LR = 3e-5      # v1: 2e-5 → v2: 3e-5
SEED = 42
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Device: {DEVICE}")

# Load data
with open(DATA_PATH) as f:
    raw = json.load(f)

counts = Counter(r["intent"] for r in raw)
valid = {k for k, v in counts.items() if v >= 10}
data = [r for r in raw if r["intent"] in valid]
labels_sorted = sorted(valid)
label2id = {l: i for i, l in enumerate(labels_sorted)}
id2label = {i: l for l, i in label2id.items()}
NUM = len(labels_sorted)
print(f"{len(data)} examples, {NUM} intents")

texts = [r["text"] for r in data]
labels = [label2id[r["intent"]] for r in data]
train_t, val_t, train_l, val_l = train_test_split(texts, labels, test_size=0.15, random_state=SEED, stratify=labels)
print(f"Train: {len(train_t)}, Val: {len(val_t)}")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
def tok(ex):
    return tokenizer(ex["text"], padding="max_length", truncation=True, max_length=MAX_LEN)

train_ds = Dataset.from_dict({"text": train_t, "label": train_l}).map(tok, batched=True, remove_columns=["text"])
val_ds = Dataset.from_dict({"text": val_t, "label": val_l}).map(tok, batched=True, remove_columns=["text"])
train_ds.set_format("torch")
val_ds.set_format("torch")

model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=NUM, id2label=id2label, label2id=label2id)

def compute_metrics(p):
    return {"accuracy": accuracy_score(p.label_ids, np.argmax(p.predictions, axis=-1))}

args = TrainingArguments(
    output_dir=str(OUTPUT_DIR / "checkpoints-v2"),
    eval_strategy="epoch", save_strategy="epoch",
    learning_rate=LR, per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE, num_train_epochs=EPOCHS,
    weight_decay=0.01, warmup_ratio=0.1,
    load_best_model_at_end=True, metric_for_best_model="accuracy",
    greater_is_better=True, logging_steps=50, seed=SEED,
    fp16=False, report_to="none",
)

trainer = Trainer(
    model=model, args=args, train_dataset=train_ds, eval_dataset=val_ds,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
)

print(f"\n{'='*60}")
print(f"BERT v2: {EPOCHS} epochs, batch={BATCH_SIZE}, lr={LR}, max_len={MAX_LEN}")
print(f"{'='*60}\n")
trainer.train()

# Eval
result = trainer.evaluate()
print(f"\nVal Accuracy: {result['eval_accuracy']:.4f}")
preds = np.argmax(trainer.predict(val_ds).predictions, axis=-1)
print("\nClassification Report:")
print(classification_report(val_l, preds, target_names=labels_sorted, digits=3))

# Save
save_path = OUTPUT_DIR / "final"
trainer.save_model(str(save_path))
tokenizer.save_pretrained(str(save_path))
with open(save_path / "label_map.json", "w") as f:
    json.dump({"label2id": label2id, "id2label": {str(k): v for k, v in id2label.items()}}, f, indent=2)

print(f"\nDONE! Model: {save_path}, Accuracy: {result['eval_accuracy']:.4f}")
