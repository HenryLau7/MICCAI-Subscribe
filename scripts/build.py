"""Assemble data/processed/program.json from the archived raw sources."""
from __future__ import annotations

import datetime as dt
import gzip
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import parse_main
import parse_satellite
import validate as validate_mod
from common import slug

RAW_ROOT = Path("data/raw")
OUT = Path("data/processed")
SCHEMA_VERSION = 1


def latest_raw() -> Path:
    days = sorted(d for d in RAW_ROOT.iterdir()
                  if d.is_dir() and d.name[:4].isdigit() and (d / "main-program.pdf").exists())
    if not days:
        raise SystemExit("no fetched sources under data/raw/<date>/")
    return days[-1]


def derive_people(papers: list[dict]) -> tuple[list[dict], list[dict]]:
    authors: dict[str, dict] = {}
    affils: dict[str, dict] = {}
    for p in papers:
        for name in p["authors"]:
            a = authors.setdefault(slug(name), {"id": slug(name), "name": name,
                                                "papers": [], "affiliations": []})
            a["papers"].append(p["id"])
        for name in p["presenters"]:
            a = authors.setdefault(slug(name), {"id": slug(name), "name": name,
                                                "papers": [], "affiliations": []})
            if p["id"] not in a["papers"]:
                a["papers"].append(p["id"])
            if p["affiliation"] and p["affiliation"] not in a["affiliations"]:
                a["affiliations"].append(p["affiliation"])
        key = p.get("affiliation_canonical")
        if key:
            f = affils.setdefault(key, {"id": key, "name": p["affiliation"],
                                        "variants": [], "country": p.get("country"),
                                        "papers": []})
            f["papers"].append(p["id"])
            if p["affiliation"] not in f["variants"]:
                f["variants"].append(p["affiliation"])
    for f in affils.values():          # display the most common spelling
        f["name"] = max(f["variants"], key=lambda v: (sum(1 for x in f["variants"] if x == v), -len(v)))
    return (sorted(authors.values(), key=lambda a: a["id"]),
            sorted(affils.values(), key=lambda f: -len(f["papers"])))


def diff_report(new: dict, prev_path: Path) -> str:
    if not prev_path.exists():
        return "First build — no previous program.json to diff against.\n"
    prev = json.loads(prev_path.read_text(encoding="utf-8"))
    op = {p["id"]: p for p in prev["papers"]}
    np_ = {p["id"]: p for p in new["papers"]}
    added, removed = sorted(set(np_) - set(op)), sorted(set(op) - set(np_))
    retitled = [b for b in sorted(set(op) & set(np_)) if op[b]["title"] != np_[b]["title"]]
    ps = {s["id"]: s for s in prev["sessions"]}
    ns = {s["id"]: s for s in new["sessions"]}
    moved = [i for i in sorted(set(ps) & set(ns))
             if (ps[i]["start"], ps[i]["end"], ps[i]["room"]) != (ns[i]["start"], ns[i]["end"], ns[i]["room"])]
    lines = [f"# Program diff  {prev['meta']['source_revision']} -> {new['meta']['source_revision']}", ""]
    lines.append(f"papers: {len(op)} -> {len(np_)}   (+{len(added)} / -{len(removed)})")
    for b in added:
        lines.append(f"  + {b}  {np_[b]['title'][:80]}")
    for b in removed:
        lines.append(f"  - {b}  {op[b]['title'][:80]}")
    for b in retitled:
        lines.append(f"  ~ {b}  {op[b]['title'][:60]!r} -> {np_[b]['title'][:60]!r}")
    for i in moved:
        lines.append(f"  @ session {i}: {ps[i]['start']}/{ps[i]['room']} -> {ns[i]['start']}/{ns[i]['room']}")
    if not (added or removed or retitled or moved):
        lines.append("No changes to papers or sessions.")
    return "\n".join(lines) + "\n"


