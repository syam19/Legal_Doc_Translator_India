"""
translator.py — Layer 3: Helsinki-NLP Open Source Translation
=============================================================
Uses HuggingFace Helsinki-NLP/opus-mt models.
These are FREE, open-source, run LOCALLY — no API key needed.

Models auto-download on first run (~300MB each, cached after).

Supported language pairs (English → Indian languages):
  en → hi  (Hindi)
  en → te  (Telugu)
  en → ta  (Tamil)
  en → ml  (Malayalam)
  en → mr  (Marathi)
  en → bn  (Bengali)
  en → gu  (Gujarati)
  en → pa  (Punjabi)
  en → ur  (Urdu)
  en → kn  (Kannada)  — via multilingual fallback
  en → or  (Odia)     — via multilingual fallback
  en → as  (Assamese) — via multilingual fallback
"""

from transformers import MarianMTModel, MarianTokenizer
import torch
import re
import os
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# MODEL MAP — Helsinki-NLP opus-mt models
# ─────────────────────────────────────────────────────────────────────────────

MODEL_MAP = {
    "hi": "Helsinki-NLP/opus-mt-en-hi",
    "te": "Helsinki-NLP/opus-mt-en-mul",   # multilingual covers Telugu
    "ta": "Helsinki-NLP/opus-mt-en-mul",
    "ml": "Helsinki-NLP/opus-mt-en-mul",
    "mr": "Helsinki-NLP/opus-mt-en-mr",
    "bn": "Helsinki-NLP/opus-mt-en-bn",
    "gu": "Helsinki-NLP/opus-mt-en-mul",
    "pa": "Helsinki-NLP/opus-mt-en-mul",
    "ur": "Helsinki-NLP/opus-mt-en-ur",
    "kn": "Helsinki-NLP/opus-mt-en-mul",
    "or": "Helsinki-NLP/opus-mt-en-mul",
    "as": "Helsinki-NLP/opus-mt-en-mul",
}

# Language code prefix for multilingual models
LANG_CODES = {
    "te": ">>tel<<",
    "ta": ">>tam<<",
    "ml": ">>mal<<",
    "gu": ">>guj<<",
    "pa": ">>pan<<",
    "kn": ">>kan<<",
    "or": ">>ory<<",
    "as": ">>asm<<",
}

# Cache loaded models to avoid reloading
_model_cache = {}


class TranslationEngine:
    """
    Wraps Helsinki-NLP MarianMT models for English → Indian language translation.
    Models run 100% locally using PyTorch.
    """

    def __init__(self, target_lang: str):
        self.target_lang = target_lang
        self.model_name = MODEL_MAP.get(target_lang, "Helsinki-NLP/opus-mt-en-mul")
        self.lang_prefix = LANG_CODES.get(target_lang, "")
        self.model, self.tokenizer = self._load_model()

    def _load_model(self):
        """Load (or return cached) model."""
        key = self.model_name
        if key not in _model_cache:
            print(f"Loading model: {key} (first run downloads ~300MB)")
            tokenizer = MarianTokenizer.from_pretrained(key)
            model = MarianMTModel.from_pretrained(key)
            model.eval()
            _model_cache[key] = (model, tokenizer)
            print(f"Model loaded: {key}")
        return _model_cache[key]

    def translate_sentence(self, text: str) -> str:
        """Translate a single sentence/chunk."""
        if not text.strip():
            return text

        # Add language prefix for multilingual models
        input_text = f"{self.lang_prefix} {text}" if self.lang_prefix else text

        inputs = self.tokenizer(
            [input_text],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        )

        with torch.no_grad():
            translated = self.model.generate(
                **inputs,
                num_beams=4,           # beam search for quality
                max_length=512,
                early_stopping=True
            )

        result = self.tokenizer.decode(translated[0], skip_special_tokens=True)
        return result

    def translate_chunks(self, text: str, chunk_size: int = 400) -> str:
        """Split long text into chunks and translate each."""
        # Split by sentences first
        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) < chunk_size:
                current_chunk += " " + sentence
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        # Translate each chunk
        translated_chunks = []
        for chunk in chunks:
            translated = self.translate_sentence(chunk)
            translated_chunks.append(translated)

        return " ".join(translated_chunks)


# ─────────────────────────────────────────────────────────────────────────────
# QUICK TEST
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    engine = TranslationEngine("hi")
    test = "The court has ordered that the petition be dismissed."
    result = engine.translate_chunks(test)
    print(f"Original: {test}")
    print(f"Translated: {result}")
