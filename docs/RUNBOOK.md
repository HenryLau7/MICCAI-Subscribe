# RUNBOOK

For whoever is on point during the conference, probably standing in the
Strasbourg Convention Center on bad Wi-Fi at 08:00. Every command below can be
copy-pasted as-is from a phone or a laptop terminal. Nothing in this file
deploys anything by itself — every deploy/DNS/account action still needs a
human with access to the Cloudflare account to actually run it.

There is no cloud sync (Task 13 was cut). The site is a static, offline-first
PWA on Cloudflare Pages. There is no Worker and no KV store to troubleshoot —
if you're looking for "Worker broke" or "export KV", that infrastructure does
not exist in this build; skip to whichever section below actually matches
what's wrong.

---

## 1. One-time deploy setup (do this once, before launch)

**Cloudflare Pages dashboard** (Workers & Pages -> Create -> Pages -> Connect
to Git):

| Setting | Value |
|---|---|
| Repository | this repo, branch `main` |
| Build command | `cd web && npm ci && npm run build` |
| Build output directory | `web/dist` |
| Root directory | `/` (leave default — the build command does its own `cd`) |
| Node version | Cloudflare reads `.node-version` at the repo root automatically. If your build image doesn't have that exact version yet, set the `NODE_VERSION` environment variable in Project Settings -> Environment variables to the contents of that file, or the nearest available major version. |

After the first successful build, in **Custom domains**: add
`miccaisubscribe.com`, point its DNS at Cloudflare per the on-screen
instructions, and confirm the padlock (HTTPS) is green. Then in
**SSL/TLS -> Edge Certificates**, turn on **"Always Use HTTPS"** and
**HSTS**. These are zone-level dashboard toggles — there is nothing in this
repo that sets them, and nothing here should be trusted to have set them for
you. Check them by hand:

```bash
curl -sI http://miccaisubscribe.com/ | grep -i location   # should redirect to https
curl -sI https://miccaisubscribe.com/ | grep -i strict-transport-security
```

**One-command manual deploy** (for a one-off push without waiting on the Git
integration, e.g. if the dashboard build is stuck): from the repo root,
authenticated as yourself (`npx wrangler login` — interactive, one time):

```bash
cd web && npm ci && npm run build && npx wrangler pages deploy dist --project-name=<your-pages-project-name>
```

Nothing in this repo runs that command for you. It touches your Cloudflare
account and only you can authorise it.

---

## 2. Daily data refresh during the conference

### Normal path: let the workflow do it

`.github/workflows/build-data.yml` runs every day at **05:00 UTC (07:00
CEST)**, re-fetches the five official sources, rebuilds
`data/processed/program.json`, and — **only if the program content actually
changed** — opens a pull request titled `chore(data): daily program refresh`
with `diff-report.md` in the description.

**It never auto-merges.** Every PR needs a human to:

1. Open the PR, read the diff (papers added/removed/retitled, session
   time/room moves are in the description; satellite-event and
   author/affiliation changes are not summarized there — check the
   `data/processed/program.json` diff in the Files tab too).
2. Spot-check anything that looks surprising against the actual PDFs in
   `data/raw/<today>/`.
3. Merge it (this alone does not deploy — merging to `main` triggers
   Cloudflare Pages' own build via the Git integration set up in §1; that
   picks up the new `program.json` and rebuilds `program.min.json` through
   `npm run sync`).

If a day passes with **no PR and no failed workflow run**, that's correct and
expected — it means the official program didn't change.

If the workflow run is **red (failed)**, do not assume "no changes, nothing
to do" — go to §4.

### If you need it right now and can't wait for the schedule

Trigger the workflow manually from the Actions tab (`Daily data refresh` ->
`Run workflow`), or run it locally:

```bash
pip install -r requirements.txt
python3 scripts/fetch.py
python3 scripts/build.py
```

`build.py` prints `validation: N error(s), M warning(s)` at the end. `N` must
be `0` — if it isn't, it has already refused to write any output (see §4).
On success, check what changed before doing anything else:

```bash
cat data/processed/diff-report.md
git diff --stat data/processed/
```

