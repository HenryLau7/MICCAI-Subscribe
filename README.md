# MICCAI Subscribe

A mobile-first companion for the MICCAI 2026 program — search 1,100+ papers by
title, author or institution, bookmark the talks you want, follow people and
labs, and take the result to your calendar.

**This is an independent, unofficial community tool.** It is not affiliated
with, endorsed by, or produced by the MICCAI Society or the MICCAI 2026
organizers, and it uses none of their branding. The official program is the
authority; always confirm times and rooms on-site.

---

## What it does

- **Search** across papers, authors, institutions, board numbers and satellite
  events. Matching is substring-based and runs entirely in the browser.
- **Bookmark** individual presentations, or **follow** an author or an
  institution and have everything they present gathered automatically.
- **A day-by-day schedule** with conflict warnings, and a banner when a saved
  item disappears from a revised program rather than silently dropping it.
- **Calendar export** — an `.ics` file built client-side, with a reminder
  offset you choose. On a phone it can also go straight to the share sheet.
- **Satellite events** for the two bookend days, browsable as a list or as a
  room × time-slot grid.
- **Move to another device** with a transfer link that carries your selections
  in the URL fragment, which browsers never send to a server.
- **Works offline.** After the first visit the app and the program bundle are
  both cached, which is the difference between usable and useless on venue
  Wi-Fi.

No account, no backend, no tracking. Bookmarks and follows live in your
browser's local storage and nowhere else.

## How it is built

Two halves that meet at a JSON file:

```
official MICCAI PDFs + listing pages
            │
            │   scripts/*.py        (build time, Python)
            ▼
  data/processed/program.min.json   (~386 KB raw, ~130 KB gzipped)
            │
            │   web/                (runtime, React + TypeScript + Vite)
            ▼
     a static, offline-first PWA
```

The pipeline parses the official PDFs into a canonical `program.json`, gated by
`scripts/validate.py`, and emits a compact `program.min.json` for the browser.
The frontend is a **pure static SPA**: it downloads that one bundle, builds its
search index in memory, and does everything else locally. There is no server
component anywhere in this repository.

## Quick start

Requires Python 3.12+ and Node (see `.node-version`).

```bash
# 1. Build the data (optional — data/processed is committed)
pip install -r requirements.txt
python3 scripts/fetch.py     # -> data/raw/<today>/ with sha256 manifest
python3 scripts/build.py     # -> data/processed/, fails loudly if validate.py objects

# 2. Run the app
cd web
npm ci
npm run dev                  # `sync` copies program.min.json into public/ first
```

`web/public/data/program.min.json` is generated, not committed. `npm run dev`,
`npm run build` and `npm test` all run the sync step for you; running `vitest`
directly does not, and your editor will complain about a missing module until
you do.

## Repository layout

| path | what lives there |
|---|---|
| `scripts/` | the Python importer — fetch, parse, validate, build. See `scripts/README.md`. |
| `config/` | hand-maintained parser inputs: satellite acronym aliases, program events. |
| `data/raw/` | archived copies of every source file, with checksums. |
| `data/processed/` | `program.json` (canonical, reviewable) and `program.min.json` (what ships). |
| `web/src/` | the app. `routes/` are pages, `ui/` are components, `store/` is state and schedule logic, `search/` is the index, `calendar/` is `.ics` generation. |
| `web/test/` | the test suite, one file per area. |
| `.github/workflows/` | the daily data refresh. |

## The data, and how much to trust it

Everything comes from the two official MICCAI 2026 program PDFs and three
listing pages. The revision date the app displays is the revision it parsed.

Three things are worth knowing before you build on this data:

- **The official schedule is marked TENTATIVE** and does change. Its *structure*
  changed once mid-flight — a revision dropped an entire column — which is why
  `validate.py` is a hard gate that fails the build rather than shipping
  half-parsed data.
- **There are no per-talk times.** The program publishes session windows only.
  Dividing a 90-minute session by twelve would fabricate times and make someone
  miss a talk, so a calendar export is one event per *session*, never per talk.
