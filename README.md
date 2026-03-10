NyayaVaani — Indian Legal Document Translator

NyayaVaani is an AI-powered legal document translator designed for the Indian judicial ecosystem. It translates English court documents into 12 Indian regional languages while preserving important legal terminology.

Unlike standard translation systems, NyayaVaani ensures that legal terms remain in English while displaying the regional translation in brackets for clarity.

Example:

Petitioner → Petitioner [పెటిషనర్ / యాచికదారుడు]

This approach helps lawyers, litigants, and citizens understand court documents in their native language without losing the legal meaning.

Features

• Translates legal documents into 12 Indian regional languages
• Preserves English legal terminology with bracket translations
• Custom Legal Named Entity Recognition (NER) for Indian legal terms
• Protection of case numbers, dates, and section references
• PDF text extraction support for text-based documents
• REST API for programmatic access
• Simple web interface for document translation

Supported Languages

NyayaVaani currently supports translation into the following languages:

Hindi
Telugu
Tamil
Kannada
Malayalam
Marathi
Bengali
Gujarati
Punjabi
Odia
Urdu
Assamese

System Architecture

The system processes legal documents through a 4-layer translation pipeline designed to preserve legal accuracy.

1. LegalNER

A custom rule-based Named Entity Recognition engine that detects 100+ Indian legal terms across 7 categories:

• Legal roles
• Writs
• Latin legal terms
• Courts
• Document types
• Legal procedures
• Constitutional references

2. PreProcessor

Before translation begins, the system protects sensitive structured data such as:

• Case numbers
• Dates
• Section references

These elements are replaced with UUID tokens so the translation model does not modify them.

3. Groq LLaMA 3.3 70B

The protected document is then translated using LLaMA 3.3 70B via Groq API.

A custom prompt ensures that:

• legal terms remain in English
• regional translations appear inside brackets

4. PostProcessor

After translation, the system:

• Restores protected UUID tokens
• Fixes transliteration inconsistencies
• Injects bracket translations for any missed legal terms

Example Translation

Input (English)

The petitioner filed a writ petition before the High Court.

Output (Telugu)

The Petitioner [పెటిషనర్ / యాచికదారుడు] filed a Writ Petition [వ్రిట్ పిటిషన్] before the High Court [హై కోర్ట్].

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

- PDF support requires `pdfplumber`
-  Scanned/image PDFs are not supported — only text-based PDFs.
