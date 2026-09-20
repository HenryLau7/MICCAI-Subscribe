# MICCAI Subscribe — Handoff

**Written:** 2026-09-20 · **Ships:** 2026-09-27 (satellite events) / 2026-09-28 (main conference) — **7 days**
**Branch:** `feat/web-app`, 32 commits on `main` @ `4ed5122`, HEAD `a2773c9`, working tree clean
**State:** 13 of 14 tasks complete · 1 deliberately cut · **final whole-branch review DONE — verdict: ship with fixes, and the fixes are in**

> **What is left is the four human-only steps in §4.3.** No code task remains. The most
> important of them is importing the generated `.ics` into a real calendar client: it is the
> last undischarged obligation and no test can substitute for it.

---

## 1. What this is

An unofficial, mobile-first web app for MICCAI 2026 (Strasbourg, 27 Sep – 1 Oct). A delegate opens it on a phone in a corridor, searches 1165 papers by title / author / institution, bookmarks talks or follows people and institutions, sees a day-by-day schedule with conflict warnings, and exports it to their calendar.

Read **`SPEC.md` (v0.3)** first — it is the authority, and every data claim in it was measured, not assumed. Then `docs/superpowers/plans/2026-09-19-miccai-subscribe-web-app.md`.

## 2. Architecture in one breath

A build-time Python pipeline (`scripts/`) parses the official MICCAI PDFs into `data/processed/program.min.json` (386 KB raw / ~129 KB gzip). The frontend (`web/`, Vite + React + TS + Tailwind v4) is a **pure static SPA** — it downloads that bundle once and does everything in memory. No backend, no accounts. Bookmarks live in `localStorage`. Calendar export is generated client-side.

Ships to Cloudflare Pages. **Nothing has been deployed** — that is the user's action on their own account.

## 3. Current numbers

| | |
|---|---|
| Tests | **225/225**, 22 files, green under Europe/Paris, Asia/Shanghai, America/Los_Angeles, Pacific/Kiritimati |
| Typecheck | `npx tsc -b` clean — **covers `src/` and `test/`** |
| Lint | `npm run lint` (oxlint) clean |
| Bundle | **104.69 KB gzip** (99.93 JS + 4.76 CSS) against a 150 KB budget |
| Service worker | ~6.1 KB gzip, separate |
| Offline gate | `node web/scripts/verify-offline.mjs` → **11/11** |
| Data | 1165 papers · 1318 presentations · 23 sessions · 111 satellite events |

## 4. What is NOT done

### 4.1 The final whole-branch review — DONE
It ran on 2026-09-20 and returned **ship with fixes**. It found no structural problems: every
issue was a leaf-level string or a four-line predicate, which is the right outcome for a branch
whose seams had never been reviewed together. All eight must-fix items are fixed in `a2773c9`;
the full reasoning is in that commit message and in `progress.md`.

The two worth knowing about:
- Two bookmarked **talks in the same session** rendered a red "Time conflict". The same-session
  escape hatch was gated on both items being posters. 9 of the 18 oral sessions hold 6 orals +
  6 spotlights in one 90-minute window, so it fired on the most common user action — and made
  `/schedule` contradict the `.ics`, which correctly merges those two items into one event.
- `About`'s Privacy section described generating a calendar subscription link as the only way
  data leaves your device. That control ships **disabled** (Task 13 was cut), so the one place
  the UI described itself, it described a feature that does not exist.

Seams the review checked and found **sound** — do not re-audit these: the presentation-id rule
(`:oral` appears in exactly two places in the tree; no consumer parses an id), the `StoredState`
flow through storage → provider → schedule → calendar → transfer, and timezone handling end to
end (and it empirically proved the TZ tests are not tautological). Details in `progress.md`.

All 30 deferred items are triaged in `deferred-items.md`: 3 fixed, 11 dropped, 8 real but not
launch-blocking, 5 of 6 CARRY INTO obligations verified discharged in code.

