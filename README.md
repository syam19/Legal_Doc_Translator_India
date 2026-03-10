# NyayaVaani — Indian Legal Document Translator

Translates Indian court documents from English into 12 regional languages while preserving legal terminology. Each legal term appears in its original English form with the regional translation in brackets — e.g. `Petitioner [పెటిషనర్/యాచికదారుడు]`.

**Supported languages:** Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Urdu, Assamese

---

## How it works

The system runs documents through a 4-layer pipeline:

1. **LegalNER** — custom rule-based NER that detects 100+ Indian legal terms across 7 categories (roles, writs, Latin terms, courts, document types, procedures, constitutional references)
2. **PreProcessor** — protects case numbers, dates, and section references using UUID tokens so the translation engine does not touch them
3. **Groq LLaMA 3.3 70B** — translates the document; a purpose-built prompt tells it exactly which terms to keep in English with bracket translations
4. **PostProcessor** — restores protected tokens, fixes any transliteration errors, injects bracket translations for any terms the model missed

---

## Setup

### Requirements
- Python 3.9+
- Node.js 16+
- Groq API key

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Open `app.py` and paste your Groq key :
```python
GROQ_API_KEY = "gsk_your_key_here"
```

Start the server:
```bash
python3 app.py
```

Backend runs on `http://localhost:5000`

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend opens at `http://localhost:3000`

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check, shows API key status |
| GET | `/api/languages` | List of supported languages |
| POST | `/api/translate` | Translate a document |
| POST | `/api/extract-terms` | Run NER only, no translation |
| POST | `/api/extract-pdf` | Extract text from a PDF |

### Translate request body
```json
{
  "text": "court document text here",
  "target_lang": "te",
  "doc_type": "order"
}
```

---

## Project structure

```
nyayavaani/
├── backend/
│   ├── app.py           — Flask API server
│   ├── legal_ner.py     — Layer 1: custom NER engine
│   ├── pipeline.py      — Layers 2 & 4: pre/post processors + glossary
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── App.jsx      — React UI
        └── index.js
```

---

## Legal term glossary

The `TERM_TRANSLATIONS` dictionary in `pipeline.py` contains curated translations for all 12 languages. Terms are sorted longest-first before matching to prevent partial overlaps (e.g. "Anticipatory Bail" is matched before "Bail").

---

## Notes

- PDF support requires `pdfplumber`. Scanned/image PDFs are not supported — only text-based PDFs.
- The Groq free tier allows 500,000 tokens per day, which is enough for several hundred document translations.
- This tool is for accessibility and reference only. For official court proceedings, use a certified legal translator.
