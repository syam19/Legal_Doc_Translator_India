import re
from dataclasses import dataclass, asdict
from typing import List, Tuple

LEGAL_ROLES = [
    "Petitioner", "Respondent", "Plaintiff", "Defendant",
    "Appellant", "Appellee", "Complainant", "Accused",
    "Applicant", "Opposite Party", "Intervenor", "Proforma Respondent",
    "Defacto Complainant", "State", "Union of India",
    "Decree Holder", "Judgment Debtor",
]
WRIT_TYPES = [
    "Mandamus", "Certiorari", "Prohibition",
    "Habeas Corpus", "Quo Warranto",
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

ALL_LEGAL_TERMS = (
    LEGAL_ROLES + WRIT_TYPES + LATIN_LEGAL +
    COURT_TERMS + DOCUMENT_TYPES + LEGAL_PROCEDURES +
    CONSTITUTIONAL_TERMS
)


@dataclass
class LegalEntity:
    text: str
    label: str
    start: int
    end: int
    normalized: str

    def to_dict(self):
        return asdict(self)


class LegalNER:
    def __init__(self):
        self.patterns = self._compile_patterns()

    def _compile_patterns(self):
        categories = [
            (LEGAL_ROLES,          "ROLE"),
            (WRIT_TYPES,           "WRIT"),
            (LATIN_LEGAL,          "LATIN"),
            (COURT_TERMS,          "COURT"),
            (DOCUMENT_TYPES,       "DOC"),
            (LEGAL_PROCEDURES,     "PROC"),
            (CONSTITUTIONAL_TERMS, "CONST"),
        ]
        compiled = []
        for terms, label in categories:
            for term in terms:
                pattern = re.compile(r'\b' + re.escape(term) + r'\b', re.IGNORECASE)
                compiled.append((pattern, label, term))
        return compiled

    def extract(self, text: str) -> List[LegalEntity]:
        found = []
        seen_spans = set()
        for pattern, label, canonical in self.patterns:
            for match in pattern.finditer(text):
                start, end = match.start(), match.end()
                overlap = any(not (end <= s or start >= e) for s, e in seen_spans)
                if not overlap:
                    seen_spans.add((start, end))
                    found.append(LegalEntity(
                        text=match.group(), label=label,
                        start=start, end=end, normalized=canonical
                    ))
        found.sort(key=lambda e: e.start)
        return found

    def get_unique_terms(self, text: str) -> List[dict]:
        seen, unique = set(), []
        for e in self.extract(text):
            if e.normalized.lower() not in seen:
                seen.add(e.normalized.lower())
                unique.append(e.to_dict())
        return unique
