import re
import uuid
from typing import Dict, List, Tuple
from legal_ner import LegalNER

TERM_TRANSLATIONS = {
    "hi": {
        "Petitioner": "याचिकाकर्ता", "Respondent": "प्रतिवादी",
        "Plaintiff": "वादी", "Defendant": "प्रतिवादी",
        "Appellant": "अपीलकर्ता", "Complainant": "शिकायतकर्ता",
        "Accused": "अभियुक्त", "Applicant": "आवेदक",
        "Opposite Party": "विरोधी पक्ष", "State": "राज्य",
        "Mandamus": "परमादेश", "Certiorari": "उत्प्रेषण",
        "Habeas Corpus": "बंदी प्रत्यक्षीकरण", "Prohibition": "प्रतिषेध",
        "Quo Warranto": "अधिकार पृच्छा", "Prima Facie": "प्रथम दृष्टया",
        "Inter Alia": "अन्य बातों के साथ", "Suo Motu": "स्वतः संज्ञान",
        "Ex Parte": "एकपक्षीय", "Res Judicata": "न्यायनिर्णीत विषय",
        "Locus Standi": "वाद पात्रता", "Status Quo": "यथास्थिति",
        "Ultra Vires": "अधिकारातीत", "Bona Fide": "सद्भावना",
        "Mala Fide": "दुर्भावना", "High Court": "उच्च न्यायालय",
        "Supreme Court": "सर्वोच्च न्यायालय", "District Court": "जिला न्यायालय",
        "Trial Court": "विचारण न्यायालय", "Sessions Court": "सत्र न्यायालय",
        "Writ Petition": "रिट याचिका", "Affidavit": "शपथपत्र",
        "Injunction": "निषेधाज्ञा", "Bail": "जमानत",
        "Anticipatory Bail": "अग्रिम जमानत", "Decree": "डिक्री",
        "Judgment": "निर्णय", "FIR": "प्राथमिकी",
        "Adjournment": "स्थगन", "Remand": "रिमांड",
        "Acquittal": "दोषमुक्ति", "Conviction": "दोषसिद्धि",
        "Appeal": "अपील", "Stay Order": "स्थगन आदेश",
        "Interim Order": "अंतरिम आदेश",
        "Interlocutory Application": "अंतरिम आवेदन",
        "Anticipatory Bail": "अग्रिम जमानत",
    },
    "te": {
        "Petitioner": "పెటిషనర్/యాచికదారుడు", "Respondent": "ప్రతివాది",
        "Plaintiff": "వాది", "Defendant": "ప్రతివాది",
        "Appellant": "అప్పీలుదారు", "Complainant": "ఫిర్యాదీ",
        "Accused": "నిందితుడు", "Applicant": "దరఖాస్తుదారు",
        "Opposite Party": "వ్యతిరేక పక్షం", "State": "రాష్ట్రం",
        "Defacto Complainant": "వాస్తవ ఫిర్యాదీ",
        "Mandamus": "మాండమస్", "Certiorari": "సర్టియోరరి",
        "Habeas Corpus": "హేబియస్ కార్పస్", "Prima Facie": "ప్రథమ దృష్టికి",
        "Suo Motu": "స్వతఃగా", "Ex Parte": "ఏకపక్ష",
        "Status Quo": "యధాతథ స్థితి", "Ultra Vires": "అధికార పరిధి మించి",
        "Bona Fide": "సద్భావంతో", "Locus Standi": "వాద హక్కు",
        "High Court": "హైకోర్టు", "Supreme Court": "సర్వోన్నత న్యాయస్థానం",
        "District Court": "జిల్లా న్యాయస్థానం", "Trial Court": "విచారణ న్యాయస్థానం",
        "Sessions Court": "సెషన్స్ కోర్టు", "Writ Petition": "రిట్ పిటిషన్",
        "Affidavit": "అఫిడవిట్", "Injunction": "నిషేధాజ్ఞ",
        "Bail": "బెయిల్", "Anticipatory Bail": "ముందస్తు బెయిల్",
        "Judgment": "తీర్పు", "FIR": "ఎఫ్ఐఆర్",
        "Adjournment": "వాయిదా", "Acquittal": "నిర్దోషిగా విడుదల",
        "Conviction": "శిక్ష", "Appeal": "అప్పీలు",
        "Stay Order": "స్టే ఆర్డర్", "Interim Order": "మధ్యంతర ఆదేశం",
        "Interlocutory Application": "మధ్యంతర దరఖాస్తు",
        "Public Prosecutor": "ప్రభుత్వ న్యాయవాది",
        "Legal Aid": "న్యాయ సహాయం",
        "Criminal Petition": "క్రిమినల్ పిటిషన్",
    },
    "ta": {
        "Petitioner": "மனுதாரர்", "Respondent": "பதிலர்",
        "Plaintiff": "வாதி", "Defendant": "பிரதிவாதி",
        "Appellant": "மேல்முறையீட்டாளர்", "Complainant": "புகார்தாரர்",
        "Accused": "குற்றவாளி", "State": "மாநிலம்",
        "Mandamus": "கட்டாய ஆணை", "Habeas Corpus": "உடல் ஆஜர் ஆணை",
        "Prima Facie": "முதல் பார்வையில்", "Suo Motu": "தன்னிச்சையாக",
        "Status Quo": "நிலைமை தொடரட்டும்",
        "High Court": "உயர் நீதிமன்றம்", "Supreme Court": "உச்ச நீதிமன்றம்",
        "District Court": "மாவட்ட நீதிமன்றம்", "Trial Court": "விசாரணை நீதிமன்றம்",
        "Writ Petition": "ஆணை மனு", "Affidavit": "உறுதிமொழி",
        "Injunction": "தடை உத்தரவு", "Bail": "பிணை",
        "Anticipatory Bail": "முன்கூட்டிய பிணை",
        "Judgment": "தீர்ப்பு", "FIR": "முதல் தகவல் அறிக்கை",
        "Acquittal": "விடுதலை", "Appeal": "மேல்முறையீடு",
        "Public Prosecutor": "அரசு வழக்கறிஞர்",
    },
    "ml": {
        "Petitioner": "ഹർജിക്കാരൻ", "Respondent": "എതിർകക്ഷി",
        "Defendant": "പ്രതി", "Accused": "പ്രതി", "State": "സംസ്ഥാനം",
        "Mandamus": "നിർദേശ ഉത്തരവ്", "Habeas Corpus": "ഹേബിയസ് കോർപ്പസ്",
        "Prima Facie": "പ്രഥമദൃഷ്ട്യാ",
        "High Court": "ഹൈക്കോടതി", "Supreme Court": "സുപ്രീം കോടതി",
        "Trial Court": "വിചാരണ കോടതി", "Injunction": "വിലക്കുത്തരവ്",
        "Bail": "ജാമ്യം", "Anticipatory Bail": "മുൻകൂർ ജാമ്യം",
        "Judgment": "വിധി", "FIR": "പ്രഥമ വിവര റിപ്പോർട്ട്",
        "Acquittal": "വിമോചനം", "Public Prosecutor": "സർക്കാർ അഭിഭാഷകൻ",
    },
    "mr": {
        "Petitioner": "याचिकाकर्ता", "Respondent": "प्रतिवादी",
        "Accused": "आरोपी", "State": "राज्य",
        "Mandamus": "परमादेश", "Habeas Corpus": "बंदी प्रत्यक्षीकरण",
        "Prima Facie": "प्रथमदर्शनी",
        "High Court": "उच्च न्यायालय", "Supreme Court": "सर्वोच्च न्यायालय",
        "Trial Court": "विचारण न्यायालय", "Injunction": "मनाई हुकूम",
        "Bail": "जामीन", "Anticipatory Bail": "अग्रिम जामीन",
        "Judgment": "निकाल", "FIR": "गुन्हा नोंद", "Acquittal": "निर्दोष मुक्तता",
    },
    "bn": {
        "Petitioner": "আবেদনকারী", "Respondent": "বিবাদী",
        "Accused": "অভিযুক্ত", "State": "রাজ্য",
        "Mandamus": "ম্যান্ডামাস", "Habeas Corpus": "হেবিয়াস কর্পাস",
        "Prima Facie": "প্রাথমিকভাবে",
        "High Court": "হাই কোর্ট", "Supreme Court": "সর্বোচ্চ আদালত",
        "Trial Court": "বিচার আদালত", "Injunction": "নিষেধাজ্ঞা",
        "Bail": "জামিন", "Anticipatory Bail": "আগাম জামিন",
        "Judgment": "রায়", "FIR": "এফআইআর",
    },
    "gu": {
        "Petitioner": "અરજદાર", "Respondent": "પ્રતિવાદી",
        "Accused": "આરોપી", "State": "રાજ્ય",
        "High Court": "હાઈ કોર્ટ", "Supreme Court": "સર્વોચ્ચ ન્યાયાલય",
        "Trial Court": "ટ્રાયલ કોર્ટ", "Injunction": "સ્થગિતતા",
        "Bail": "જામીન", "Anticipatory Bail": "અગાઉની જામીન",
        "Judgment": "ચુકાદો", "FIR": "એફઆઈઆર",
    },
    "pa": {
        "Petitioner": "ਅਰਜ਼ੀਕਾਰ", "Respondent": "ਜਵਾਬਦੇਹ",
        "Accused": "ਦੋਸ਼ੀ", "State": "ਰਾਜ",
        "High Court": "ਹਾਈ ਕੋਰਟ", "Supreme Court": "ਸੁਪਰੀਮ ਕੋਰਟ",
        "Trial Court": "ਮੁਕੱਦਮਾ ਅਦਾਲਤ",
        "Bail": "ਜ਼ਮਾਨਤ", "Judgment": "ਫੈਸਲਾ", "FIR": "ਐੱਫਆਈਆਰ",
    },
    "ur": {
        "Petitioner": "درخواست گزار", "Respondent": "مدعا علیہ",
        "Accused": "ملزم", "State": "ریاست",
        "High Court": "ہائی کورٹ", "Supreme Court": "سپریم کورٹ",
        "Trial Court": "ٹرائل کورٹ", "Injunction": "حکم امتناعی",
        "Bail": "ضمانت", "Anticipatory Bail": "پیشگی ضمانت",
        "Judgment": "فیصلہ", "FIR": "ایف آئی آر",
    },
    "kn": {
        "Petitioner": "ಅರ್ಜಿದಾರ", "Respondent": "ಪ್ರತಿವಾದಿ",
        "Accused": "ಆರೋಪಿ", "State": "ರಾಜ್ಯ",
        "High Court": "ಉಚ್ಚ ನ್ಯಾಯಾಲಯ", "Supreme Court": "ಸರ್ವೋಚ್ಚ ನ್ಯಾಯಾಲಯ",
        "Trial Court": "ವಿಚಾರಣಾ ನ್ಯಾಯಾಲಯ", "Injunction": "ನಿಷೇಧಾಜ್ಞೆ",
        "Bail": "ಜಾಮೀನು", "Anticipatory Bail": "ಮುಂಗಡ ಜಾಮೀನು",
        "Judgment": "ತೀರ್ಪು", "FIR": "ಎಫ್‌ಐಆರ್",
    },
    "or": {
        "Petitioner": "ଆବେଦନକାରୀ", "Respondent": "ବିବାଦୀ",
        "Accused": "ଅଭିଯୁକ୍ତ", "State": "ରାଜ୍ୟ",
        "High Court": "ହାଇ କୋର୍ଟ", "Supreme Court": "ସର୍ବୋଚ୍ଚ ନ୍ୟାୟାଳୟ",
        "Trial Court": "ବିଚାର ଅଦାଲତ",
        "Bail": "ଜାମିନ", "Judgment": "ରାୟ",
    },
    "as": {
        "Petitioner": "আবেদনকাৰী", "Respondent": "সঁহাৰিকাৰী",
        "Accused": "অভিযুক্ত", "State": "ৰাজ্য",
        "High Court": "হাইকোৰ্ট", "Supreme Court": "উচ্চতম ন্যায়ালয়",
        "Trial Court": "বিচাৰ আদালত",
        "Bail": "জামিন", "Judgment": "ৰায়",
    },
}

