"""Shared helpers for the MICCAI Subscribe program importer."""
from __future__ import annotations

import re
import unicodedata

# --- text normalisation -----------------------------------------------------

def fold(s: str) -> str:
    """NFKD-fold diacritics and normalise whitespace. Keeps case."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("–", "-").replace("—", "-")
    s = s.replace("‘", "'").replace("’", "'")
    s = s.replace("“", '"').replace("”", '"')
    return " ".join(s.split())


def title_key(s: str) -> str:
    """Aggressive key for cross-version / cross-section title matching."""
    return re.sub(r"[^a-z0-9]+", " ", fold(s).lower()).strip()


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", fold(s).lower()).strip("-")


# --- presenter string parsing ----------------------------------------------
# Presenter strings look like "<name>, <affiliation which may contain commas>, <country>".
# Countries are matched from the RIGHT, which is far more robust than splitting
# on the first comma.

COUNTRIES = {
    "argentina", "australia", "austria", "bangladesh", "belgium", "brazil", "bulgaria",
    "canada", "chile", "china", "colombia", "croatia", "cyprus", "czech republic",
    "denmark", "egypt", "estonia", "ethiopia", "finland", "france", "germany", "ghana",
    "greece", "hong kong", "hong kong sar", "hungary", "iceland", "india", "indonesia",
    "iran", "ireland", "israel", "italy", "japan", "jordan", "kenya", "lebanon",
    "luxembourg", "macao", "macau", "malaysia", "mexico", "morocco", "nepal",
    "netherlands", "new zealand", "nigeria", "norway", "pakistan", "peru",
    "philippines", "poland", "portugal", "qatar", "romania", "russia", "saudi arabia",
    "serbia", "singapore", "slovakia", "slovenia", "south africa", "south korea",
    "korea", "spain", "sri lanka", "sweden", "switzerland", "taiwan", "thailand",
    "syria", "tunisia", "turkey", "türkiye", "turkiye", "uae", "uganda", "uk", "ukraine",
    "united arab emirates", "united kingdom", "united states", "usa", "u.s.a.",
    "us", "vietnam",
}

_COUNTRY_CANON = {
    "usa": "United States", "us": "United States", "u.s.a.": "United States",
    "uk": "United Kingdom", "korea": "South Korea", "macau": "Macao",
    "hong kong sar": "Hong Kong", "türkiye": "Turkey",
    "uae": "United Arab Emirates", "turkiye": "Turkey", "macao sar": "Macao",
}


def _country_candidate(seg: str) -> str:
    """Strip the decorations that stop a country name from matching:
    a leading article, a trailing '(…)' gloss, a trailing 'SAR'."""
    c = seg.strip().rstrip(".")
    c = re.sub(r"\s*\([^)]*\)\s*$", "", c)
    c = re.sub(r"^the\s+", "", c, flags=re.I)
    c = re.sub(r"\s+SAR$", "", c, flags=re.I)
    return c.strip()

_AFF_NOISE = re.compile(
    r"^(the\s+|department of\s+|dept\.?\s+of\s+|school of\s+|college of\s+|"
    r"institute of\s+|faculty of\s+|division of\s+)",
    re.I,
)


def split_presenter(raw: str) -> tuple[str, str, str | None]:
    """'Yuan Xue, The Ohio State University, United States' -> (name, affiliation, country)."""
    raw = fold(raw).strip().strip(",")
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        return "", "", None

    country = None
    if len(parts) > 1:
        cand = _country_candidate(parts[-1])
        if cand.lower() in COUNTRIES:
            parts.pop()
            country = _COUNTRY_CANON.get(cand.lower(), cand)

    name = parts[0] if parts else ""
    affiliation = ", ".join(parts[1:]) if len(parts) > 1 else ""
    return name, affiliation, country


def canonical_affiliation(aff: str) -> str:
    """Conservative canonical key for grouping affiliation spellings."""
    if not aff:
        return ""
    # Multi-part affiliations ("Dept of X, Y University") -> keep the most
    # institution-looking segment, else the last one.
    segs = [s.strip() for s in aff.split(",") if s.strip()]
    pick = segs[-1]
    for s in segs:
        if re.search(r"universit|institute|college|hospital|school|academy|centre|center|laborator|inria|cnrs|mbzuai|postech|kaist|eth|epfl",
                     s, re.I):
            pick = s
            break
    pick = _AFF_NOISE.sub("", fold(pick).strip())
    pick = re.sub(r"\bUniv\.?\b", "University", pick, flags=re.I)
    return slug(pick)


# --- splitting a run of concatenated "Name, Affiliation, Country" people ----

_COUNTRY_ALT = "|".join(
    sorted((re.escape(c) for c in COUNTRIES), key=len, reverse=True))
# A country only terminates a person when it follows a comma (so "University of
# Hong Kong, Shenzhen" is not mistaken for a boundary) and is not itself
# followed by another comma-separated locality.
_PERSON_END_RE = re.compile(rf",\s*({_COUNTRY_ALT})\b(?![\w,])", re.I)


def split_people(run: str) -> list[str]:
    """'A, Univ X, China B, Univ Y, Canada' -> ['A, Univ X, China', 'B, Univ Y, Canada']"""
    run = fold(run).strip().strip(",")
    if not run:
        return []
    out, pos = [], 0
    for m in _PERSON_END_RE.finditer(run):
        tail = run[m.end():].lstrip()
        if tail and not re.match(r"[A-Z]", tail):
            continue          # still inside the same affiliation
        out.append(run[pos:m.end()].strip().strip(","))
        pos = m.end()
    rest = run[pos:].strip().strip(",")
    if rest:
        out.append(rest)
    return out