def compact(bundle: dict) -> dict:
    """The bundle the app downloads.

    Author and affiliation strings are dictionary-encoded (they repeat ~7x
    across papers) and records become positional arrays. Reverse indexes such
    as author -> papers are rebuilt client-side in a few ms rather than shipped.
    """
    names: dict[str, int] = {}
    affs: dict[str, int] = {}

    def ni(s: str) -> int:
        return names.setdefault(s, len(names))

    def ai(s: str) -> int:
        return affs.setdefault(s, len(affs))

    papers = [[
        p["id"], p["title"],
        [ni(a) for a in p["authors"]],
        [ni(a) for a in p["presenters"]],
        ai(p["affiliation"]) if p["affiliation"] else -1,
        p.get("country") or "",
        p.get("affiliation_canonical") or "",
    ] for p in bundle["papers"]]

    kinds = ["poster", "oral", "spotlight"]
    pres = [[pr["paper_id"], kinds.index(pr["kind"]), pr["session_id"],
             pr["order_in_session"] or 0] for pr in bundle["presentations"]]

    sessions = [[s["id"], s["kind"], s["name"], s["start"], s["end"],
                 s["room"] or "", s["chairs"]] for s in bundle["sessions"]]

    sat = [[e["id"], e["acronym"], e["name"] or "", e["type"], e["theme"] or "",
            e["room"], e["floor"] or "", e["start"], e["end"], e["url"] or ""]
           for e in bundle["satellite"]]

    return {
        "meta": {k: bundle["meta"][k] for k in
                 ("conference", "venue", "timezone", "schema_version",
                  "source_revision", "fetched_at", "generated_at", "counts")},
        "fields": {
            "papers": ["id", "title", "authors", "presenters", "affiliation", "country", "affiliation_key"],
            "presentations": ["paper_id", "kind", "session_id", "order_in_session"],
            "sessions": ["id", "kind", "name", "start", "end", "room", "chairs"],
            "satellite": ["id", "acronym", "name", "type", "theme", "room", "floor", "start", "end", "url"],
        },
        "kinds": kinds,
        "names": list(names),
        "affiliations": list(affs),
        "papers": papers,
        "presentations": pres,
        "sessions": sessions,
        "satellite": sat,
    }


def main() -> int:
    raw = latest_raw()
    print(f"building from {raw}")
    manifest = json.loads((raw / "MANIFEST.json").read_text()) if (raw / "MANIFEST.json").exists() else {}

    main_data = parse_main.parse(raw / "main-program.pdf")
    sat_events, sat_unmatched = parse_satellite.build(raw, Path("config/satellite-aliases.yaml"))
    for e in sat_events:
        e.pop("matched", None)

    authors, affiliations = derive_people(main_data["papers"])

    bundle = {
        "meta": {
            "conference": "MICCAI 2026",
            "venue": "Strasbourg Convention Center, Strasbourg, France",
            "timezone": "Europe/Paris",
            "schema_version": SCHEMA_VERSION,
            "source_revision": main_data["source_revision"],
            "fetched_at": manifest.get("fetched_at"),
            "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "sources": manifest.get("files", {}),
            "counts": {},
        },
        "papers": main_data["papers"],
        "sessions": main_data["sessions"],
        "presentations": main_data["presentations"],
        "satellite": sat_events,
        "authors": authors,
        "affiliations": affiliations,
        "program_events": [],   # awaiting human confirmation, see config/program-events.yaml
    }
    bundle["meta"]["counts"] = {
        "papers": len(bundle["papers"]),
        "presentations": len(bundle["presentations"]),
        "sessions": len(bundle["sessions"]),
        "satellite": len(bundle["satellite"]),
        "authors": len(bundle["authors"]),
        "affiliations": len(bundle["affiliations"]),
    }

    errors, warnings = validate_mod.validate(bundle, main_data["unparsed"], sat_unmatched)
    rc = validate_mod.report(errors, warnings)
    if rc:
        print("build aborted; no artefacts written", file=sys.stderr)
        return rc

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "diff-report.md").write_text(diff_report(bundle, OUT / "program.json"), encoding="utf-8")
    payload = json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).encode()
    (OUT / "program.json").write_bytes(payload)
    (OUT / "program.meta.json").write_text(
        json.dumps(bundle["meta"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    mini = json.dumps(compact(bundle), ensure_ascii=False, separators=(",", ":")).encode()
    (OUT / "program.min.json").write_bytes(mini)

    gz = len(gzip.compress(payload, 9))
    mgz = len(gzip.compress(mini, 9))
    print(f"\nwrote {OUT/'program.json'}      {len(payload)/1024:>6.0f} KB raw / {gz/1024:>5.0f} KB gzip  (canonical, for review)")
    print(f"wrote {OUT/'program.min.json'}  {len(mini)/1024:>6.0f} KB raw / {mgz/1024:>5.0f} KB gzip  (shipped to the browser)")
    for k, v in bundle["meta"]["counts"].items():
        print(f"  {k:14} {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
