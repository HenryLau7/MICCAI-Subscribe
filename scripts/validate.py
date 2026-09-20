"""Validation gate. Non-zero exit blocks the build.

The official PDF changed its whole layout between 2026-09-08 and 2026-09-10 and
silently dropped a column. These checks exist so the next such change fails
loudly instead of shipping a half-empty program.
"""
from __future__ import annotations

import re
import sys

from common import external_url

BOARD_RE = re.compile(r"^[MTW]-(?:AM|PM)-\d{3}$")


def validate(bundle: dict, unparsed: list, unmatched_sat: list) -> tuple[list, list]:
    errors, warnings = [], []
    papers = bundle["papers"]
    sessions = bundle["sessions"]
    pres = bundle["presentations"]
    sat = bundle["satellite"]

    def check(cond, msg):
        if not cond:
            errors.append(msg)

    check(1100 <= len(papers) <= 1250, f"paper count out of range: {len(papers)}")
    orals = [p for p in pres if p["kind"] in ("oral", "spotlight")]
    check(130 <= len(orals) <= 180, f"oral/spotlight count out of range: {len(orals)}")
    check(not unparsed, f"{len(unparsed)} poster records missing Authors/Presenter: "
                        f"{[u['id'] for u in unparsed][:10]}")

    poster_sessions = [s for s in sessions if s["kind"] == "poster"]
    oral_sessions = [s for s in sessions if s["kind"] == "oral"]
    check(len(poster_sessions) == 5, f"expected 5 poster sessions, got {len(poster_sessions)}")
    check(len(oral_sessions) == 18, f"expected 18 oral sessions, got {len(oral_sessions)}")
    for s in sessions:
        check(s["start"] and s["end"], f"session {s['id']} missing times")
        if s["kind"] == "oral":
            check(bool(s["room"]), f"oral session {s['id']} missing room")
            check(bool(s["chairs"]), f"oral session {s['id']} missing chairs")

    # Derived presentation ids must be unique. presentationId() maps BOTH oral
    # and spotlight to f"{paper}:oral", so a paper carrying one of each would
    # silently collide: byPresentationId keeps only the last, while the paper's
    # presentationIds lists the id twice and the detail page renders two
    # identical rows with two bookmark buttons for one slot. No paper does this
    # today (99 oral+poster, 54 spotlight+poster, 0 oral+spotlight) — this gate
    # makes a future refresh that introduces one fail the build instead.
    pres_ids = [p["id"] for p in pres]
    dupe_pres = sorted({i for i in pres_ids if pres_ids.count(i) > 1})
    check(not dupe_pres,
          f"{len(dupe_pres)} duplicate derived presentation id(s) — a paper with both an "
          f"oral and a spotlight collides on ':oral': {dupe_pres[:10]}")

    # Every timestamp must carry the Paris offset. The frontend reads local time
    # by slicing the string (schedule.ts formatTime), so a switch to 'Z' would
    # shift every displayed time by two hours with nothing failing.
    bad_tz = [f"{s['id']}.{f}" for s in sessions + sat for f in ("start", "end")
              if (s.get(f) or "") and not str(s[f]).endswith("+02:00")]
    check(not bad_tz,
          f"{len(bad_tz)} timestamp(s) not in +02:00 Europe/Paris offset form "
          f"(the UI slices the string, so this shifts every shown time): {bad_tz[:10]}")

    boards = [p["id"] for p in papers]
    check(all(BOARD_RE.match(b) for b in boards), "malformed board number present")
    check(len(set(boards)) == len(boards), "duplicate board numbers")

    linked = sum(1 for p in papers if len(p["presentations"]) > 1)
    if orals:
        rate = linked / len(orals)
        check(rate >= 0.95,
              f"only {rate:.0%} of oral talks linked to a poster record (expected >=95%)")

    check(95 <= len(sat) <= 130, f"satellite event count out of range: {len(sat)}")
    # Two events can share a room and a start slot, and the id is also a
    # bookmark key living in localStorage across refreshes. A collision made
    # one event replace the other everywhere it is opened, bookmarked or
    # exported, and shipped that way unnoticed.
    sat_ids = [e["id"] for e in sat]
    dupe_sat = sorted({i for i in sat_ids if sat_ids.count(i) > 1})
    check(not dupe_sat,
          f"{len(dupe_sat)} duplicate satellite event id(s) — one event replaces the other "
          f"everywhere it is opened, bookmarked or exported: {dupe_sat[:10]}")

    bad_url = [e["id"] for e in sat if e.get("url") and external_url(e["url"]) != e["url"]]
    check(not bad_url,
          f"{len(bad_url)} satellite event(s) whose url is not an absolute http(s) link — it "
          f"ships as the 'organizer website' button and as the .ics URL property: {bad_url[:10]}")
    no_room = [e["id"] for e in sat if not e.get("room")]
    check(not no_room,
          f"{len(no_room)} satellite event(s) missing room (would emit a malformed "
          f"LOCATION like \", Strasbourg Convention Center\" in the .ics export): {no_room[:10]}")
    if unmatched_sat:
        warnings.append(f"{len(unmatched_sat)} satellite acronyms unresolved: {unmatched_sat}")

    for s in sessions + sat:
        for field in ("start", "end"):
            d = (s.get(field) or "")[:10]
            if d and not ("2026-09-27" <= d <= "2026-10-01"):
                errors.append(f"{s['id']} {field} outside conference window: {d}")

    missing_author = [p["id"] for p in papers if not p["authors"]]
    if missing_author:
        warnings.append(f"{len(missing_author)} papers with empty author list: {missing_author[:10]}")
    no_country = [p["id"] for p in papers if not p.get("country")]
    if no_country:
        warnings.append(f"{len(no_country)} papers whose presenter country did not parse "
                        f"(affiliation kept verbatim): {no_country[:10]}")
    return errors, warnings


def report(errors, warnings) -> int:
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  FAIL  {e}", file=sys.stderr)
    print(f"validation: {len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0
