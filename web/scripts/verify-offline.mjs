#!/usr/bin/env node
/**
 * Offline verification for the MICCAI Subscribe PWA.
 *
 * This is a deployment/manual check, NOT part of `npm test` — it needs a
 * real built app, a real `vite preview` server, and a real browser with
 * network-layer offline emulation, none of which belong in the unit-test
 * suite. It exists so "offline actually works" stays a checkable claim
 * instead of a one-off assertion in a report: run it after any change to
 * `vite.config.ts`'s PWA/workbox config, `src/data/load.ts`'s caching, or
 * before a deploy.
 *
 * What it does:
 *   1. Starts `vite preview` against the already-built `dist/` (run
 *      `npm run build` first — this script does not build for you).
 *   2. Launches headless Chrome with an isolated profile and drives it over
 *      raw Chrome DevTools Protocol (a hand-rolled client over Node's
 *      built-in `WebSocket` — no puppeteer/playwright dependency).
 *   3. Loads the app ONCE online, waits for the service worker to reach
 *      "activated", and inspects Cache Storage directly from inside the
 *      page: asserts `miccai-program-v1` (owned by src/data/load.ts)
 *      contains only /data/program.min.json, and the Workbox precache
 *      bucket contains the app shell and nothing named "program" or
 *      ending in .json — the live-browser half of the single-writer guard that
 *      test/pwa.test.ts checks statically against the build output.
 *   4. Flips the browser to offline via
 *      `Network.emulateNetworkConditions({ offline: true, ... })` — actual
 *      network-layer offline, the same mechanism DevTools' Network→Offline
 *      checkbox uses, not a UI-only toggle. Before trusting anything else,
 *      it first asserts the emulation genuinely engaged
 *      (`navigator.onLine === false`, and a `fetch()` to a URL in neither
 *      cache bucket actually rejects) — a no-op emulation would otherwise
 *      let every render check below pass while quietly testing a live
 *      network. Only then does it assert:
 *        - the home page still renders (non-trivial content, zero console
 *          errors)
 *        - a client-side navigation to My Schedule still renders
 *        - a hard (full-page) offline navigation to /search?q=... still
 *          returns real results
 *        - clicking into a paper detail page from those offline results
 *          still renders
 *   5. Prints a PASS/FAIL line per assertion and exits non-zero if any
 *      assertion failed, so this is CI-usable, not just eyeballed. Every
 *      startup failure path throws (rather than `process.exit()`) so the
 *      `finally` block always runs: `vite preview` and Chrome are always
 *      killed and the temp profile dir always cleaned up, even when the
 *      script fails early.
 *
 * Usage:
 *   npm run build
 *   node scripts/verify-offline.mjs
 *
 * Configuration (all optional, via env vars):
 *   CHROME_PATH   Path to a Chrome/Chromium binary. Defaults to the
 *                 standard macOS install location; override for Linux CI
 *                 (e.g. `which google-chrome` / `which chromium`) or a
 *                 different machine.
 *   PREVIEW_PORT  Port for `vite preview`. Default 4173.
 *   PREVIEW_HOST  Host `vite preview` binds and this script connects to.
 *                 Default '::1' — `vite preview` binds IPv6-only in some
 *                 environments; if yours binds IPv4, set this to '127.0.0.1'.
 *   CDP_PORT      Chrome's --remote-debugging-port. Default 9333.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

const CHROME_PATH =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PREVIEW_PORT = process.env.PREVIEW_PORT || '4173';
const PREVIEW_HOST = process.env.PREVIEW_HOST || '::1';
const CDP_PORT = process.env.CDP_PORT || '9333';

const previewUrl = `http://[${PREVIEW_HOST.replace(/^\[|\]$/g, '')}]:${PREVIEW_PORT}/`.replace(
  '[[',
  '[',
);
const cdpBase = `http://127.0.0.1:${CDP_PORT}`;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  return false;
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', (e) => reject(e));
  });
}

function makeCdpClient(ws) {
  let id = 0;
  const pending = new Map();
  const eventHandlers = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const h of eventHandlers) h(msg.method, msg.params);
    }
  });
  function send(method, params = {}, sessionId) {
    const thisId = ++id;
    const payload = { id: thisId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(thisId, { resolve, reject });
      ws.send(JSON.stringify(payload));
    });
  }
  return { send, onEvent: (h) => eventHandlers.push(h) };
}

async function main() {
  const distPath = join(webRoot, 'dist');
  if (!existsSync(distPath)) {
    // Nothing spawned yet at this point, so process.exit() would be safe
    // here specifically — but throw for uniformity with the checks below,
    // so this can't silently become unsafe if code is ever reordered.
    throw new Error(
      `${distPath} does not exist. Run \`npm run build\` first — this script verifies a ` +
        `real production build, it does not build one for you.`,
    );
  }

  // --- start `vite preview` ---
  const preview = spawn(
    'npx',
    ['vite', 'preview', '--port', PREVIEW_PORT, '--strictPort'],
    { cwd: webRoot, stdio: 'pipe' },
  );
  let previewLog = '';
  preview.stdout.on('data', (d) => (previewLog += d));
  preview.stderr.on('data', (d) => (previewLog += d));

  const previewProfileDir = mkdtempSync(join(tmpdir(), 'miccai-chrome-profile-'));
  let chrome;
  let browserWsConn;

  try {
    const previewUp = await waitForHttp(previewUrl, 15000);
    if (!previewUp) {
      // throw, not process.exit(): this is inside the try whose `finally`
      // kills `preview`/`chrome` and removes the temp profile dir.
      // process.exit() does not unwind to `finally` — on this and the two
      // checks below, that used to leak `vite preview` (started with
      // --strictPort) and left the next run dead on EADDRINUSE.
      throw new Error(`vite preview never became reachable at ${previewUrl}.\n${previewLog}`);
    }

    // --- start headless Chrome ---
    if (!existsSync(CHROME_PATH)) {
      throw new Error(
        `Chrome binary not found at ${CHROME_PATH}. Set CHROME_PATH to a valid ` +
          `Chrome/Chromium executable (see the header comment in this script).`,
      );
    }
    chrome = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        '--no-proxy-server',
        "--proxy-server=direct://",
        '--proxy-bypass-list=*',
        `--user-data-dir=${previewProfileDir}`,
        '--disable-gpu',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    const cdpUp = await waitForHttp(`${cdpBase}/json/version`, 15000);
    if (!cdpUp) {
      throw new Error(`Headless Chrome never exposed the CDP endpoint at ${cdpBase}.`);
    }

    const version = await (await fetch(`${cdpBase}/json/version`)).json();
    browserWsConn = await connectWs(version.webSocketDebuggerUrl);
    const browser = makeCdpClient(browserWsConn);

    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    const page = { send: (method, params) => browser.send(method, params, sessionId) };

    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Runtime.enable');

    const consoleErrors = [];
    browser.onEvent((method, params) => {
      if (params?.sessionId && params.sessionId !== sessionId) return;
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
        consoleErrors.push((params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (method === 'Runtime.exceptionThrown') {
        consoleErrors.push(JSON.stringify(params.exceptionDetails));
      }
    });

    async function evaluate(expression, awaitPromise = false) {
      const result = await page.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise,
      });
      if (result.exceptionDetails) {
        throw new Error(`Evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
      }
      return result.result.value;
    }

    async function waitForCondition(expr, timeoutMs = 15000, intervalMs = 200) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ok = await evaluate(expr).catch(() => false);
        if (ok) return true;
        await sleep(intervalMs);
      }
      return false;
    }

    // Like waitForCondition, but for when the thing worth keeping is the
    // VALUE, not just a boolean — and where re-evaluating a cheap boolean
    // check and then making a SEPARATE follow-up call to read the real
    // value was empirically unreliable (a boolean "caches are populated"
    // poll returning true, immediately followed by a distinct
    // Runtime.evaluate call to read the same Cache Storage state, was
    // observed reading back empty on a freshly-created browser profile —
    // two different CDP round trips a few hundred ms apart, disagreeing
    // about the same in-page state). Re-evaluating and re-checking the
    // SAME expression each iteration removes that cross-call race: the
    // value returned is exactly the value that was just validated.
    async function waitForValue(expr, predicate, timeoutMs = 15000, intervalMs = 200) {
      const start = Date.now();
      let last;
      while (Date.now() - start < timeoutMs) {
        last = await evaluate(expr, true).catch(() => undefined);
        if (last !== undefined && predicate(last)) return last;
        await sleep(intervalMs);
      }
      return last;
    }

    // --- 1. Load ONLINE, wait for SW activation ---
    await page.send('Page.navigate', { url: previewUrl });
    // On a completely fresh browser profile (no prior visit to this origin),
    // registration + install + activation was observed taking 15+ seconds
    // in this environment — much slower than a warm profile. Give it real
    // headroom rather than assuming a fast localhost round trip.
    const swActivated = await waitForCondition(
      `(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r && r.active && r.active.state === 'activated'); })()`,
      30000,
    );
    record('service worker reaches "activated" after first online load', swActivated);

    // --- 2. Inspect Cache Storage split (live half of the single-writer rule) ---
    // Both buckets are populated inside the SW's install-event waitUntil()
    // (Workbox precache) and inside load.ts's async loadProgram() call
    // (miccai-program-v1), which can each still be finishing their
    // caches.put() a beat after `active.state === 'activated'` — poll the
    // actual state itself (see waitForValue above) instead of a boolean
    // proxy for it, to avoid a race against either.
    const cacheStateExpr = `(async () => {
        const names = await caches.keys();
        const out = {};
        for (const n of names) {
          const c = await caches.open(n);
          const keys = await c.keys();
          out[n] = keys.map(k => new URL(k.url).pathname);
        }
        return out;
      })()`;
    const cacheState = await waitForValue(
      cacheStateExpr,
      (state) =>
        Object.keys(state).some((n) => n.startsWith('workbox-precache')) &&
        (state['miccai-program-v1'] || []).length > 0,
      15000,
    );
    const programBucket = cacheState['miccai-program-v1'] || [];
    const precacheBucketName = Object.keys(cacheState).find((n) => n.startsWith('workbox-precache'));
    const precacheBucket = precacheBucketName ? cacheState[precacheBucketName] : [];
    record(
      'miccai-program-v1 contains exactly /data/program.min.json',
      programBucket.length === 1 && programBucket[0] === '/data/program.min.json',
      JSON.stringify(programBucket),
    );
    record(
      'Workbox precache bucket exists and contains the app shell (index.html)',
      precacheBucket.includes('/index.html'),
      precacheBucketName,
    );
    record(
      'Workbox precache bucket contains nothing named "program" or ending in .json',
      !precacheBucket.some((p) => p.includes('program') || p.endsWith('.json')),
      JSON.stringify(precacheBucket),
    );

    // --- 3. Go OFFLINE at the network layer ---
    await page.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });

    // Prove the emulation actually engaged BEFORE trusting any "renders
    // while offline" assertion below. If Network.emulateNetworkConditions
    // silently no-ops (different Chrome build, a changed flag, a
    // session/target mismatch), every subsequent render check would still
    // pass while quietly testing a live network — a false PASS that is
    // worse than no gate at all. Two independent, cheap checks, both hard
    // failures:
    const navigatorOffline = await evaluate('navigator.onLine === false').catch(() => false);
    record('navigator.onLine reports offline after emulation is enabled', navigatorOffline);

    const uncachedFetchRejects = await evaluate(
      `(async () => {
        // A path guaranteed to be in neither Cache Storage bucket (not a
        // precached shell file, not /data/program.min.json) and not
        // matched by the SW's navigation-fallback route (that only
        // intercepts requests with mode "navigate"; a plain fetch() does
        // not use that mode) — so this must go straight to the network.
        // If the network is genuinely down, the fetch REJECTS; if the
        // emulation didn't engage, it resolves.
        try {
          await fetch('/__verify-offline-probe-' + Date.now() + '-' + Math.random());
          return false;
        } catch {
          return true;
        }
      })()`,
      true,
    ).catch(() => false);
    record(
      'a fetch() to an uncached URL genuinely fails offline (proves the emulation is not a no-op)',
      uncachedFetchRejects,
    );

    await page.send('Page.navigate', { url: previewUrl });
    const homeReady = await waitForCondition(
      `document.body.innerText.includes('MICCAI Subscribe')`,
      10000,
    );
    // Structural, not just "some text rendered": a generic error boundary that
    // preserves the app shell (brand heading, nav chrome) would satisfy brand
    // text + a character count. The satellite-event count shown on the home
    // page ("N workshops, challenges & tutorials") is computed from
    // program.satellite.length in the DECODED program — it can only be
    // correct if the real bundle was parsed and rendered. Cross-check it
    // against the satellite array length actually sitting in Cache Storage
    // right now, rather than hard-coding a number that would go stale (and
    // silently stop testing anything) the next time data/processed/program.json
    // changes.
    const satelliteCountCheck = await evaluate(
      `(async () => {
        const match = document.body.innerText.match(/(\\d+)\\s+workshops, challenges/);
        if (!match) return { ok: false, reason: 'no "N workshops, challenges" text found' };
        const cache = await caches.open('miccai-program-v1');
        const resp = await cache.match('/data/program.min.json');
        if (!resp) return { ok: false, reason: 'no cached program bundle to cross-check against' };
        const bundle = await resp.json();
        const shown = Number(match[1]);
        const actual = bundle.satellite.length;
        return { ok: shown === actual, reason: \`page shows \${shown}, cached bundle has \${actual}\` };
      })()`,
      true,
    ).catch((e) => ({ ok: false, reason: String(e) }));
    record(
      'home page renders real decoded data while offline (reload) — shown satellite count matches the cached bundle',
      homeReady && satelliteCountCheck.ok,
      satelliteCountCheck.reason,
    );

    const scheduleNav = await evaluate(
      `(() => { const link = [...document.querySelectorAll('a')].find(a => /schedule/i.test(a.getAttribute('href')||'')); if (link) { link.click(); return true; } return false; })()`,
    ).catch(() => false);
    const scheduleReady =
      scheduleNav && (await waitForCondition(`document.body.innerText.includes('My schedule')`, 10000));
    const scheduleText = await evaluate('document.body.innerText').catch(() => '');
    record(
      'My Schedule renders while offline (client-side navigation)',
      scheduleNav && scheduleReady,
      `${scheduleText.length} chars`,
    );

    await page.send('Page.navigate', { url: `${previewUrl}search?q=segmentation` });
    const searchReady = await waitForCondition(
      `document.querySelectorAll('a[href^="/paper/"]').length > 0`,
      10000,
    );
    const searchText = await evaluate('document.body.innerText').catch(() => '');
    const searchResultCount = await evaluate(
      `document.querySelectorAll('a[href^="/paper/"]').length`,
    ).catch(() => 0);
    record(
      'hard offline navigation to /search?q=segmentation returns results',
      searchReady && searchResultCount > 0,
      `${searchResultCount} paper links, ${searchText.length} chars`,
    );

    const detailNav = await evaluate(
      `(() => { const link = document.querySelector('a[href^="/paper/"]'); if (link) { link.click(); return link.getAttribute('href'); } return null; })()`,
    ).catch(() => null);
    const detailReady =
      !!detailNav &&
      (await waitForCondition(`location.pathname.startsWith('/paper/')`, 10000));
    // Structural, not just "the URL changed and some text appeared": a stale
    // shell or error boundary would satisfy pathname + a character count too.
    // Look up the actual paper's title from the cached bundle by the id in
    // the URL we just navigated to, and assert THAT specific title is what
    // rendered — content only a correctly decoded, correctly routed detail
    // page can produce.
    const detailCheck = await evaluate(
      `(async () => {
        const id = decodeURIComponent(location.pathname.replace(/^\\/paper\\//, ''));
        if (!id) return { ok: false, reason: 'no paper id in pathname' };
        const cache = await caches.open('miccai-program-v1');
        const resp = await cache.match('/data/program.min.json');
        if (!resp) return { ok: false, reason: 'no cached program bundle to cross-check against' };
        const bundle = await resp.json();
        const paper = bundle.papers.find((p) => p[0] === id);
        if (!paper) return { ok: false, reason: \`paper \${id} not found in cached bundle\` };
        const title = paper[1];
        const ok = document.body.innerText.includes(title);
        return { ok, reason: ok ? \`rendered title for \${id}\` : \`title for \${id} ("\${title}") not found in rendered page\` };
      })()`,
      true,
    ).catch((e) => ({ ok: false, reason: String(e) }));
    record(
      'paper detail page renders the correct paper\'s title while offline',
      !!detailNav && detailReady && detailCheck.ok,
      `${detailNav} — ${detailCheck.reason}`,
    );

    record('no console errors or exceptions during the offline run', consoleErrors.length === 0, consoleErrors.join(' | '));

    await browser.send('Target.closeTarget', { targetId });
  } finally {
    if (browserWsConn) browserWsConn.close();
    if (chrome) chrome.kill();
    preview.kill();
    // Chrome can still hold file locks in its profile dir for a moment
    // after being killed; retry the cleanup rather than crashing the whole
    // script over a housekeeping step that isn't part of what we're
    // verifying. If it still can't be removed, just leave it in the OS
    // temp dir and say so — not worth failing the run over.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        rmSync(previewProfileDir, { recursive: true, force: true });
        break;
      } catch (e) {
        if (attempt === 4) {
          console.warn(`Could not remove temp Chrome profile dir ${previewProfileDir}: ${e}`);
        } else {
          await sleep(300);
        }
      }
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(`${results.length - failed.length}/${results.length} assertions passed.`);
  if (failed.length > 0) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exitCode = 1;
});
