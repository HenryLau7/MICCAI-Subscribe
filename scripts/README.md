# Program importer

Turns the official MICCAI 2026 PDFs and listing pages into
`data/processed/program.json`. Build-time only — nothing here runs in
production.

```bash
pip install -r requirements.txt
python3 scripts/fetch.py            # -> data/raw/<today>/ + MANIFEST.json (sha256)
python3 scripts/build.py            # -> data/processed/{program.json,program.min.json,diff-report.md}
```

`build.py` exits non-zero if `validate.py` finds a problem, and writes nothing
in that case.

| script | does |
|---|---|
| `fetch.py` | downloads the 5 official sources, archives them, records sha256 + ETag |
| `parse_main.py` | main-conference PDF -> papers, sessions, presentations |
| `parse_satellite.py` | satellite grid PDF + 3 listing pages -> satellite events |
| `parse_glance.py` | keynotes/ceremonies from the **superseded** at-a-glance grid -> review draft |
| `validate.py` | the gate (counts, ranges, uniqueness, link rate, date window) |
| `build.py` | assembles, validates, emits, diffs against the previous build |
| `common.py` | diacritic folding, presenter/country splitting, affiliation canonicalisation |

## Why two parsing strategies

The main PDF has two regions that need different handling:

- **Poster region** — a borderless 2-column table (board number | content).
  PyMuPDF's table finder recovers it exactly, including records that spill
  across a page break. The final page carries no ruled table, so there is a
  text-flow fallback for it.
- **Oral region** — 3 columns. Words are binned into columns by x, lines are
  rebuilt by y, and entries are split on vertical gaps. Full-width running
  heads straddle two columns, so their rectangles are excluded before binning.

Oral entries print only a title and one presenter. Every oral paper also has a
poster slot (153/153), so the full author list is recovered by matching the
oral title against the poster index.

## Output

`program.json` is canonical and human-reviewable (committed, so `diff-report.md`
is meaningful). `program.min.json` is what the browser downloads: positional
arrays with author/affiliation strings dictionary-encoded, ~129 KB gzipped.

## Known soft spots

- `config/satellite-aliases.yaml` — the grid and the listing pages spell six
  joint events differently. Unresolvable acronyms are reported, never dropped.
- `config/program-events.yaml` — keynotes/ceremonies, extracted from the
  superseded 2026-09-08 grid. Times are unconfirmed; nothing is emitted into
  `program.json` until a human sets `needs_review: false`.
- Poster session rooms are `null`. The official sources do not name the poster
  hall anywhere (checked 2026-09-19).
