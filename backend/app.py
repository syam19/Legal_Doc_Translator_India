"""
app.py — NyayaVaani Backend (Groq FREE API)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback, time, io, base64, os, requests, re

from legal_ner import LegalNER
from pipeline  import PreProcessor, PostProcessor, ConfidenceScorer

try:
    import pdfplumber
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
# API KEYS (Read from environment variables for security)
# Get free from: https://console.groq.com → API Keys (sign in with Google)
# ─────────────────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "YOUR_GROQ_KEY_HERE")

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"

LANGUAGES = [
    {"code": "hi", "name": "Hindi",     "native": "हिन्दी"},
    {"code": "te", "name": "Telugu",    "native": "తెలుగు"},
    {"code": "ta", "name": "Tamil",     "native": "தமிழ்"},
    {"code": "ml", "name": "Malayalam", "native": "മലയാളം"},
    {"code": "mr", "name": "Marathi",   "native": "मराठी"},
    {"code": "bn", "name": "Bengali",   "native": "বাংলা"},
    {"code": "gu", "name": "Gujarati",  "native": "ગુજરાતી"},
    {"code": "pa", "name": "Punjabi",   "native": "ਪੰਜਾਬੀ"},
    {"code": "ur", "name": "Urdu",      "native": "اردو"},
    {"code": "kn", "name": "Kannada",   "native": "ಕನ್ನಡ"},
    {"code": "or", "name": "Odia",      "native": "ଓଡ଼ିଆ"},
    {"code": "as", "name": "Assamese",  "native": "অসমীয়া"},
]
LANG_NAMES = {l["code"]: l["name"] for l in LANGUAGES}

# Correct bracket format per language — used in prompt examples
LANG_BRACKET_EXAMPLES = {
    "te": [
        ("Petitioner",  "పిటిషనర్ [పెటిషనర్/యాచికదారుడు]"),
        ("Accused",     "Accused [నిందితుడు]"),
        ("Respondent",  "Respondent [ప్రతివాది]"),
        ("Trial Court", "Trial Court [విచారణ న్యాయస్థానం]"),
        ("High Court",  "High Court [హైకోర్టు]"),
        ("State",       "State [రాష్ట్రం]"),
    ],
    "hi": [
        ("Petitioner",  "Petitioner [याचिकाकर्ता]"),
        ("Accused",     "Accused [अभियुक्त]"),
        ("Respondent",  "Respondent [प्रतिवादी]"),
        ("Trial Court", "Trial Court [विचारण न्यायालय]"),
        ("High Court",  "High Court [उच्च न्यायालय]"),
        ("State",       "State [राज्य]"),
    ],
    "ta": [
        ("Petitioner",  "Petitioner [மனுதாரர்]"),
        ("Accused",     "Accused [குற்றவாளி]"),
        ("Respondent",  "Respondent [பதிலர்]"),
        ("High Court",  "High Court [உயர் நீதிமன்றம்]"),
        ("State",       "State [மாநிலம்]"),
    ],
    "ml": [
        ("Petitioner",  "Petitioner [ഹർജിക്കാരൻ]"),
        ("Accused",     "Accused [പ്രതി]"),
        ("High Court",  "High Court [ഹൈക്കോടതി]"),
    ],
}


def build_system_prompt(lang_name: str, lang_code: str, detected_terms: list) -> str:
    term_list = ", ".join([t["normalized"] for t in detected_terms[:20]]) or "none"
    examples  = LANG_BRACKET_EXAMPLES.get(lang_code, LANG_BRACKET_EXAMPLES["hi"])
    ex_lines  = "\n".join([f'   ✅ CORRECT: "{e[0]}" → write as: {e[1]}' for e in examples])

    return f"""You are an expert Indian legal document translator. Translate the English court document FULLY into {lang_name}.

═══ RULE 1: TRANSLATE EVERYTHING INTO {lang_name.upper()} ═══
Every English sentence, phrase, word must be translated into {lang_name}.
Translate: "Dispensed with", "Heard the learned counsel", "Proceeding Sheet", "List the matter", "presence", "notice", "submissions", "permitted" — everything.

