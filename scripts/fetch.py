"""Download the official sources into data/raw/<date>/ and record their hashes."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

BASE = "https://conferences.miccai.org/2026"
SOURCES = {
    "main-program.pdf": f"{BASE}/files/downloads/MICCAI2026-Main-Conference-Oral-and-Poster-Program.pdf",
    "satellite-program.pdf": f"{BASE}/files/downloads/MICCAI2026-Satellite-Events-Program.pdf",
    "workshops.html": f"{BASE}/en/workshops.asp",
    "challenges.html": f"{BASE}/en/challenges.asp",
    "tutorials.html": f"{BASE}/en/tutorials.asp",
}


def fetch(dest_dir: Path) -> dict:
    dest_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(), "files": {}}
    for name, url in SOURCES.items():
        req = urllib.request.Request(url, headers={"User-Agent": "miccai-subscribe-importer/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            etag = r.headers.get("ETag")
        (dest_dir / name).write_bytes(body)
        manifest["files"][name] = {
            "url": url, "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(), "etag": etag,
        }
        print(f"  {name:24} {len(body):>9,} B  {manifest['files'][name]['sha256'][:16]}")
    (dest_dir / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    day = sys.argv[1] if len(sys.argv) > 1 else dt.date.today().isoformat()
    print(f"fetching into data/raw/{day}/")
    fetch(Path("data/raw") / day)