- **An author is a name string.** The source carries no ORCIDs, and several
  hundred names appear under more than one affiliation. The UI says so plainly,
  and shows paper counts and institutions instead of pretending to have
  resolved identity.

Where the source has nothing — no abstracts, no paper URLs, no poster hall name
— the app renders nothing. It never fills a gap with a placeholder.

## Daily refresh

`.github/workflows/build-data.yml` re-fetches the sources every day at 05:00
UTC, rebuilds, and **opens a pull request when the content actually changed**.
It never auto-merges: a human has to read the diff. `data/processed/diff-report.md`
summarises what moved.

When the workflow fails, it is almost always the parser meeting a changed PDF:

1. Download the run's artifact — it holds the exact files that broke the parse.
2. Compare the new PDF against the previous day's copy in `data/raw/`.
3. Fix the parser (`scripts/parse_main.py` / `scripts/parse_satellite.py`) and
   reproduce locally with `python3 scripts/build.py` until `validate.py` reports
   zero errors.

Do not loosen `validate.py`'s thresholds to make a failure go away. That gate
exists because an earlier, undetected version of exactly this problem shipped.

## Deploying

The site is static; anything that serves files will do. It is set up for
Cloudflare Pages:

| Setting | Value |
|---|---|
| Build command | `cd web && npm ci && npm run build` |
| Output directory | `web/dist` |
| Node version | read from `.node-version` |

`web/public/_redirects` rewrites every path to `index.html` so client-side
routing works, and `web/public/_headers` sets `no-cache` on app routes so a
deploy is picked up immediately. After the first deploy, confirm the headers
survived the rewrite on a deep route, not just at the root:

```bash
curl -sI https://<your-domain>/paper/M-PM-001 | grep -i cache-control
```

A one-off manual deploy, if you'd rather not wait on the Git integration:

```bash
cd web && npm ci && npm run build
npx wrangler pages deploy dist --project-name=<your-project>
```

## Quality gates

```bash
cd web
npm test                        # 252 tests across 24 files
npx tsc -b                      # typechecks src/ and test/
npm run lint                    # oxlint
npm run build                   # prints gzip sizes; budget is 150 KB
node scripts/verify-offline.mjs # drives real headless Chrome with the network cut
TZ=Pacific/Kiritimati npm test  # the suite must not depend on the local timezone
```

The offline gate is not a formality: it runs a production build in a real
browser, cuts the network at the protocol layer, and asserts the app still
renders and still searches. Run it after touching the PWA config or
`src/data/load.ts`.

## Before you change things

A few decisions here look arbitrary and are not:

- **`program.min.json` has exactly one cache writer.** `src/data/load.ts` owns
  the `miccai-program-v1` bucket with hand-written stale-while-revalidate;
  Workbox must never precache or runtime-cache it. Two writers means a stale
  program served after a refresh, invisible until the conference. There are
  tests for this in both directions.
- **Nothing inside a single session is a conflict.** Five bookmarked posters in
  one two-hour session are five easy walks; two talks in one oral session are
  one room and one seat. Calling either a "conflict" trains people to ignore the
  badge that matters.
- **A bookmark that stops resolving is reported, never dropped.** The schedule is
  tentative and refreshed daily, so a saved talk can be withdrawn out from under
  someone mid-conference. Silently deleting it is the one way this app can
  destroy data.
- **Type colours are three functional groups, not six hues.** Six were tried; a
  protanopia/deuteranopia simulation put several pairs too close to tell apart.
  The text label on every badge is the real guarantee — colour only reinforces it.
- **The `crossorigin` attribute on the preload in `index.html` is load-bearing.**
  Without it the preload is a no-cors request that never gets reused, and the
  386 KB bundle downloads twice.
- **Never overpromise calendar sync.** A subscribed feed that clients refresh
  daily is close to useless for a five-day conference, and the UI says so
  instead of implying otherwise.

## Contributing

Issues and pull requests are welcome, especially parser fixes when the official
PDFs move. Please keep the test suite green and run the typecheck and linter
before opening a PR.