═══ RULE 2: LEGAL ROLE TERMS — STRICT FORMAT ═══
For these specific legal role words: Petitioner, Accused, Respondent, High Court, Trial Court, Supreme Court, State, Appellant, Complainant, Bail, FIR, Judgment, Affidavit —
KEEP the original English word AND add [{lang_name} meaning] in brackets right after.

{ex_lines}

⚠️ CRITICAL: Do NOT transliterate these terms into {lang_name} script.
   ❌ WRONG: "పిటిషనర్ [పిటిషనర్]"  ← transliteration + same word in brackets
   ❌ WRONG: "పిటిషనర్"              ← transliteration only, no English
   ✅ RIGHT:  "Petitioner [పెటిషనర్/యాచికదారుడు]"  ← English word + real meaning in brackets

═══ RULE 3: NEVER TRANSLATE THESE ═══
- Case numbers: Crl.P.No.10667 of 2025, I.A.No.1 of 2025
- Dates: 15.10.2025, 10.12.2025
- Judge names: Dr.VJP,J
- Abbreviations: RPAD, SNI, PIL, FIR (when used as abbreviation)
- Place names: AMARAVATI, ANDHRA PRADESH

═══ RULE 4: FORMAT ═══
- Preserve all line breaks and structure exactly
- Formal, dignified legal {lang_name}
- Output translated text ONLY — no notes, no explanations

