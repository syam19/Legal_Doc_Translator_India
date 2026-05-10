"""
legal_ner.py — Layer 1: YOUR OWN Legal NER (Named Entity Recognition)
=====================================================================
Custom rule-based + pattern NER for Indian court documents.
NO external API. Pure Python + spaCy.

This module:
  - Detects legal roles  (Petitioner, Respondent, etc.)
  - Detects case references (Writ, FIR, PIL, etc.)
  - Detects Latin legal terms (Mandamus, Certiorari, etc.)
  - Detects court names
  - Returns structured entities with positions
"""

import re
import json
from dataclasses import dataclass, asdict
from typing import List, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# LEGAL TERM DICTIONARY  (   own curated dataset — 100+ terms)
# ─────────────────────────────────────────────────────────────────────────────

LEGAL_ROLES = [
    "Petitioner", "Respondent", "Plaintiff", "Defendant",
    "Appellant", "Appellee", "Complainant", "Accused",
    "Applicant", "Opposite Party", "Intervenor", "Proforma Respondent",
    "State", "Union of India", "Decree Holder", "Judgment Debtor",
]

WRIT_TYPES = [
    "Mandamus", "Certiorari", "Prohibition", "Habeas Corpus",
    "Quo Warranto",
]

LATIN_LEGAL = [
    "Prima Facie", "Inter Alia", "Suo Motu", "Ex Parte",
    "Locus Standi", "In Rem", "In Personam", "Res Judicata",
    "Sub Judice", "Amicus Curiae", "Caveat Emptor", "Mens Rea",
    "Actus Reus", "Bona Fide", "Mala Fide", "Ultra Vires",
    "Intra Vires", "Pro Bono", "Sine Die", "Status Quo",
    "Ipso Facto", "De Facto", "De Jure", "Obiter Dicta",
    "Ratio Decidendi", "Stare Decisis",
]

COURT_TERMS = [
    "High Court", "Supreme Court", "District Court", "Sessions Court",
    "Magistrate Court", "Family Court", "Consumer Forum", "Tribunal",
    "Trial Court", "Lower Court", "Appellate Court", "Division Bench",
    "Single Bench", "Full Bench", "Constitution Bench",
]

DOCUMENT_TYPES = [
    "Writ Petition", "Civil Appeal", "Criminal Appeal", "Special Leave Petition",
    "SLP", "PIL", "Public Interest Litigation", "FIR", "Charge Sheet",
    "Affidavit", "Counter Affidavit", "Reply Affidavit", "Vakalatnama",
    "Injunction", "Stay Order", "Interim Order", "Final Order",
    "Decree", "Judgment", "Award", "Contempt Petition",
]

LEGAL_PROCEDURES = [
    "Adjournment", "Remand", "Bail", "Anticipatory Bail", "Parole",
    "Custody", "Detention", "Acquittal", "Conviction", "Sentence",
    "Probation", "Appeal", "Revision", "Review", "Execution",
    "Attachment", "Garnishee", "Receiver", "Commissioner",
    "Interlocutory Application", "Miscellaneous Petition",
]

CONSTITUTIONAL_TERMS = [
    "Fundamental Rights", "Directive Principles", "Writ Jurisdiction",
    "Article 226", "Article 227", "Article 32", "Article 21",
    "Article 14", "Article 19", "Article 300A", "Article 348",
    "Constitution of India", "Seventh Schedule", "Concurrent List",
    "State List", "Union List",
]

# Combine all for full dictionary
ALL_LEGAL_TERMS = (
    LEGAL_ROLES + WRIT_TYPES + LATIN_LEGAL +
    COURT_TERMS + DOCUMENT_TYPES + LEGAL_PROCEDURES +
    CONSTITUTIONAL_TERMS
)