### 4.2 Task 13 was cut, deliberately
The Cloudflare Worker + KV cross-device sync and subscription feed. The plan's own cut-list named it first. The product degrades **honestly**: the calendar page ships its generate-link control disabled and labelled "not yet available", beside a warning that calendar apps may refresh only daily. Download `.ics` — the primary, recommended path — is complete and works offline; cross-device movement is served by the `/import` transfer link.

There is a substantive argument beyond budget: a feed many clients refresh only daily is close to useless for a three-day conference. **Do not "finish" this without deciding it is genuinely worth it**, and do not soften that honest UI.

### 4.3 Four things only a human can do
These are in `docs/RUNBOOK.md` §6 as a pre-launch checklist. None can be faked:

1. **Deploy.** Outward-facing action on the user's Cloudflare account. `docs/RUNBOOK.md` §171-206 has the exact commands.
2. **Import the generated `.ics` into Apple Calendar, Google Calendar and Outlook.** Confirm the P1 poster event lands at **2026-09-28 16:00–18:00 Europe/Paris**, then switch the system timezone to Asia/Shanghai and confirm it still reads correctly. Tests assert the DTSTART bytes; no test proves a real client parses them.
3. **Real-device QA** on iPhone Safari and Android Chrome at 320 px.
4. **Loaded-state visual QA.** Headless capture in this environment only ever yields the loading skeleton (see §7).

## 5. Known risks, honestly stated

- **LCP 2.5 s vs the SPEC's < 1.5 s target.** Measured against local `vite preview`. This is **not purely a local artifact** — the critical path is ~98 KB gzip of JS plus fetching and decoding the whole program bundle before first meaningful paint, which is inherent to this architecture. The edge will help, probably not by the full second. Mitigation: the service worker means a **returning** user does not pay it, so risk concentrates on **first visit on venue Wi-Fi**. Re-measure against the live URL, throttled.
- **`_headers` and SPA routes.** Cloudflare does not document whether `_headers` matches before or after the `_redirects` rewrite. Explicit `no-cache` rules were added for every known route so the outcome is safe under either reading, but it is unverifiable without deploying. First post-deploy check: `curl -sI https://miccaisubscribe.com/paper/M-PM-001 | grep -i cache-control`.
- **The official schedule is still changing.** It is marked TENTATIVE and the PDF's *structure* changed once mid-flight (2026-09-08 → 09-10 dropped a whole column). `scripts/validate.py` is a hard gate that fails the build loudly rather than shipping half-parsed data. The daily workflow opens a PR and **never auto-merges** — a human must read the diff.
- **Author identity is a name string.** No ORCIDs exist in the source. 549 names appear under more than one affiliation. The UI says so plainly and shows paper counts and institutions; do not let anyone "clean this up" into a false certainty.

## 6. Decisions you should not silently reverse

26 rulings are recorded in the ledger with their reasoning and cost-if-wrong. The ones most likely to be undone by accident:

- **Ruling B** — Workbox must **never** precache or runtime-cache `program.min.json`. `web/src/data/load.ts` owns the `miccai-program-v1` cache with hand-written stale-while-revalidate. Two writers to one bucket means a stale program served after a refresh, invisible until the conference. There is a regression test; `verify-offline.mjs` confirms the split at runtime.
- **Ruling D6 (from SPEC)** — one calendar event per **session**, not per talk. The PDF publishes no per-talk times; dividing a 90-minute session by twelve would fabricate times and make someone miss a talk.
- **Conflict tiering** — nothing inside a *single session* is a conflict, for posters or for talks. Five posters in one two-hour session are five easy walks; two talks in one oral session are one room and one seat. `same-poster-session` is **not** a warning and must never use the word "conflict"; two talks in the same session get no badge at all. Calling either a conflict trains users to ignore the badge. (The talks half of this was a live bug until `a2773c9` — it fired on the most common user action.)
- **A bookmark that stops resolving must be reported, never dropped** (new, from the final review). The schedule is TENTATIVE and refreshed daily, so a saved talk can be withdrawn out from under the user. `unresolvedBookmarks()` feeds a banner on `/schedule`. We cannot recover the item — the min bundle carries no `title_key` — but silently deleting someone's saved talk mid-conference is the one way this app can destroy data. Do not "clean up" the banner.
- **The `crossorigin` attribute on the `index.html` preload is load-bearing.** `as="fetch"` must match `load.ts`'s fetch (mode cors, credentials same-origin). Without it the preload is a no-cors request, is never reused, and the 386 KB bundle downloads **twice**. Verified over CDP: exactly one parser-initiated request.
- **Type colour-coding is three functional groups, not six hues.** Six were tried; a protanopia/deuteranopia simulation put 3 of 6 pairs 34–40 apart (of ~441). Text labels, not colour, are the real accessibility guarantee.
- **Never invent data.** No abstracts, no paper URLs, no per-talk times, no poster hall name — the source has none. Empty renders as absent, never as a placeholder.
- **Never overpromise calendar sync.** The strings "instant sync", "real-time sync", "syncs automatically" are banned from the calendar page.

