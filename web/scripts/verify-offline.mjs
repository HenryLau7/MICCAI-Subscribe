#!/usr/bin/env node
/**
 * Offline verification for the MICCAI Subscribe PWA (Task 12 / Ruling B).
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
 *      ending in .json — the live-browser half of the Ruling B guard that
 *      test/pwa.test.ts checks statically against the build output.
 *   4. Flips the browser to offline via
 *      `Network.emulateNetworkConditions({ offline: true, ... })` — actual
 *      network-layer offline, the same mechanism DevTools' Network→Offline
 *      checkbox uses, not a UI-only toggle — and asserts:
 *        - the home page still renders (non-trivial content, zero console
 *          errors)
 *        - a client-side navigation to My Schedule still renders
 *        - a hard (full-page) offline navigation to /search?q=... still
 *          returns real results
 *        - clicking into a paper detail page from those offline results
 *          still renders
 *   5. Prints a PASS/FAIL line per assertion and exits non-zero if any
 *      assertion failed, so this is CI-usable, not just eyeballed.
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
    console.error(
      `${distPath} does not exist. Run \`npm run build\` first — this script verifies a ` +
        `real production build, it does not build one for you.`,
    );
    process.exit(1);
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
      console.error(`vite preview never became reachable at ${previewUrl}.\n${previewLog}`);
      process.exit(1);
    }

    // --- start headless Chrome ---
    if (!existsSync(CHROME_PATH)) {
      console.error(
        `Chrome binary not found at ${CHROME_PATH}. Set CHROME_PATH to a valid ` +
          `Chrome/Chromium executable (see the header comment in this script).`,
      );
      process.exit(1);
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
      console.error(`Headless Chrome never exposed the CDP endpoint at ${cdpBase}.`);
      process.exit(1);
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
    // Cache Storage writes made during the install event (Workbox's own
    // precache, and load.ts's own program-data fetch/cache.put shortly
    // after) were observed lagging a couple of seconds behind
    // `active.state === 'activated'` becoming visible to a separate
    // Runtime.evaluate call on a completely fresh profile in this
    // environment — give it real headroom before trusting a read.
    await sleep(3000);

    // --- 2. Inspect Cache Storage split (live, in-browser half of Ruling B) ---
    // Both buckets are populated inside the SW's install-event waitUntil()
    // (Workbox precache) and inside load.ts's async loadProgram() call
    // (miccai-program-v1), which can each still be finishing their
    // caches.put() a beat after `active.state === 'activated'` — poll
    // instead of reading once, to avoid a race against either.
    const cachesPopulated = await waitForCondition(
      `(async () => {
        const names = await caches.keys();
        if (!names.some(n => n.startsWith('workbox-precache'))) return false;
        const programCache = await caches.open('miccai-program-v1');
        const programKeys = await programCache.keys();
        return programKeys.length > 0;
      })()`,
      15000,
    );
    if (!cachesPopulated) {
      console.warn('Cache Storage did not finish populating within 15s — reading it anyway.');
    }
    const cacheState = await evaluate(
      `(async () => {
        const names = await caches.keys();
        const out = {};
        for (const n of names) {
          const c = await caches.open(n);
          const keys = await c.keys();
          out[n] = keys.map(k => new URL(k.url).pathname);
        }
        return out;
      })()`,
      true,
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

    await page.send('Page.navigate', { url: previewUrl });
    await sleep(1500);
    const homeText = await evaluate('document.body.innerText').catch(() => '');
    record(
      'home page renders while offline (reload)',
      homeText.length > 100 && /MICCAI/.test(homeText),
      `${homeText.length} chars`,
    );

    const scheduleNav = await evaluate(
      `(() => { const link = [...document.querySelectorAll('a')].find(a => /schedule/i.test(a.getAttribute('href')||'')); if (link) { link.click(); return true; } return false; })()`,
    ).catch(() => false);
    await sleep(800);
    const scheduleText = await evaluate('document.body.innerText').catch(() => '');
    record(
      'My Schedule renders while offline (client-side navigation)',
      scheduleNav && /schedule/i.test(scheduleText),
      `${scheduleText.length} chars`,
    );

    await page.send('Page.navigate', { url: `${previewUrl}search?q=segmentation` });
    await sleep(1500);
    const searchText = await evaluate('document.body.innerText').catch(() => '');
    const searchResultCount = await evaluate(
      `document.querySelectorAll('a[href^="/paper/"]').length`,
    ).catch(() => 0);
    record(
      'hard offline navigation to /search?q=segmentation returns results',
      searchResultCount > 0,
      `${searchResultCount} paper links, ${searchText.length} chars`,
    );

    const detailNav = await evaluate(
      `(() => { const link = document.querySelector('a[href^="/paper/"]'); if (link) { link.click(); return link.getAttribute('href'); } return null; })()`,
    ).catch(() => null);
    await sleep(800);
    const detailText = await evaluate('document.body.innerText').catch(() => '');
    record(
      'paper detail page renders while offline',
      !!detailNav && detailText.length > 50,
      `${detailNav} — ${detailText.length} chars`,
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