Commit and push (or open a PR by hand) the same way the automated workflow
would — do not skip human review just because you ran it by hand instead of
letting the schedule trigger it.

---

## 3. Rolling back a bad deploy

Cloudflare Pages keeps every deployment. This is a dashboard action, one
click, no CLI needed:

1. Cloudflare dashboard -> Workers & Pages -> your project -> **Deployments**.
2. Find the last deployment you know was good (by timestamp or commit
   message).
3. Click the `···` menu on that row -> **Rollback to this deployment**.

This repoints the production alias immediately; it does not delete the bad
deployment, so you can roll forward again once it's fixed. There is no
database or KV state to worry about losing — the whole app is static files
plus whatever's cached in each visitor's own browser.

If the bad deploy is currently serving cached HTML to returning visitors
because of `public/_headers`'s cache rules not taking effect for some reason,
have them hard-reload (or clear the site's data in DevTools -> Application
-> Storage) — but this should not normally be necessary, since
`index.html`, `sw.js`, and `program.min.json` are all served
`Cache-Control: no-cache` by design (see `web/public/_headers`), specifically
so a rollback or a data refresh is visible on next load without anyone
needing to know to hard-reload.

---

## 4. If the official PDF's structure changes again

This already happened once, silently, between the 2026-09-08 and 2026-09-10
revisions (a column disappeared). `scripts/validate.py` exists specifically
to catch a repeat and fail loudly instead of shipping a half-empty program.
If `scripts/build.py` exits non-zero — whether run by the daily workflow or
by hand — **no output file is touched**; the site keeps serving whatever it
was already serving.

1. Read the `FAIL` lines `build.py` printed (they go to stderr; in the
   GitHub Actions run, they're in the "Build + validate program bundle" step
   log — that step will be the one with the red X).
2. If the run was via the workflow, download the `failed-fetch-raw-sources`
   artifact from the failed run's Summary page — it's the exact PDFs/HTML
   that broke the parser, so you don't have to re-fetch to look at them.
   Locally: `data/raw/<today>/`.
3. Open `data/raw/<today>/main-program.pdf` (or `satellite-program.pdf`) and
   compare its layout by eye against the previous day's archived copy in
   `data/raw/<earlier-date>/`.
4. The parser lives in `scripts/parse_main.py` / `scripts/parse_satellite.py`
   (see `scripts/README.md` for how each one works — table-finder for the
   poster region, x/y-binning for the oral region, grid parsing for
   satellite). Fixing it is a real code change, not a config tweak — treat it
   like any other bug: reproduce locally with
   `python3 scripts/build.py`, isolate the change in the new PDF, patch the
   parser, re-run until `validate.py` reports 0 errors.
5. Once it builds clean locally, push the fix and let the daily workflow (or
   a manual trigger) produce the refreshed data as a normal reviewed PR.

Do not loosen `validate.py`'s thresholds to make a failure go away without
first understanding why the counts moved — that gate is there because a
previous, undetected version of exactly this problem is why it exists at all.

---

## 5. Running the offline gate

`web/scripts/verify-offline.mjs` drives a real headless Chrome against a real
production build and asserts the app actually works with the network cut,
not just that the service worker registered. Run it after any change to
`vite.config.ts`'s PWA config, `src/data/load.ts`'s caching, or before any
deploy you're not 100% sure about:

```bash
cd web
npm run build
node scripts/verify-offline.mjs
```

It exits non-zero if any assertion fails, and prints a `PASS`/`FAIL` line per
check plus a final `N/M assertions passed.` summary. On macOS it expects
Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; set
`CHROME_PATH` to override. See the header comment in the script for the full
list of environment variables (`PREVIEW_PORT`, `PREVIEW_HOST`, `CDP_PORT`) —
`vite preview` binds IPv6-only in this environment, which is why the default
`PREVIEW_HOST` is `::1`, not `localhost`.

---

## 6. Pre-launch checklist — outstanding manual QA (do not skip)

These cannot be verified from this environment and were not silently marked
done. Someone with a phone, the built site, and about 30 minutes needs to
walk through all of them before the satellite events start.