# ─────────────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LegalEntity:
    text: str           # exact matched text
    label: str          # category: ROLE, WRIT, LATIN, COURT, DOC, PROC, CONST
    start: int          # char start position
    end: int            # char end position
    normalized: str     # canonical form

    def to_dict(self):
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
# CORE NER ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class LegalNER:
    """
    Rule-based Named Entity Recognizer for Indian Legal Documents.
    Uses regex pattern matching on curated legal dictionaries.
    No ML model required — fast, accurate, explainable.
    """

    def __init__(self):
        self.patterns = self._compile_patterns()

    def _compile_patterns(self) -> List[Tuple[re.Pattern, str]]:
        """Compile regex patterns for each category."""
        categories = [
            (LEGAL_ROLES,         "ROLE"),
            (WRIT_TYPES,          "WRIT"),
            (LATIN_LEGAL,         "LATIN"),
            (COURT_TERMS,         "COURT"),
            (DOCUMENT_TYPES,      "DOC"),
            (LEGAL_PROCEDURES,    "PROC"),
            (CONSTITUTIONAL_TERMS,"CONST"),
        ]
        compiled = []
        for terms, label in categories:
            for term in terms:
                # Word boundary match, case-insensitive
                pattern = re.compile(
                    r'\b' + re.escape(term) + r'\b',    
                    re.IGNORECASE
                )
                compiled.append((pattern, label, term))
        return compiled

    def extract(self, text: str) -> List[LegalEntity]:
        """Extract all legal entities from text."""
        found = []
        seen_spans = set()

        for pattern, label, canonical in self.patterns:
            for match in pattern.finditer(text):
                start, end = match.start(), match.end()
                # Avoid overlapping matches
                span = (start, end)
                overlap = any(
                    not (end <= s or start >= e)
                    for s, e in seen_spans
                )
                if not overlap:
                    seen_spans.add(span)
                    found.append(LegalEntity(
                        text=match.group(),
                        label=label,
                        start=start,
                        end=end,
                        normalized=canonical
                    ))

        # Sort by position
        found.sort(key=lambda e: e.start)
        return found

    def get_unique_terms(self, text: str) -> List[dict]:
        """Return deduplicated list of found terms."""
        entities = self.extract(text)
        seen = set()
        unique = []
        for e in entities:
            key = e.normalized.lower()
            if key not in seen:
                seen.add(key)
                unique.append(e.to_dict())
        return unique

    def mark_terms(self, text: str) -> str:
        """Mark detected terms with [[[TERM]]] placeholders for protection."""
        entities = self.extract(text)
        if not entities:
            return text

        result = []
        prev_end = 0
        for e in entities:
            result.append(text[prev_end:e.start])
            result.append(f"[LEGAL:{e.normalized}]")
            prev_end = e.end
        result.append(text[prev_end:])
        return "".join(result)


# ─────────────────────────────────────────────────────────────────────────────
# CASE NUMBER EXTRACTOR
# ─────────────────────────────────────────────────────────────────────────────

def extract_case_numbers(text: str) -> List[dict]:
    """Extract Indian court case numbers."""
    patterns = [
        r'(?:Writ Petition|W\.P\.?|Crl\.P\.?|Civil Appeal|C\.A\.?|SLP|PIL)\s*(?:No\.?)?\s*\d+\s*(?:of|/)\s*\d{4}',
        r'[A-Z]+\s*No\.\s*\d+\s*(?:of|/)\s*\d{4}',
        r'O\.S\.\s*No\.\s*\d+\s*(?:of|/)\s*\d{4}',
        r'F\.I\.R\.?\s*No\.?\s*\d+',
    ]
    found = []
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            found.append({"text": m.group().strip(), "start": m.start(), "end": m.end()})
    return found


# ─────────────────────────────────────────────────────────────────────────────
# QUICK TEST
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sample = """
    The Petitioner filed a Writ Petition under Article 226 seeking a Writ of Mandamus.
    The Respondent, State of Telangana, opposed the same. Prima Facie, the High Court
    observed that the Trial Court order was Ultra Vires the Constitution of India.
    Bail was granted to the Accused pending appeal.
    """
    ner = LegalNER()
    entities = ner.get_unique_terms(sample)
    print(f"Found {len(entities)} unique legal entities:")
    for e in entities:
        print(f"  [{e['label']}] {e['normalized']}")
