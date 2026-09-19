"""Parse the MICCAI 2026 main-conference program PDF into structured records.

Two very different regions, parsed two different ways:

  * Poster region  -- a borderless 2-column table (board number | content).
                      PyMuPDF's table finder recovers it exactly, including
                      records that spill across a page break (board cell empty).
  * Oral region    -- a 3-column layout.  Each talk is a contiguous run of text
                      lines; entries are separated by exactly one blank line.
                      We bin words into columns by x, rebuild lines by y, then
                      split on vertical gaps.

Oral entries carry only a title + one presenter.  Every oral paper also has a
poster slot (verified 153/153), so we recover the full author list by matching
the oral title against the poster index.
"""
from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).parent))
from common import fold, split_presenter, split_people, canonical_affiliation, title_key, slug

TZ = "+02:00"  # Europe/Paris, CEST — the whole conference is before the 2026-10-25 DST change
BOARD_RE = re.compile(r"^[MTW]-(?:AM|PM)-\d{3}$")
MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], 1)}

# Column x-boundaries of the 3-column oral layout (page width 792pt landscape).
COLS = [(36, 275), (276, 515), (516, 792)]

POSTER_HDR_RE = re.compile(r"Poster Session (\d)\s*[–-]\s*(.+)")
DATE_RE = re.compile(
    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+"
    r"(\w+)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})")
ORAL_BLOCK_RE = re.compile(
    r"Oral (?:& Spotlight )?Sessions? (\d):\s*"
    r"(?:Monday|Tuesday|Wednesday|Thursday|Friday),\s+(\w+)\s+(\d{1,2}),\s+(\d{4}),\s+"
    r"(\d{1,2}):(\d{2})\s+to\s+(\d{1,2}):(\d{2})")
SESSION_HDR_RE = re.compile(r"Oral (?:& Spotlight )?Session (O\d[A-C])")


def iso(y, mon, day, hh, mm) -> str:
    return f"{y:04d}-{mon:02d}-{day:02d}T{hh:02d}:{mm:02d}:00{TZ}"


# --------------------------------------------------------------------------- posters

def parse_posters(doc) -> tuple[dict, list]:
    papers: dict[str, dict] = {}
    sessions: list[dict] = []
    order: list[str] = []
    current_session = None
    last_board = None

    for page in doc:
        text = page.get_text()
        m = POSTER_HDR_RE.search(text)
        if m:
            after = text[m.end():]
            dm = DATE_RE.search(after)
            if dm:
                _, mon, day, year, sh, sm, eh, em = dm.groups()
                current_session = f"P{m.group(1)}"
                sessions.append({
                    "id": current_session,
                    "kind": "poster",
                    "name": f"Poster Session {m.group(1)} – {fold(m.group(2))}",
                    "start": iso(int(year), MONTHS[mon], int(day), int(sh), int(sm)),
                    "end": iso(int(year), MONTHS[mon], int(day), int(eh), int(em)),
                    "room": None,
                    "chairs": [],
                })

        tables = [t for t in page.find_tables().tables if t.col_count == 2]
        if tables:
            rows = [( (r[0] or "").strip(), " ".join((r[1] or "").split()) )
                    for t in tables for r in t.extract()]
        else:
            # Last page of the poster region carries no ruled table; fall back to
            # the linear text flow, which is in correct reading order there.
            rows = text_flow_rows(page)
        for board, body in rows:
            if BOARD_RE.match(board):
                last_board = board
                order.append(board)
                papers[board] = {"id": board, "session_id": current_session, "_raw": body}
            elif last_board and body:
                papers[last_board]["_raw"] += " " + body

    for board in order:
        p = papers[board]
        raw = " ".join(p.pop("_raw").split())
        m = re.search(r"Authors:\s*(.*?)\s*Presenters?:\s*(.*)$", raw)
        if not m:
            p["_unparsed"] = raw
            continue
        title = fold(raw[: m.start()].strip())
        authors = [fold(a) for a in m.group(1).split(",") if a.strip()]
        names, aff, country = split_presenters(m.group(2))
        p.update({
            "title": title,
            "title_key": title_key(title),
            "authors": authors,
            "presenters": names,
            "affiliation": aff,
            "country": country,
            "affiliation_canonical": canonical_affiliation(aff),
        })
    return papers, sessions