# Transliteration map — model writes these instead of keeping English
TRANSLITERATION_MAP = {
    "te": {
        "పిటిషనర్": "Petitioner", "పెటిషనర్": "Petitioner", "పిటీషనర్": "Petitioner",
        "రెస్పాండెంట్": "Respondent", "రెస్పొండెంట్": "Respondent",
        "అక్యూజ్డ్": "Accused", "అక్యూస్డ్": "Accused",
        "స్టేట్": "State",
        "ట్రయల్ కోర్టు": "Trial Court", "ట్రయల్ కోర్ట్": "Trial Court",
        "హైకోర్టు": "High Court", "హై కోర్టు": "High Court", "హైకోర్ట్": "High Court",
        "సుప్రీం కోర్టు": "Supreme Court", "సుప్రీమ్ కోర్టు": "Supreme Court",
        "డిస్ట్రిక్ట్ కోర్టు": "District Court",
        "బెయిల్": "Bail",
        "అంటిసిపేటరీ బెయిల్": "Anticipatory Bail",
        "అఫిడవిట్": "Affidavit",
        "కంప్లెయినెంట్": "Complainant",
        "డిఫాక్టో కంప్లెయినెంట్": "Defacto Complainant",
    },
    "hi": {
        "पेटिशनर": "Petitioner", "रिस्पॉन्डेंट": "Respondent",
        "हाई कोर्ट": "High Court", "ट्रायल कोर्ट": "Trial Court",
        "सुप्रीम कोर्ट": "Supreme Court", "स्टेट": "State", "बेल": "Bail",
    },
    "ta": {
        "பெட்டிஷனர்": "Petitioner", "ரெஸ்பாண்டன்ட்": "Respondent",
        "ஹை கோர்ட்": "High Court", "ட்ரயல் கோர்ட்": "Trial Court", "ஸ்டேட்": "State",
    },
    "kn": {
        "ಪಿಟಿಷನರ್": "Petitioner", "ರೆಸ್ಪಾಂಡೆಂಟ್": "Respondent",
        "ಹೈಕೋರ್ಟ್": "High Court", "ಟ್ರಯಲ್ ಕೋರ್ಟ್": "Trial Court", "ಸ್ಟೇಟ್": "State",
    },
    "ml": {
        "പെറ്റിഷണർ": "Petitioner", "റെസ്പോണ്ടന്റ്": "Respondent",
        "ഹൈക്കോടതി": "High Court", "ട്രയൽ കോടതി": "Trial Court", "സ്റ്റേറ്റ്": "State",
    },
}