Legal terms in this document: {term_list}"""


def translate_with_groq(text: str, target_lang: str, detected_terms: list) -> str:
    lang_name = LANG_NAMES.get(target_lang, target_lang)

    response = requests.post(
        GROQ_URL,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": GROQ_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": build_system_prompt(lang_name, target_lang, detected_terms)
                },
                {
                    "role": "user",
                    "content": (
                        f"Translate this court document fully to {lang_name}.\n"
                        f"Remember:\n"
                        f"- All sentences → {lang_name}\n"
                        f"- Legal role terms → keep English word + [{lang_name} meaning] in brackets\n"
                        f"- Never transliterate legal terms into {lang_name} script\n\n"
                        f"{text}"
                    )
                }
            ],
            "temperature": 0.1,
            "max_tokens": 4096
        },
        timeout=60
    )

    if response.status_code == 429:
        raise Exception("Rate limit hit. Wait 1 minute and try again.")
    if response.status_code != 200:
        raise Exception(f"Groq error {response.status_code}: {response.text[:300]}")

    return response.json()["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    return """
    <html>
        <head><title>NyayaVaani Backend API</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background-color: #f4f4f9;">
            <h1 style="color: #333;">NyayaVaani Backend API is Running! 🚀</h1>
            <p style="font-size: 18px; color: #666;">This URL serves the backend API for the translation service.</p>
            <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <p style="margin: 0;"><strong>To view the application UI, you need to:</strong></p>
                <ol style="text-align: left; margin-bottom: 0;">
                    <li>Go to Render Dashboard.</li>
                    <li>Create a new <strong>Static Site</strong> for the frontend.</li>
                    <li>Set Build Command: <code>cd frontend && npm install && npm run build</code></li>
                    <li>Set Publish Directory: <code>frontend/build</code></li>
                </ol>
            </div>
        </body>
    </html>
    """

@app.route("/api/health", methods=["GET"])
def health():
    api_ok = GROQ_API_KEY != "YOUR_GROQ_KEY_HERE"
    return jsonify({
        "status": "ok", "pdf_support": PDF_SUPPORT,
        "translation_engine": f"Groq {GROQ_MODEL} (free)",
        "api_key_configured": api_ok
    })

@app.route("/api/languages", methods=["GET"])
def get_languages():
    return jsonify({"languages": LANGUAGES})

@app.route("/api/extract-pdf", methods=["POST"])
def extract_pdf():
    if not PDF_SUPPORT:
        return jsonify({"error": "Run: pip install pdfplumber"}), 500
    try:
        pdf_bytes = None
        if 'file' in request.files:
            pdf_bytes = request.files['file'].read()
        elif request.is_json:
            b64 = request.get_json().get("base64", "")
            if "," in b64: b64 = b64.split(",", 1)[1]
            pdf_bytes = base64.b64decode(b64)
        if not pdf_bytes:
            return jsonify({"error": "No PDF data"}), 400

        pages = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                t = page.extract_text()
                if t and t.strip():
                    pages.append(f"[Page {i+1}]\n{t.strip()}")

        full_text = "\n\n".join(pages)
        if not full_text.strip():
            return jsonify({"error": "No text extracted. PDF may be scanned/image-based."}), 422

        terms = LegalNER().get_unique_terms(full_text)
        return jsonify({"success": True, "text": full_text,
                        "pages": len(pages), "char_count": len(full_text),
                        "detected_terms": terms})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/extract-terms", methods=["POST"])
def extract_terms():
    text = request.get_json().get("text", "")
    if not text.strip(): return jsonify({"error": "No text"}), 400
    try:
        terms = LegalNER().get_unique_terms(text)
        return jsonify({"terms": terms, "count": len(terms),
                        "categories": list(set(t["label"] for t in terms))})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/translate", methods=["POST"])
def translate():
    data        = request.get_json()
    text        = data.get("text", "")
    target_lang = data.get("target_lang", "hi")
    doc_type    = data.get("doc_type", "order")

    if not text.strip():
        return jsonify({"error": "No text provided"}), 400
    if target_lang not in LANG_NAMES:
        return jsonify({"error": "Unsupported language"}), 400
    if GROQ_API_KEY == "YOUR_GROQ_KEY_HERE":
        return jsonify({
            "error": "Groq API key not set.",
            "hint": "Get free key from https://console.groq.com → paste in app.py line 25"
        }), 500

    start = time.time()
    try:
        # LAYER 1 — Your LegalNER
        detected_terms = LegalNER().get_unique_terms(text)
        print(f"[L1] {len(detected_terms)} terms detected")

        # LAYER 2 — Your PreProcessor
        pre = PreProcessor()
        protected_text, token_map = pre.process(text)
        print(f"[L2] {len(token_map)} tokens protected")

        # LAYER 3 — Groq translation
        print(f"[L3] Translating to {target_lang}...")
        translated_raw = translate_with_groq(protected_text, target_lang, detected_terms)
        print(f"[L3] Done — {len(translated_raw)} chars")

        # LAYER 4 — Your PostProcessor
        post             = PostProcessor(target_lang)
        translated_final = post.process(translated_raw, token_map, original_text=text)
        translated_final = post.format_output(translated_final)
        print(f"[L4] Done")

        bracket_count = len(re.findall(r'\[[^\]]{2,40}\]', translated_final))
        confidence    = ConfidenceScorer().score(text, translated_final, len(detected_terms), bracket_count)

        return jsonify({
            "success": True,
            "original": text,
            "translated": translated_final,
            "target_lang": target_lang,
            "doc_type": doc_type,
            "detected_terms": detected_terms,
            "confidence": confidence,
            "processing_time_sec": round(time.time() - start, 2),
            "layers_used": [
                "Layer 1: LegalNER — custom NER (your code)",
                "Layer 2: PreProcessor — token protection (your code)",
                f"Layer 3: Groq {GROQ_MODEL} — free translation",
                "Layer 4: PostProcessor — bracket injection (your code)",
            ]
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    api_ok = GROQ_API_KEY != "YOUR_GROQ_KEY_HERE"
    print("=" * 55)
    print("  NyayaVaani — Groq Free Edition")
    print(f"  API Key : {'✅ Set' if api_ok else '❌ Not set — paste key in app.py line 25'}")
    print(f"  Model   : {GROQ_MODEL}")
    print(f"  Limits  : 500,000 tokens/day — resets daily — FREE")
    print(f"  PDF     : {'✅ pdfplumber' if PDF_SUPPORT else '❌ pip install pdfplumber'}")
    print("  URL     : http://localhost:5000")
    print("=" * 55)
    if not api_ok:
        print("\n  👉 Get free key: https://console.groq.com")
        print("  👉 Sign in with Google → API Keys → Create")
        print("  👉 Set the GROQ_API_KEY environment variable.\n")
    
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)