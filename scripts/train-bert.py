#!/usr/bin/env python3
"""Fine-tune Mongolian BERT for intent classification on Temuulel ecommerce data."""

import json
import os
import sys
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    EarlyStoppingCallback,
)

# ── Config ──────────────────────────────────────────────────────────────────
MODEL_NAME = "tugstugi/bert-base-mongolian-cased"
OUTPUT_DIR = Path(__file__).parent.parent / "models" / "mongolian-intent-bert"
DATA_PATH = Path(__file__).parent.parent / "src" / "lib" / "ai" / "training-data.json"
MAX_LEN = 64
EPOCHS = 5
BATCH_SIZE = 32
LR = 2e-5
SEED = 42

# Use MPS (Apple Silicon) if available, else CPU
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {DEVICE}")

# ── Load Data ───────────────────────────────────────────────────────────────
print(f"Loading data from {DATA_PATH}...")
with open(DATA_PATH) as f:
    raw = json.load(f)

# Filter to intents with enough examples (>= 10)
from collections import Counter
intent_counts = Counter(r["intent"] for r in raw)
valid_intents = {k for k, v in intent_counts.items() if v >= 10}
data = [r for r in raw if r["intent"] in valid_intents]
print(f"  {len(data)} examples across {len(valid_intents)} intents")

# Build label mappings
labels_sorted = sorted(valid_intents)
label2id = {l: i for i, l in enumerate(labels_sorted)}
id2label = {i: l for l, i in label2id.items()}
NUM_LABELS = len(labels_sorted)

print(f"  Labels: {labels_sorted}")
for label in labels_sorted:
    print(f"    {label}: {intent_counts[label]}")

# ── Split ───────────────────────────────────────────────────────────────────
texts = [r["text"] for r in data]
labels = [label2id[r["intent"]] for r in data]

train_texts, val_texts, train_labels, val_labels = train_test_split(
    texts, labels, test_size=0.15, random_state=SEED, stratify=labels
)
print(f"\n  Train: {len(train_texts)}, Val: {len(val_texts)}")

# ── Tokenize ────────────────────────────────────────────────────────────────
print(f"\nLoading tokenizer: {MODEL_NAME}...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize(examples):
    return tokenizer(
        examples["text"],
        padding="max_length",
        truncation=True,
        max_length=MAX_LEN,
    )

train_ds = Dataset.from_dict({"text": train_texts, "label": train_labels})
val_ds = Dataset.from_dict({"text": val_texts, "label": val_labels})

train_ds = train_ds.map(tokenize, batched=True, remove_columns=["text"])
val_ds = val_ds.map(tokenize, batched=True, remove_columns=["text"])

train_ds.set_format("torch")
val_ds.set_format("torch")

# ── Model ───────────────────────────────────────────────────────────────────
print(f"Loading model: {MODEL_NAME} ({NUM_LABELS} labels)...")
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=NUM_LABELS,
    id2label=id2label,
    label2id=label2id,
)

# ── Training ────────────────────────────────────────────────────────────────
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    acc = accuracy_score(labels, preds)
    return {"accuracy": acc}

training_args = TrainingArguments(
    output_dir=str(OUTPUT_DIR / "checkpoints"),
    eval_strategy="epoch",
    save_strategy="epoch",
    learning_rate=LR,
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    num_train_epochs=EPOCHS,
    weight_decay=0.01,
    load_best_model_at_end=True,
    metric_for_best_model="accuracy",
    greater_is_better=True,
    logging_steps=50,
    seed=SEED,
    fp16=False,  # MPS doesn't support fp16 well
    use_mps_device=(DEVICE == "mps"),
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
)

print(f"\n{'='*60}")
print(f"Training BERT: {EPOCHS} epochs, batch={BATCH_SIZE}, lr={LR}")
print(f"{'='*60}\n")

trainer.train()

# ── Evaluate ────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("Final Evaluation")
print(f"{'='*60}\n")

eval_result = trainer.evaluate()
print(f"  Val Accuracy: {eval_result['eval_accuracy']:.4f}")

# Detailed classification report
preds_output = trainer.predict(val_ds)
preds = np.argmax(preds_output.predictions, axis=-1)
print("\nClassification Report:")
print(classification_report(
    val_labels, preds,
    target_names=labels_sorted,
    digits=3
))

# ── Save ────────────────────────────────────────────────────────────────────
save_path = OUTPUT_DIR / "final"
print(f"\nSaving model to {save_path}...")
trainer.save_model(str(save_path))
tokenizer.save_pretrained(str(save_path))

# Save label mappings
with open(save_path / "label_map.json", "w") as f:
    json.dump({"label2id": label2id, "id2label": {str(k): v for k, v in id2label.items()}}, f, indent=2)

print(f"\n{'='*60}")
print(f"DONE! Model saved to {save_path}")
print(f"Val Accuracy: {eval_result['eval_accuracy']:.4f}")
print(f"{'='*60}")