## 7. Environment gotchas that will cost you an hour each

- `vite preview` binds **IPv6-only**; an HTTP proxy 502s on `localhost`. Use `http://[::1]:<port>/` with `--no-proxy-server` / `--noproxy '*'`.
- **Headless screenshots only ever show the loading skeleton.** `--screenshot` fires before the data promise settles, and `--virtual-time-budget` hangs on `caches.open()`. To drive a loaded app, use persistent CDP — `web/scripts/verify-offline.mjs` is a working example.
- `web/public/data/program.min.json` is **git-ignored** and regenerated by `npm run sync`, wired as `pretest`. Running `vitest` directly skips it. Editors will show "Cannot find module '../public/data/program.min.json'" until you sync — that error is **not real**; do **not** commit the 386 KB duplicate or add a module shim.
- Tests are typechecked (`tsconfig.test.json`, referenced from the root tsconfig). A stray scratch file in `web/test/` will break `tsc -b`.
- Strictness comes from TypeScript 6's **default**, not an explicit `"strict": true`. A TS downgrade would silently switch it off with no config change to notice.

## 8. Useful commands

```bash
# data
python3 scripts/fetch.py && python3 scripts/build.py   # re-import; validate.py gates it

# app
cd web
npm test                      # 174/174 (pretest runs sync)
npx tsc -b                    # src + test
npm run lint
npm run build                 # reports gzip sizes
node scripts/verify-offline.mjs   # 11/11 offline gate, needs a build first
TZ=Pacific/Kiritimati npx vitest run   # timezone independence
```

## 9. Where the record lives

- **Ledger:** `.superpowers/sdd/2026-09-19-miccai-subscribe-web-app/progress.md` — every task, every ruling with its reasoning and cost-if-wrong, every deferred item, every interruption. This is the real history; git log is the summary.
- **Per-task reports:** `task-N-report.md` in the same directory, including fix rounds and empirical transcripts.
- **Deferred items:** `deferred-items.md` (30 entries) — the final review's triage input.
- **Operations:** `docs/RUNBOOK.md` — written for someone at 08:00 in a conference hall on bad Wi-Fi.

## 10. Suggested order for whoever picks this up

Steps 1 and 2 are **done** (final review ran; its eight must-fix items are fixed in `a2773c9`).
What remains:

1. ~~Run the final whole-branch review.~~ Done 2026-09-20 — see §4.1.
2. ~~Act on its must-fix list.~~ Done — `a2773c9`.
3. **The manual checklist (§4.3) is the user's.** Especially the calendar-client import, which is
   the last undischarged obligation and the one thing no test can substitute for.
4. **Deploy is theirs.** Then run the two post-deploy verifications in §5 — the `_headers`
   `curl` check, and re-measure LCP against the live URL, throttled. The SPEC 7.1 preload is now
   in place, so measure the version you intend to ship.
5. `superpowers:finishing-a-development-branch` to integrate.
