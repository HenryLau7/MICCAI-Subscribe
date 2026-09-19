"""Parse MICCAI 2026 satellite events.

Two sources, joined on the event acronym:
  * satellite-program.pdf -- a 6-column grid (room | theme | 4 time slots).
    Gives WHEN and WHERE.
  * workshops/challenges/tutorials.asp -- listing tables.
    Give the full event name and the external website.

The grid and the listings do not always spell an acronym the same way, so
config/satellite-aliases.yaml carries hand-maintained overrides.  Anything that
still fails to join is kept (schedule data is the useful half) and reported.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import fitz
import yaml
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
from common import fold, slug

TZ = "+02:00"
DAY_RE = re.compile(r"Day (\d) –\s*\w+,\s*(\w+)\s+(\d{1,2}),\s*(\d{4})")
SLOT_RE = re.compile(r"(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})")
TYPE_MAP = {"W": "workshop", "C": "challenge", "T": "tutorial"}
MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}


def norm_acronym(a: str) -> str:
    a = fold(a).upper().replace(" ", " ")
    a = re.sub(r"\s*\|\s*", " | ", a)
    return " ".join(a.split()).strip(" *")


# ------------------------------------------------------------------ listings

def parse_listing(path: Path, kind: str) -> list[dict]:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "lxml")
    out = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 5:
            continue
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            acronym = " ".join(cells[0].get_text(" ", strip=True).split())
            if not acronym:
                continue
            link = tr.find("a", href=True)
            out.append({
                "acronym": acronym,
                "key": norm_acronym(acronym),
                "name": " ".join(cells[1].get_text(" ", strip=True).split()),
                "theme": " ".join(cells[2].get_text(" ", strip=True).split()) if len(cells) > 2 else "",
                "day": " ".join(cells[3].get_text(" ", strip=True).split()) if len(cells) > 3 else "",
                "contact": " ".join(cells[4].get_text(" ", strip=True).split()) if len(cells) > 4 else "",
                "url": link["href"] if link else None,
                "type": kind,
            })
        break
    return out


# ---------------------------------------------------------------------- grid

def parse_grid(pdf: Path) -> list[dict]:
    doc = fitz.open(pdf)
    cells = []
    for page in doc:
        tables = page.find_tables().tables
        if not tables:
            continue
        rows = tables[0].extract()
        day = None
        for r in rows:
            joined = " ".join((c or "") for c in r)
            dm = DAY_RE.search(joined)
            if dm:
                day = (int(dm.group(4)), MONTHS[dm.group(2)], int(dm.group(3)))
                continue
            slots = SLOT_RE.findall(joined)
            if len(slots) == 4:
                slot_times = slots
                continue
            room_raw = " ".join((r[0] or "").split())
            if not room_raw or not day:
                continue
            m = re.match(r"(.*?)\s*\(([GU])\)\s*$", room_raw)
            room, floor = (m.group(1), m.group(2)) if m else (room_raw, None)
            theme = " ".join((r[1] or "").split())
            for idx, cell in enumerate(r[2:6]):
                text = " ".join((cell or "").split())
                if not text:
                    continue
                for piece in re.split(r"\s+/\s+(?=\*?\s*\([WCT]\))", text):
                    pm = re.match(r"\*?\s*\(([WCTc])\)\s*(.+)$", piece.strip())
                    if not pm:
                        continue
                    # A single cell may hold two co-located events sharing one
                    # type marker, e.g. "* (W) AFRICAI / MiRASOL".
                    for acro in re.split(r"\s+/\s+", pm.group(2).strip()):
                        sh, sm, eh, em = slot_times[idx]
                        cells.append({
                            "day": day, "slot": idx, "room": room, "floor": floor,
                            "theme": theme or None,
                            "type": TYPE_MAP[pm.group(1).upper()],
                            "acronym_raw": acro,
                            "key": norm_acronym(acro),
                            "start": f"{day[0]:04d}-{day[1]:02d}-{day[2]:02d}T{int(sh):02d}:{sm}:00{TZ}",
                            "end": f"{day[0]:04d}-{day[1]:02d}-{day[2]:02d}T{int(eh):02d}:{em}:00{TZ}",
                        })
    return cells


# --------------------------------------------------------------------- merge

def merge_runs(cells: list[dict]) -> list[dict]:
    """Collapse the same event occupying consecutive slots in the same room."""
    cells = sorted(cells, key=lambda c: (c["day"], slug(c["room"]), c["key"], c["slot"]))
    out: list[dict] = []
    for c in cells:
        prev = out[-1] if out else None
        if (prev and prev["day"] == c["day"] and prev["room"] == c["room"]
                and prev["key"] == c["key"] and c["slot"] == prev["_last_slot"] + 1):
            prev["end"] = c["end"]
            prev["_last_slot"] = c["slot"]
            continue
        e = dict(c)
        e["_last_slot"] = c["slot"]
        out.append(e)
    return out


def build(raw_dir: Path, alias_path: Path) -> tuple[list[dict], list[str]]:
    catalog: dict[str, dict] = {}
    for fn, kind in (("workshops.html", "workshop"),
                     ("challenges.html", "challenge"),
                     ("tutorials.html", "tutorial")):
        for e in parse_listing(raw_dir / fn, kind):
            catalog.setdefault(e["key"], e)

    aliases = {}
    if alias_path.exists():
        aliases = {norm_acronym(k): norm_acronym(v)
                   for k, v in (yaml.safe_load(alias_path.read_text()) or {}).items()}

    events, unmatched = [], []
    for c in merge_runs(parse_grid(raw_dir / "satellite-program.pdf")):
        key = aliases.get(c["key"], c["key"])
        info = catalog.get(key)
        if info is None:                      # try the first segment of "A | B | C"
            info = catalog.get(key.split(" | ")[0].strip())
        if info is None:
            for ck, cv in catalog.items():    # or a listing key that starts with it
                if ck.startswith(key + " ") or ck.split(" | ")[0].strip() == key:
                    info = cv
                    break
        if info is None:
            unmatched.append(f'{c["acronym_raw"]}  ({c["room"]}, {c["start"][:10]})')

        y, mo, dd = c["day"]
        events.append({
            "id": f'sat:{y:04d}-{mo:02d}-{dd:02d}:{slug(c["room"])}:{c["slot"]}',
            "acronym": c["acronym_raw"],
            "name": info["name"] if info else None,
            "type": info["type"] if info else c["type"],
            "theme": c["theme"],
            "room": c["room"],
            "floor": c["floor"],
            "start": c["start"],
            "end": c["end"],
            "url": info["url"] if info else None,
            "contact": info["contact"] if info else None,
            "matched": info is not None,
        })
    events.sort(key=lambda e: (e["start"], e["room"]))
    return events, unmatched


if __name__ == "__main__":
    raw = Path("data/raw/2026-09-19")
    ev, un = build(raw, Path("config/satellite-aliases.yaml"))
    print(f"events: {len(ev)}   matched: {sum(e['matched'] for e in ev)}   unmatched: {len(un)}")
    for u in un:
        print("  ?", u)