# PRE-PROCESSOR (Layer 2)
# Uses ⟨uuid⟩ format — model will NEVER transliterate angle-bracket UUID tokens

class PreProcessor:
    def process(self, text: str) -> Tuple[str, Dict[str, str]]:
        token_map = {}

        def token(original: str) -> str:
            key = f"⟨{uuid.uuid4().hex[:6]}⟩"
            token_map[key] = original
            return key

        # Protect case numbers: Crl.P.No.10667 of 2025, CRLP.No.631 of 2026
        text = re.sub(
            r'\b(?:CRLP|Crl\.P|CRL\.P|W\.P|O\.S|C\.A|SLP|PIL|I\.A|IA|lA)\s*\.?\s*No\.?\s*[\d]+\s*(?:of|OF|/)\s*\d{4}\b',
            lambda m: token(m.group()), text, flags=re.IGNORECASE
        )
        # Protect standalone FIR numbers: F.I.R No. 51 of 2026
        text = re.sub(
            r'\bF\.?I\.?R\.?\s*No\.?\s*\d+\s*(?:of|OF|/)\s*\d{4}\b',
            lambda m: token(m.group()), text, flags=re.IGNORECASE
        )
        # Protect dates: 15.10.2025, 16/02/2026, 20.02.2026
        text = re.sub(
            r'\b\d{1,2}[./]\d{1,2}[./]\d{4}\b',
            lambda m: token(m.group()), text
        )
        # Protect Article/Section numbers
        text = re.sub(
            r'\b(Article|Section)\s+(\d+[A-Z]?)\b',
            lambda m: token(m.group()), text, flags=re.IGNORECASE
        )
        return text, token_map