The first two are **post-deploy checks** — they cannot be run until the site
is actually live, so do them immediately after every deploy, not just once
before launch:

- [ ] **Verify the cache headers actually landed on a deep route, not just
      the root.** `web/public/_headers` sets `Cache-Control: no-cache` on
      every known app route (`/paper/*`, `/search`, `/schedule`, ...) as well
      as on `/` and `/index.html`, specifically because Cloudflare's own
      docs do not say whether `_headers` matching happens against the
      original request path or the post-`_redirects`-rewrite destination —
      that could only be settled by deploying, which is exactly what this
      check is for:
      ```bash
      curl -sI https://miccaisubscribe.com/paper/M-PM-001 | grep -i cache-control
      ```
      **Good answer:** `cache-control: no-cache` (or another header that
      forces revalidation — anything that is *not* a `max-age`/`public`
      value with no revalidation). **If it comes back cacheable instead**
      (missing entirely, or `public, max-age=...` with no `no-cache`/
      `must-revalidate`): the rules in `_headers` are not matching that
      route. Don't guess — add a Cloudflare dashboard **Cache Rule** (zone
      level, under Caching -> Cache Rules) that forces `Cache-Control:
      no-cache` on `text/html` responses as a fallback that doesn't depend
      on `_headers`' path-matching ambiguity at all, then re-run this same
      `curl` to confirm it took effect.
- [ ] **Re-measure LCP against the live edge, throttled** — not against
      local `vite preview` (which is what this task's automated QA used; see
      the task report). Run Lighthouse (mobile, simulated or real
      throttling) against `https://miccaisubscribe.com/`. **This is not
      expected to be a pure local-testing artifact**: the critical path is
      roughly 98 KB gzip of JS plus fetching and decoding the entire program
      bundle before first meaningful paint, which is inherent to this
      client-rendered architecture, not something the edge alone fixes. The
      edge will likely improve on the ~2.5 s measured locally, but probably
      not down to the SPEC's 1.5 s target. **The mitigation already built
      in is the service worker**: a *returning* visitor is served the shell
      and (if cached) the program data straight from Cache Storage and does
      not pay this cost — so the real risk is concentrated on a visitor's
      **first** load, on venue Wi-Fi, which is exactly the worst network for
      it. Record the actual number here and judge plainly whether that
      first-visit cost is acceptable; do not round it down or explain it
      away.

- [ ] **Real calendar import.** Download the `.ics` export and import it into
      **Apple Calendar, Google Calendar, and Outlook** (at least one desktop
      and one mobile client each, if you can). Confirm the P1 poster event
      (Segmentation, Registration and Detection) lands at
      **2026-09-28 16:00–18:00, Europe/Paris**. Then change the device's
      system timezone to **Asia/Shanghai** and confirm the same event still
      displays at the correct wall-clock time in Strasbourg (i.e. the client
      correctly converted, not just echoed, the `+02:00` offset). Automated
      tests only assert the raw `DTSTART`/`DTEND` bytes in the generated
      `.ics` file — nothing in this repo proves a real calendar client
      parses them correctly.
- [ ] **Real-device QA**, not just headless Chrome: iPhone Safari and Android
      Chrome, at minimum. Check: no horizontal scroll at 320px width, the
      bottom nav bar isn't obscured by the iPhone home indicator, and the
      app is actually browsable with the device in Airplane Mode after one
      prior online visit.
- [ ] **Loaded-state visual QA on a real device or real (non-headless)
      browser.** Every screenshot taken in this environment captured the
      loading skeleton, not the loaded app — headless `--screenshot` fires
      before the program-data promise resolves, and
      `--virtual-time-budget` hangs on the service worker's `caches.open()`
      call. Nobody has visually reviewed the loaded state of any page in
      this environment. Open the deployed site in an ordinary browser
      window and actually look at it.

None of the automated QA in this task's report (data-correctness spot
checks, the offline gate, the test suite across timezones, bundle size,
Lighthouse/axe scores) substitutes for these five. They need either a live
deploy, a human, a real device, or a real network — several need all four.
