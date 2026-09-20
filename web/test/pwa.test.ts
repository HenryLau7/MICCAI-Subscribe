import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// vitest's `include` is `test/**/*.test.{ts,tsx}` run from the `web/` project
// root, so process.cwd() is `web/` for every test process.
const webRoot = process.cwd();

describe('PWA manifest (public/manifest.webmanifest)', () => {
  // Read as plain JSON via fs, not an ESM import: the file has a non-standard
  // .webmanifest extension that TS's module resolution isn't set up for, and
  // this is what the browser/plugin actually serve byte-for-byte.
  const manifest = JSON.parse(
    readFileSync(join(webRoot, 'public/manifest.webmanifest'), 'utf8'),
  ) as {
    name: string;
    short_name: string;
    display: string;
    start_url: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };

  it('declares name, short_name, display and start_url', () => {
    expect(manifest.name).toBe('MICCAI Subscribe');
    expect(manifest.short_name).toBe('MICCAI');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });

  it('theme_color and background_color match the tokens in src/index.css', () => {
    const css = readFileSync(join(webRoot, 'src/index.css'), 'utf8');
    // Pull the light-theme :root token values so this test fails if index.css
    // and the manifest ever drift apart.
    const accent = /--accent:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1];
    const bg = /--bg:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1];
    expect(accent).toBeTruthy();
    expect(bg).toBeTruthy();
    expect(manifest.theme_color).toBe(accent);
    expect(manifest.background_color).toBe(bg);
  });

  it('references real, non-empty PNG icon files at 192 and 512', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes).sort();
    expect(sizes).toEqual(['192x192', '192x192', '512x512', '512x512']);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const bytes = readFileSync(join(webRoot, 'public', icon.src));
      expect(bytes.length).toBeGreaterThan(500); // not a stub/broken file
      // PNG signature
      expect(bytes.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    }
    // At least one "any" and one "maskable" purpose declared.
    expect(manifest.icons.some((i) => i.purpose === 'any')).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('generated service worker precache manifest (single-cache-writer guard)', () => {
  let swSrc: string;
  let precacheUrls: string[];
  let outDir: string;

  beforeAll(() => {
    // This suite's whole point is to prove program.min.json is ABSENT from
    // the precache list. That's only meaningful if the file exists on disk
    // for this `vite build` to have had the chance to pick up — it does not
    // exist in a clean checkout (public/data/ is git-ignored) and normally
    // only appears via `npm run sync`, which `npm test`'s `pretest` hook
    // runs automatically. Invoke this file any other way — `npx vitest run`
    // directly, a CI step or IDE "run this test" action that skips `pretest`
    // — and the negative assertions below would pass vacuously: nothing
    // named "program" would exist anywhere to be excluded. Fail loudly
    // instead of silently validating nothing.
    const programDataPath = join(webRoot, 'public/data/program.min.json');
    if (!existsSync(programDataPath)) {
      throw new Error(
        `${programDataPath} is missing, so this test cannot verify the `+
          `single-cache-writer rule ` +
          `(program.min.json must be excluded from the Workbox precache) — ` +
          `without the file present, the exclusion assertions pass vacuously. ` +
          `Run \`npm run sync\` first (or run tests via \`npm test\`, whose ` +
          `pretest hook does this automatically).`,
      );
    }

    outDir = mkdtempSync(join(tmpdir(), 'miccai-pwa-build-'));
    // Shell out to a real, isolated `vite build` (rather than importing
    // vite's build() into this already-running Vitest/Vite process): a
    // nested build sharing the host process's module graph produced
    // corrupted output here (workbox's own license-header chunk ended up
    // written to the `sw.js` path). A separate process is what actually
    // ships, so it's what we verify.
    execFileSync(
      'npx',
      ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'silent'],
      {
        cwd: webRoot,
        stdio: 'pipe',
        // Vitest sets NODE_ENV=test on its own process; without overriding
        // it here, that leaks into this child build and vite-plugin-pwa
        // switches Workbox to its non-production mode (unminified runtime,
        // different chunk splitting) — not what `npm run build` ships.
        env: { ...process.env, NODE_ENV: 'production' },
      },
    );
    swSrc = readFileSync(join(outDir, 'sw.js'), 'utf8');
    const match = /precacheAndRoute\(\[([\s\S]*?)\]\s*,\s*\{\}\)/.exec(swSrc);
    if (!match) throw new Error('precacheAndRoute([...]) not found in generated dist/sw.js');
    precacheUrls = [...match[1].matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  }, 60000);

  afterAll(() => {
    // beforeAll may have thrown before outDir was assigned (missing
    // program.min.json precondition below) — nothing to clean up then.
    if (outDir) rmSync(outDir, { recursive: true, force: true });
  });

  it('precaches the app shell: HTML, JS, CSS and icons', () => {
    // Positive assertions on the actual generated list, not just "it's short".
    expect(precacheUrls).toEqual(expect.arrayContaining(['index.html', 'favicon.svg']));
    expect(precacheUrls.some((u) => /^assets\/.*\.js$/.test(u))).toBe(true);
    expect(precacheUrls.some((u) => /^assets\/.*\.css$/.test(u))).toBe(true);
    expect(precacheUrls.some((u) => u === 'icons/icon-192.png')).toBe(true);
    expect(precacheUrls.some((u) => u === 'icons/icon-512.png')).toBe(true);
  });

  it('does NOT precache the program data bundle (load.ts owns that Cache Storage bucket)', () => {
    // program.min.json lives at dist/data/program.min.json (copied verbatim
    // by Vite's public-dir copy) but must never appear in Workbox's own
    // precache list: two writers to "miccai-program-v1" is exactly what
    // the single-writer rule forbids.
    expect(precacheUrls.some((u) => u.includes('program'))).toBe(false);
    expect(precacheUrls.some((u) => u.endsWith('.json'))).toBe(false);
    expect(precacheUrls.some((u) => u.startsWith('data/'))).toBe(false);
    expect(swSrc.includes('program')).toBe(false);
  });

  it('adds no Workbox runtime-caching route (no StaleWhileRevalidate etc. for any URL)', () => {
    expect(swSrc.includes('StaleWhileRevalidate')).toBe(false);
    expect(swSrc.includes('NetworkFirst')).toBe(false);
    expect(swSrc.includes('CacheFirst')).toBe(false);
    // The only registerRoute() call should be Workbox's own navigation
    // fallback (index.html for SPA routing) that generateSW always adds.
    expect(swSrc.match(/registerRoute\(/g)?.length).toBe(1);
  });
});
