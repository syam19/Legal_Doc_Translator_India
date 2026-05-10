# NyayaVaani — ML Legal Document Translator
## No API Keys · Open Source · Runs Locally

```
Layer 1: YOUR CODE — Legal NER (legal_ner.py)
Layer 2: YOUR CODE — Pre-processor (pipeline.py)
Layer 3: Helsinki-NLP — MarianMT open-source model
Layer 4: YOUR CODE — Post-processor (pipeline.py)
Layer 5: YOUR CODE — React Frontend (App.jsx)
```

---

## Setup (One Time)

### Step 1 — Install Python dependencies

```bash
cd nyayavaani-ml/backend
pip install -r requirements.txt
```

> ⚠️ First translation will download Helsinki-NLP model (~300MB). Cached after that.

### Step 2 — Install React dependencies

```bash
cd nyayavaani-ml/frontend
npm install
```

---

## Run the Project (Two Terminals in VS Code)

### Terminal 1 — Start Python ML Backend
```bash
cd nyayavaani-ml/backend
python app.py
```
> Runs on http://localhost:5000

### Terminal 2 — Start React Frontend
```bash
cd nyayavaani-ml/frontend
npm start
```
> Opens http://localhost:3000 in browser

---

## Project Structure

```
nyayavaani-ml/
│
├── backend/
│   ├── app.py           ← Flask API server
│   ├── legal_ner.py     ← Layer 1: Your NER engine
│   ├── pipeline.py      ← Layer 2 & 4: Pre/Post processors
│   ├── translator.py    ← Layer 3: Helsinki-NLP wrapper
│   └── requirements.txt
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.jsx      ← Layer 5: Full React UI
    │   └── index.js
    └── package.json
```

---

## What You Can Say to Review Panels

> "We built a 4-layer NLP pipeline for legal document translation:
> Layer 1 is our own rule-based NER system that detects 100+ Indian legal terms
> across 7 categories using regex and curated legal dictionaries.
> Layer 2 is our pre-processor that protects legal terms, case numbers, dates and
> article references using placeholder injection before translation.
> Layer 3 uses Helsinki-NLP's open-source MarianMT transformer model — which we
> selected, integrated, and fine-tune controlled through our pipeline.
> Layer 4 is our post-processor that re-injects preserved legal terms in the
> format OriginalTerm [Translation], maintaining legal accuracy.
> Layer 5 is our React frontend with confidence scoring and side-by-side comparison."

---

## Supported Languages

| Language   | Code | Model Used               |
|------------|------|--------------------------|
| Hindi      | hi   | opus-mt-en-hi            |
| Telugu     | te   | opus-mt-en-mul (>>tel<<) |
| Tamil      | ta   | opus-mt-en-mul (>>tam<<) |
| Malayalam  | ml   | opus-mt-en-mul (>>mal<<) |
| Marathi    | mr   | opus-mt-en-mr            |
| Bengali    | bn   | opus-mt-en-bn            |
| Gujarati   | gu   | opus-mt-en-mul (>>guj<<) |
| Punjabi    | pa   | opus-mt-en-mul (>>pan<<) |
| Urdu       | ur   | opus-mt-en-ur            |
| Kannada    | kn   | opus-mt-en-mul (>>kan<<) |
| Odia       | or   | opus-mt-en-mul (>>ory<<) |
| Assamese   | as   | opus-mt-en-mul (>>asm<<) |

---

## API Endpoints

| Method | Route                | Description              |
|--------|----------------------|--------------------------|
| GET    | /api/health          | Backend health check     |
| GET    | /api/languages       | List supported languages |
| POST   | /api/extract-terms   | Run NER only             |
| POST   | /api/translate       | Full translation pipeline|

---

## Future Improvements (Post Review)

- [ ] Fine-tune Helsinki-NLP on Indian legal corpus
- [ ] Add PDF upload with pdfplumber extraction
- [ ] Train custom spaCy NER model on annotated legal data
- [ ] Add sentence-level confidence scores
- [ ] Glossary export as CSV/PDF