# POST-PROCESSOR (Layer 4)

class PostProcessor:
    def __init__(self, target_lang: str):
        self.target_lang    = target_lang
        self.glossary       = TERM_TRANSLATIONS.get(target_lang, {})
        self.sorted_terms   = sorted(self.glossary.keys(), key=len, reverse=True)
        self.translit_map   = TRANSLITERATION_MAP.get(target_lang, {})
        self.sorted_translit = sorted(self.translit_map.keys(), key=len, reverse=True)

    def restore_tokens(self, text: str, token_map: Dict[str, str]) -> str:
        """Restore ⟨uuid⟩ tokens back to original values."""
        for key, original in token_map.items():
            text = text.replace(key, original)
        return text

    def fix_double_brackets(self, text: str) -> str:
        """
        Fix nested/double brackets produced when both model AND PostProcessor add brackets.
        Examples:
          Petitioner [Petitioner [పెటిషనర్/యాచికదారుడు]/యాచికదారుడు]
            → Petitioner [పెటిషనర్/యాచికదారుడు]
          Bail [Bail [బెయిల్]]
            → Bail [బెయిల్]
        """
        changed = True
        while changed:
            changed = False
            # Pattern: Word [Word [translation]] → Word [translation]
            new_text = re.sub(
                r'\b([A-Za-z][A-Za-z\s]*?)\s*\[\1\s*\[([^\[\]]+)\]\s*[^\[\]]*\]',
                lambda m: f"{m.group(1)} [{m.group(2)}]",
                text, flags=re.IGNORECASE
            )
            # Pattern: Word [Word [translation]/extra] → Word [translation/extra]
            new_text2 = re.sub(
                r'\b([A-Za-z][A-Za-z\s]*?)\s*\[([A-Za-z][A-Za-z\s]*?)\s*\[([^\[\]]+)\][^\[\]]*\]',
                lambda m: f"{m.group(1)} [{m.group(3)}]",
                new_text, flags=re.IGNORECASE
            )
            if new_text2 != text:
                text = new_text2
                changed = True
        return text

    def fix_transliterations(self, text: str) -> str:
        """Replace Telugu/Hindi phonetic transliterations with English [Translation] format."""
        result = text
        for translit in self.sorted_translit:
            eng_term    = self.translit_map[translit]
            translation = self.glossary.get(eng_term, "")
            if not translation:
                continue
            # Case 1: transliteration + [something] → English [correct translation]
            result = re.sub(
                re.escape(translit) + r'\s*\[([^\]]*)\]',
                f"{eng_term} [{translation}]",
                result
            )
            # Case 2: standalone transliteration without brackets
            result = re.sub(
                re.escape(translit) + r'(?!\s*\[)',
                f"{eng_term} [{translation}]",
                result
            )
        return result

    def inject_brackets(self, text: str) -> str:
        """Add [translation] after English legal terms not yet bracketed."""
        result = text
        for term in self.sorted_terms:
            translation = self.glossary[term]
            pattern     = re.compile(r'\b' + re.escape(term) + r'\b(?!\s*\[)', re.IGNORECASE)
            if pattern.search(result):
                result = pattern.sub(f"{term} [{translation}]", result)
        return result

    def process(self, translated_text: str, token_map: Dict[str, str], original_text: str = "") -> str:
        result = self.restore_tokens(translated_text, token_map)   # Step 1: restore ⟨uuid⟩ tokens
        result = self.fix_double_brackets(result)                   # Step 2: fix nested brackets
        result = self.fix_transliterations(result)                  # Step 3: fix transliterations
        result = self.inject_brackets(result)                       # Step 4: add missing brackets
        return result

    def format_output(self, text: str) -> str:
        # Remove any glossary header if present
        text = re.sub(r'📌 Legal Terms Glossary:.*?─{10,}\s*\n\n', '', text, flags=re.DOTALL)
        text = re.sub(r'  +', ' ', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()


# CONFIDENCE SCORER

class ConfidenceScorer:
    def score(self, original: str, translated: str,
              terms_found: int, terms_preserved: int) -> dict:
        len_ratio    = len(translated) / max(len(original), 1)
        len_score    = 1.0 if 0.5 <= len_ratio <= 2.5 else 0.6
        term_score   = (terms_preserved / terms_found) if terms_found > 0 else 1.0
        orig_paras   = len([p for p in original.split('\n')   if p.strip()])
        trans_paras  = len([p for p in translated.split('\n') if p.strip()])
        struct_score = min(1.0, min(trans_paras, orig_paras) / max(orig_paras, 1) + 0.3)
        overall      = round((len_score * 0.3 + term_score * 0.5 + struct_score * 0.2) * 100)
        return {
            "overall": min(overall, 98),
            "length_ratio": round(len_ratio, 2),
            "terms_preserved": terms_preserved,
            "terms_found": terms_found,
            "structure_score": round(struct_score * 100),
        }