# ----------------------------------------------------------------------------- orals

PAGE_HDR_RE = re.compile(
    r"^(MICCAI 2026: Main Conference|Revised \d{4}|Oral (?:& Spotlight )?Sessions \d:)")


def header_rects(page):
    """Full-width running heads. They straddle column boundaries, so their words
    must be dropped before binning or they contaminate two columns at once."""
    return [fitz.Rect(b[:4]) for b in page.get_text("blocks")
            if PAGE_HDR_RE.match(b[4].strip())]


def column_entries(page, col_idx, skip=()):
    """Return [[(y_top, line), ...], ...] for one column, split on blank lines."""
    x0, x1 = COLS[col_idx]
    words = [w for w in page.get_text("words")
             if x0 <= (w[0] + w[2]) / 2 < x1
             and not any(r.contains(fitz.Point((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)) for r in skip)]
    if not words:
        return []
    lines: dict[int, list] = {}
    for w in words:
        lines.setdefault(round(w[1] / 3), []).append(w)
    rows = []
    for key in sorted(lines):
        ws = sorted(lines[key], key=lambda w: w[0])
        rows.append((ws[0][1], ws[0][3], " ".join(w[4] for w in ws)))

    entries, cur, prev_bottom = [], [], None
    for top, bottom, text in rows:
        if prev_bottom is not None and top - prev_bottom > 6 and cur:
            entries.append(cur)
            cur = []
        cur.append((top, text))
        prev_bottom = bottom
    if cur:
        entries.append(cur)
    return entries


def parse_orals(doc, last_oral_page, papers):
    by_key = {p["title_key"]: p for p in papers.values() if p.get("title_key")}
    sessions: dict[str, dict] = {}
    presentations: list[dict] = []
    block_time = None
    cur_session = {}   # col -> session id
    cur_kind = {}      # col -> 'oral' | 'spotlight'
    counters: dict[tuple[str, str], int] = {}

    for pno in range(last_oral_page + 1):
        page = doc[pno]
        bm = ORAL_BLOCK_RE.search(" ".join(page.get_text().split()))
        if bm:
            n, mon, day, year, sh, sm, eh, em = bm.groups()
            block_time = (iso(int(year), MONTHS[mon], int(day), int(sh), int(sm)),
                          iso(int(year), MONTHS[mon], int(day), int(eh), int(em)))
            cur_kind = {}

        skip = header_rects(page)
        for col in range(3):
            for entry in column_entries(page, col, skip):
                lines = [t for _, t in entry]
                head = lines[0].strip()

                flat = fold(" ".join(lines))
                sm_ = SESSION_HDR_RE.search(flat)
                if sm_:
                    sid = sm_.group(1)
                    cur_session[col] = sid
                    cur_kind[col] = "oral"
                    rest = flat[sm_.end():].strip()
                    chairs = []
                    if "Session Chairs:" in rest:
                        rest, _, ch = rest.partition("Session Chairs:")
                        chairs = split_chairs(ch)
                    rm = re.search(r"\s*(\S+ Hall)\s*$", rest.strip())
                    room = rm.group(1) if rm else None
                    name = rest[: rm.start()] if rm else rest
                    sessions[sid] = {
                        "id": sid, "kind": "oral", "name": name.strip(),
                        "start": block_time[0], "end": block_time[1],
                        "room": room, "chairs": chairs,
                    }
                    continue

                if "Session Chairs:" in flat:      # chairs spilled into their own entry
                    sid = cur_session.get(col)
                    if sid:
                        room, _, ch = flat.partition("Session Chairs:")
                        room = room.strip()
                        if room:
                            sessions[sid]["room"] = room
                        sessions[sid]["chairs"] += split_chairs(ch)
                    continue

                if head.startswith("Oral Presentations"):
                    cur_kind[col] = "oral"
                    continue
                if head.startswith("Spotlight Presentations"):
                    cur_kind[col] = "spotlight"
                    continue
                if head.startswith(("MICCAI 2026", "Revised", "Oral Sessions", "Oral & Spotlight Sessions")):
                    continue

                sid = cur_session.get(col)
                kind = cur_kind.get(col)
                if not sid or not kind:
                    continue

                joined = fold(" ".join(lines))
                paper = match_paper(joined, by_key)
                if paper is None:
                    print(f"  ! unmatched oral entry p{pno} col{col}: {joined[:70]!r}", file=sys.stderr)
                    continue
                k = (sid, kind)
                counters[k] = counters.get(k, 0) + 1
                presentations.append({
                    "id": f"{paper['id']}:oral",
                    "paper_id": paper["id"],
                    "kind": kind,
                    "session_id": sid,
                    "board_number": None,
                    "order_in_session": counters[k],
                })
    return sessions, presentations


def split_presenters(raw: str) -> tuple[list[str], str, str | None]:
    """Handles both 'A, Aff, Country' and 'A & B, Aff, Country'."""
    name, aff, country = split_presenter(raw)
    names = [n.strip() for n in re.split(r"\s*(?:&|\band\b)\s*", name) if n.strip()]
    return names, aff, country


def text_flow_rows(page) -> list[tuple[str, str]]:
    """(board, body) pairs from a page with no ruled table.

    Text before the first board number is a spillover from the previous page and
    is emitted with an empty board so the caller appends it to the open record.
    """
    text = page.get_text()
    hits = list(re.finditer(r"(?m)^([MTW]-(?:AM|PM)-\d{3})[ \t]*", text))
    rows: list[tuple[str, str]] = []
    head = text[: hits[0].start()] if hits else text
    if head.strip():
        rows.append(("", " ".join(head.split())))
    for i, h in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(text)
        rows.append((h.group(1), " ".join(text[h.end():end].split())))
    return rows


def split_chairs(rest: str) -> list[str]:
    return split_people(rest)


def match_paper(joined: str, by_key: dict):
    """Longest poster title that is a prefix of this oral entry."""
    key = title_key(joined)
    best = None
    for k, p in by_key.items():
        if len(k) > 20 and key.startswith(k) and (best is None or len(k) > len(best[0])):
            best = (k, p)
    return best[1] if best else None


def find_last_oral_page(doc) -> int:
    for i, page in enumerate(doc):
        if POSTER_HDR_RE.search(page.get_text()):
            return i - 1
    raise SystemExit("no poster section found")


def parse(pdf_path: Path) -> dict:
    doc = fitz.open(pdf_path)
    rev = re.search(r"Revised (\d{4}-\d{2}-\d{2})", doc[0].get_text())
    last_oral = find_last_oral_page(doc)
    papers, poster_sessions = parse_posters(doc)
    oral_sessions, oral_pres = parse_orals(doc, last_oral, papers)

    presentations = [{
        "id": b, "paper_id": b, "kind": "poster",
        "session_id": p["session_id"], "board_number": b, "order_in_session": None,
    } for b, p in papers.items() if "title" in p]
    presentations += oral_pres

    by_paper: dict[str, list[str]] = {}
    for pr in presentations:
        by_paper.setdefault(pr["paper_id"], []).append(pr["id"])
    for b, p in papers.items():
        p["presentations"] = by_paper.get(b, [])
        p.pop("session_id", None)

    return {
        "source_revision": rev.group(1) if rev else None,
        "papers": [p for p in papers.values() if "title" in p],
        "unparsed": [p for p in papers.values() if "title" not in p],
        "sessions": poster_sessions + sorted(oral_sessions.values(), key=lambda s: (s["start"], s["id"])),
        "presentations": presentations,
    }


if __name__ == "__main__":
    import json
    out = parse(Path(sys.argv[1] if len(sys.argv) > 1 else "data/raw/2026-09-19/main-program.pdf"))
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in out.items()}, indent=2))
    print(json.dumps(out["papers"][0], ensure_ascii=False, indent=2))
    print(json.dumps([s for s in out["sessions"] if s["id"] in ("P1", "O1A")], ensure_ascii=False, indent=2))
