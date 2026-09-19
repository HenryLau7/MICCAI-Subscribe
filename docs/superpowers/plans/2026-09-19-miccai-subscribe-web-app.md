# MICCAI Subscribe Web App 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出一个移动优先的静态站点，让 MICCAI 2026 参会者能按标题/作者/机构搜索 1165 篇论文和 111 场 satellite events，收藏或关注，并把个人日程导出到手机日历。

**Architecture:** 纯静态 React SPA 托管在 Cloudflare Pages。全部会议数据是构建期产物（`program.min.json`，129 KB gzip），一次性下载后全部查询在内存里跑，没有搜索后端。收藏存 localStorage，默认零后端；只有当用户主动要日历订阅链接时，才有一个 Cloudflare Worker + KV 参与。

**Tech Stack:** Vite 7 · React 19 · TypeScript · Tailwind CSS v4 · react-router 7 · Vitest + Testing Library · Cloudflare Pages + Workers + KV

**Spec:** `SPEC.md` (v0.3) — 计划的每条决策都源自该文档，执行者必须同时读这两份。

---

## Global Constraints

以下是全项目约束，每个 task 的要求都隐含包含本节。数值逐字来自 SPEC.md。

- **硬截止：2026-09-27**（satellite 开始日）。主会 9/28–9/30。今天是 2026-09-19。
- **时区：`Europe/Paris`**。bundle 里每个时间戳都已经是 `+02:00` 形式，即会议当地时间。**显示一律用字符串切片，禁止 `new Date().getHours()` 这类依赖设备时区的调用**，否则时差地区的用户会看到错误时间。会期 9/27–10/1 全程 CEST，2026 年夏令时 10/25 才结束。
- **不编造数据。** PDF 里没有的字段（摘要、论文链接、单个 oral 报告的精确时间、poster 厅名称）一律不显示、不推测。Poster session 的 `room` 是空字符串，UI 显示展板号并注明"场地见现场指引"。
- **日历事件 = 整个 session**（决策 D6）。不按顺序均分估算单个报告时间。
- **无账号、无注册、无登录。** 落地页第一屏就是搜索框。
- **收藏默认只存 localStorage**（决策 D5）。所有 `localStorage` 读写必须包 try/catch —— 隐私模式下会抛异常，抛了也要能正常浏览。
- **移动优先**：最小适配宽度 320 px，触控目标 ≥ 44×44 CSS px，底部导航适配 iPhone safe-area inset，关键信息绝不依赖 hover。
- **性能预算**：JS bundle gzip < 150 KB；LCP < 1.5 s（4G）；搜索响应 < 20 ms。
- **非官方声明**：页脚固定 `Unofficial community tool for MICCAI 2026.`，不使用 MICCAI logo，不暗示官方背书。
- **视觉方向**：精致工具感（Linear / Arc 那一档）。深色模式必做。动效尊重 `prefers-reduced-motion`。禁止大面积渐变、玻璃拟态、营销式 hero。
- 所有新代码放在 `web/`（前端）和 `worker/`（同步服务）下。`scripts/`、`data/`、`config/` 属于已完成的 P0 管线，除 Task 1 复制数据外不要改动。

### 数据契约（`data/processed/program.min.json`，schema_version 1）

顶层键：`meta` `fields` `kinds` `names` `affiliations` `papers` `presentations` `sessions` `satellite`

字典编码：`names: string[]`（5661 条）、`affiliations: string[]`（598 条）。`kinds: ["poster","oral","spotlight"]`。

定长数组行：

```
papers[i]        = [id, title, authorIdx[], presenterIdx[], affIdx, country, affKey]
                   affIdx 为 -1 表示无机构
presentations[i] = [paperId, kindIdx, sessionId, orderInSession]   // order 0 表示无
sessions[i]      = [id, kind, name, startISO, endISO, room, chairs[]]   // room 可能是 ""
satellite[i]     = [id, acronym, name, type, theme, room, floor, startISO, endISO, url]
```

**Presentation id 是派生的**，不在 bundle 里：`kind === "poster"` 时为 `paperId`，否则为 `` `${paperId}:oral` ``。全项目必须统一用这个规则。

---

## File Structure

```
web/
  package.json  vite.config.ts  tsconfig.json  index.html
  public/_redirects                     SPA fallback
  public/data/program.min.json          Task 1 从 data/processed/ 复制
  src/
    main.tsx  App.tsx  index.css
    data/types.ts        领域类型
    data/decode.ts       min bundle -> Program 模型 + 反向索引
    data/load.ts         fetch + Cache Storage + 版本键
    search/normalize.ts  折叠变音符 / 小写 / 分词
    search/engine.ts     建检索串 + 打分排序
    store/storage.ts     localStorage 读写（版本化、容错）
    store/StoreProvider.tsx  React context + hooks
    store/schedule.ts    我的日程聚合 + 三档冲突判定
    calendar/ics.ts      RFC 5545 写入器（转义 / 折行 / VTIMEZONE）
    calendar/build.ts    日程 -> VEVENT（session 级）
    calendar/google.ts   Google 日历 URL
    ui/                  展示组件
    routes/              页面
  test/                  Vitest
worker/
  src/index.ts  wrangler.toml
```

**责任边界**：`search/` 和 `calendar/` 是纯函数模块，不 import React，可独立测试。`store/` 只管持久化与派生，不碰 DOM。`routes/` 只做编排，不含算法。

---

## Task 1: 脚手架与数据加载

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/index.css`, `web/public/_redirects`
- Create: `web/src/data/types.ts`, `web/src/data/decode.ts`, `web/src/data/load.ts`
- Create: `web/test/decode.test.ts`
- Create: `web/scripts/sync-data.mjs`

**Interfaces:**
- Consumes: `data/processed/program.min.json`（P0 产物）
- Produces: `decodeProgram(raw: MinBundle): Program`；`Program` 类型含 `papers: Paper[]`、`byPaperId: Map<string, Paper>`、`sessions: Map<string, Session>`、`presentations: Presentation[]`、`satellite: SatelliteEvent[]`、`authors: Map<string, Author>`、`affiliations: Map<string, Affiliation>`、`meta`；`loadProgram(): Promise<Program>`

- [ ] **Step 1: 初始化项目**

```bash
cd /Users/henrylau/Documents/Scholar/10_Activity/MICCAI-Subscribe
npm create vite@latest web -- --template react-ts
cd web && npm install
npm install react-router-dom
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

- [ ] **Step 2: 配置 Vite + Tailwind v4 + Vitest**

`web/vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
```

`web/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest';
```

`web/src/index.css` 首行 `@import "tailwindcss";`。在 `web/package.json` 的 `scripts` 加 `"test": "vitest run"`、`"test:watch": "vitest"`。

- [ ] **Step 3: 数据同步脚本**

`web/scripts/sync-data.mjs`：

```js
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/data', { recursive: true });
copyFileSync('../data/processed/program.min.json', 'public/data/program.min.json');
console.log('synced program.min.json');
```

在 `package.json` 加 `"sync": "node scripts/sync-data.mjs"`，并把 `"build"` 改成 `"npm run sync && tsc -b && vite build"`，`"dev"` 改成 `"npm run sync && vite"`。

- [ ] **Step 4: 写失败的测试**

`web/test/decode.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);

describe('decodeProgram', () => {
  it('decodes every paper', () => {
    expect(program.papers).toHaveLength(1165);
  });

  it('resolves dictionary-encoded author names', () => {
    const p = program.byPaperId.get('M-PM-001')!;
    expect(p.title).toBe('Automatic LV Localization and Short-Axis Plane Estimation from Arbitrary CMR Slice');
    expect(p.authors).toEqual(['Yi Yu','Yixuan Liu','Ziyu Zhang','Parker Martin','Zhenyu Bu','Yuchi Han','Yuan Xue']);
    expect(p.presenters).toEqual(['Yuan Xue']);
    expect(p.affiliation).toBe('The Ohio State University');
    expect(p.country).toBe('United States');
  });

  it('derives presentation ids: poster keeps the board number, talks get :oral', () => {
    const ids = program.presentations
      .filter((pr) => pr.paperId === 'M-PM-042')
      .map((pr) => pr.id)
      .sort();
    expect(ids).toEqual(['M-PM-042', 'M-PM-042:oral']);
  });

  it('links presentations to sessions', () => {
    const oral = program.presentations.find((pr) => pr.id === 'M-PM-042:oral')!;
    expect(oral.kind).toBe('oral');
    expect(program.sessions.get(oral.sessionId)!.room).toBe('Erasme Hall');
  });

  it('builds an author index that merges co-authorship', () => {
    const a = program.authors.get('wen-yan')!;
    expect(a.name).toBe('Wen Yan');
    expect(a.paperIds).toContain('M-PM-042');
  });

  it('builds an affiliation index keyed by affiliation_key', () => {
    const f = program.affiliations.get('ohio-state-university')!;
    expect(f.paperIds).toContain('M-PM-001');
  });

  it('keeps poster session rooms empty rather than inventing one', () => {
    expect(program.sessions.get('P1')!.room).toBe('');
  });

  it('decodes satellite events', () => {
    expect(program.satellite).toHaveLength(111);
    const cdmri = program.satellite.find((e) => e.acronym === 'CDMRI')!;
    expect(cdmri.room).toBe('Adeanauer');
    expect(cdmri.start).toBe('2026-09-27T08:00:00+02:00');
  });
});
```

- [ ] **Step 5: 运行测试确认失败**

Run: `cd web && npm run sync && npx vitest run test/decode.test.ts`
Expected: FAIL — `Cannot find module '../src/data/decode'`

- [ ] **Step 6: 写类型**

`web/src/data/types.ts`：

```ts
export type PresentationKind = 'poster' | 'oral' | 'spotlight';
export type SessionKind = 'poster' | 'oral';
export type SatelliteType = 'workshop' | 'challenge' | 'tutorial';

export interface Paper {
  id: string;                 // 展板号，例如 M-PM-001
  title: string;
  authors: string[];
  presenters: string[];
  affiliation: string;
  affiliationKey: string;
  country: string;
  presentationIds: string[];
}

export interface Presentation {
  id: string;                 // 派生：poster -> paperId，其余 -> `${paperId}:oral`
  paperId: string;
  kind: PresentationKind;
  sessionId: string;
  orderInSession: number;     // 0 表示无
}

export interface Session {
  id: string;
  kind: SessionKind;
  name: string;
  start: string;              // ISO，永远带 +02:00
  end: string;
  room: string;               // poster session 为 ''
  chairs: string[];
}

export interface SatelliteEvent {
  id: string;
  acronym: string;
  name: string;
  type: SatelliteType;
  theme: string;
  room: string;
  floor: string;
  start: string;
  end: string;
  url: string;
}

export interface Author { id: string; name: string; paperIds: string[]; affiliations: string[]; }
export interface Affiliation { id: string; name: string; country: string; paperIds: string[]; }

export interface ProgramMeta {
  conference: string; venue: string; timezone: string;
  schemaVersion: number; sourceRevision: string;
  fetchedAt: string; generatedAt: string;
}

export interface Program {
  meta: ProgramMeta;
  papers: Paper[];
  byPaperId: Map<string, Paper>;
  presentations: Presentation[];
  byPresentationId: Map<string, Presentation>;
  sessions: Map<string, Session>;
  satellite: SatelliteEvent[];
  bySatelliteId: Map<string, SatelliteEvent>;
  authors: Map<string, Author>;
  affiliations: Map<string, Affiliation>;
}
```

- [ ] **Step 7: 写 decode**

`web/src/data/decode.ts`：

```ts
import type {
  Affiliation, Author, Paper, Presentation, Program, ProgramMeta,
  PresentationKind, SatelliteEvent, Session, SessionKind,
} from './types';

export interface MinBundle {
  meta: { conference: string; venue: string; timezone: string; schema_version: number;
          source_revision: string; fetched_at: string; generated_at: string };
  kinds: PresentationKind[];
  names: string[];
  affiliations: string[];
  papers: [string, string, number[], number[], number, string, string][];
  presentations: [string, number, string, number][];
  sessions: [string, string, string, string, string, string, string[]][];
  satellite: [string, string, string, string, string, string, string, string, string, string][];
}

export const SUPPORTED_SCHEMA = 1;

/** Presentation ids are derived, never stored. Keep this the single source of truth. */
export function presentationId(paperId: string, kind: PresentationKind): string {
  return kind === 'poster' ? paperId : `${paperId}:oral`;
}

export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function decodeProgram(raw: MinBundle): Program {
  if (raw.meta.schema_version !== SUPPORTED_SCHEMA) {
    throw new Error(
      `program.min.json schema ${raw.meta.schema_version} is not supported (expected ${SUPPORTED_SCHEMA})`,
    );
  }

  const meta: ProgramMeta = {
    conference: raw.meta.conference,
    venue: raw.meta.venue,
    timezone: raw.meta.timezone,
    schemaVersion: raw.meta.schema_version,
    sourceRevision: raw.meta.source_revision,
    fetchedAt: raw.meta.fetched_at,
    generatedAt: raw.meta.generated_at,
  };

  const papers: Paper[] = raw.papers.map(
    ([id, title, authorIdx, presenterIdx, affIdx, country, affKey]) => ({
      id,
      title,
      authors: authorIdx.map((i) => raw.names[i]),
      presenters: presenterIdx.map((i) => raw.names[i]),
      affiliation: affIdx >= 0 ? raw.affiliations[affIdx] : '',
      affiliationKey: affKey,
      country,
      presentationIds: [],
    }),
  );
  const byPaperId = new Map(papers.map((p) => [p.id, p]));

  const presentations: Presentation[] = raw.presentations.map(
    ([paperId, kindIdx, sessionId, order]) => {
      const kind = raw.kinds[kindIdx];
      return { id: presentationId(paperId, kind), paperId, kind, sessionId, orderInSession: order };
    },
  );
  for (const pr of presentations) byPaperId.get(pr.paperId)?.presentationIds.push(pr.id);
  const byPresentationId = new Map(presentations.map((pr) => [pr.id, pr]));

  const sessions = new Map<string, Session>(
    raw.sessions.map(([id, kind, name, start, end, room, chairs]) => [
      id, { id, kind: kind as SessionKind, name, start, end, room, chairs },
    ]),
  );

  const satellite: SatelliteEvent[] = raw.satellite.map(
    ([id, acronym, name, type, theme, room, floor, start, end, url]) => ({
      id, acronym, name, type: type as SatelliteEvent['type'], theme, room, floor, start, end, url,
    }),
  );
  const bySatelliteId = new Map(satellite.map((e) => [e.id, e]));

  const authors = new Map<string, Author>();
  const affiliations = new Map<string, Affiliation>();
  for (const p of papers) {
    const seen = new Set<string>();
    for (const name of [...p.authors, ...p.presenters]) {
      const id = slugifyName(name);
      if (!id) continue;
      let a = authors.get(id);
      if (!a) { a = { id, name, paperIds: [], affiliations: [] }; authors.set(id, a); }
      if (!seen.has(id)) { a.paperIds.push(p.id); seen.add(id); }
    }
    for (const name of p.presenters) {
      const a = authors.get(slugifyName(name));
      if (a && p.affiliation && !a.affiliations.includes(p.affiliation)) a.affiliations.push(p.affiliation);
    }
    if (p.affiliationKey) {
      let f = affiliations.get(p.affiliationKey);
      if (!f) {
        f = { id: p.affiliationKey, name: p.affiliation, country: p.country, paperIds: [] };
        affiliations.set(p.affiliationKey, f);
      }
      f.paperIds.push(p.id);
    }
  }

  return { meta, papers, byPaperId, presentations, byPresentationId,
           sessions, satellite, bySatelliteId, authors, affiliations };
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd web && npx vitest run test/decode.test.ts`
Expected: PASS，8 个测试全绿

- [ ] **Step 9: 写 load（带缓存）**

`web/src/data/load.ts`：

```ts
import { decodeProgram, type MinBundle } from './decode';
import type { Program } from './types';

const DATA_URL = '/data/program.min.json';
const CACHE_NAME = 'miccai-program-v1';

/** 先用缓存立即渲染，同时后台校验新版本；会场 Wi-Fi 很差，这是刚需。 */
export async function loadProgram(): Promise<Program> {
  let cache: Cache | undefined;
  try { cache = await caches.open(CACHE_NAME); } catch { /* 隐私模式 / 不支持 */ }

  const cached = await cache?.match(DATA_URL).catch(() => undefined);
  if (cached) {
    const program = decodeProgram((await cached.json()) as MinBundle);
    void revalidate(cache);
    return program;
  }

  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`program fetch failed: ${res.status}`);
  try { await cache?.put(DATA_URL, res.clone()); } catch { /* 配额不足，忽略 */ }
  return decodeProgram((await res.json()) as MinBundle);
}

async function revalidate(cache?: Cache): Promise<void> {
  if (!cache) return;
  try {
    const fresh = await fetch(DATA_URL, { cache: 'no-cache' });
    if (fresh.ok) await cache.put(DATA_URL, fresh);
  } catch { /* 离线，保留缓存 */ }
}
```

- [ ] **Step 10: 最小 App 壳验证端到端**

`web/src/App.tsx` 先渲染 `meta.sourceRevision` 和 `counts`，跑 `npm run dev` 目视确认加载成功。

- [ ] **Step 11: 提交**

```bash
cd /Users/henrylau/Documents/Scholar/10_Activity/MICCAI-Subscribe
git add web/ .gitignore
git commit -m "feat(web): scaffold Vite/React/Tailwind app and program bundle decoder"
```

---

## Task 2: 搜索引擎

**Files:**
- Create: `web/src/search/normalize.ts`, `web/src/search/engine.ts`
- Create: `web/test/search.test.ts`

**Interfaces:**
- Consumes: `Program`（Task 1）
- Produces: `buildSearchIndex(program: Program): SearchIndex`；`search(index: SearchIndex, query: string, limit?: number): SearchResult[]`；`SearchResult = { kind: 'paper'; paper: Paper; score: number } | { kind: 'satellite'; event: SatelliteEvent; score: number }`

- [ ] **Step 1: 写失败的测试**

`web/test/search.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { buildSearchIndex, search, type SearchIndex } from '../src/search/engine';
import { fold, tokenize } from '../src/search/normalize';
import raw from '../public/data/program.min.json';

let index: SearchIndex;
beforeAll(() => { index = buildSearchIndex(decodeProgram(raw as never)); });

const papers = (q: string, n = 20) =>
  search(index, q, n).filter((r) => r.kind === 'paper').map((r) => (r as { paper: { id: string } }).paper.id);

describe('normalize', () => {
  it('folds diacritics', () => {
    expect(fold('Rüveyda Yilmaz')).toBe('ruveyda yilmaz');
    expect(fold('Maša Božić-Iven')).toBe('masa bozic-iven');
    expect(fold('Erlangen-Nürnberg')).toBe('erlangen-nurnberg');
  });
  it('tokenizes on punctuation', () => {
    expect(tokenize('Vision–Language Pretraining')).toEqual(['vision', 'language', 'pretraining']);
  });
});

describe('search', () => {
  it('matches a board number exactly and ranks it first', () => {
    expect(papers('M-PM-001')[0]).toBe('M-PM-001');
  });
  it('is case-insensitive on board numbers', () => {
    expect(papers('m-pm-001')[0]).toBe('M-PM-001');
  });
  it('finds papers by title keyword', () => {
    expect(papers('SegDINO')).toContain('M-PM-003');
  });
  it('ranks a full title match above a partial one', () => {
    const r = papers('Deep Probabilistic Cerebrovascular Atlas');
    expect(r[0]).toBe('M-PM-014');
  });
  it('finds papers by any author, not just the presenter', () => {
    // Dinggang Shen is a middle author on M-PM-002
    expect(papers('Dinggang Shen')).toContain('M-PM-002');
  });
  it('finds papers by presenter name', () => {
    expect(papers('Yuan Xue')).toContain('M-PM-001');
  });
  it('finds papers by affiliation', () => {
    expect(papers('Ohio State', 50)).toContain('M-PM-001');
  });
  it('finds papers by diacritic-free spelling of an accented affiliation', () => {
    const hits = papers('Nurnberg', 60);
    expect(hits.length).toBeGreaterThan(0);
  });
  it('requires every query token to match (AND semantics)', () => {
    expect(papers('SegDINO zzzznotaword')).toHaveLength(0);
  });
  it('matches satellite events by acronym', () => {
    const r = search(index, 'STACOM', 10);
    expect(r[0].kind).toBe('satellite');
  });
  it('returns nothing for an empty query', () => {
    expect(search(index, '   ', 10)).toHaveLength(0);
  });
  it('runs a typical query in under 20ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) search(index, 'segmentation', 30);
    expect((performance.now() - t0) / 20).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/search.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 normalize**

`web/src/search/normalize.ts`：

```ts
/** NFKD 折叠变音符并小写。搜 "Nurnberg" 必须命中 "Nürnberg"。 */
export function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 折叠后按非字母数字切词。连字符也切，"Vision–Language" -> ["vision","language"]。 */
export function tokenize(s: string): string[] {
  return fold(s).split(/[^a-z0-9]+/).filter(Boolean);
}

/** 展板号识别：M-PM-001 / mpm001 都算。 */
export function asBoardNumber(q: string): string | null {
  const m = fold(q).replace(/[^a-z0-9]/g, '').match(/^([mtw])(am|pm)(\d{1,3})$/);
  if (!m) return null;
  return `${m[1].toUpperCase()}-${m[2].toUpperCase()}-${m[3].padStart(3, '0')}`;
}
```

- [ ] **Step 4: 实现 engine**

`web/src/search/engine.ts`：

```ts
import type { Paper, Program, SatelliteEvent } from '../data/types';
import { asBoardNumber, fold, tokenize } from './normalize';

/** 每条记录预先摊平成几段检索串，查询时只做子串/词首扫描。1165 条不需要倒排索引。 */
interface PaperDoc {
  paper: Paper;
  title: string;      // folded
  titleTokens: string;// ' '-delimited, 便于词首匹配
  authors: string;
  presenters: string;
  affiliation: string;
  country: string;
  sessions: string;
  board: string;
}

interface SatelliteDoc {
  event: SatelliteEvent;
  acronym: string;
  name: string;
  theme: string;
  room: string;
}

export interface SearchIndex {
  program: Program;
  papers: PaperDoc[];
  satellite: SatelliteDoc[];
}

export type SearchResult =
  | { kind: 'paper'; paper: Paper; score: number }
  | { kind: 'satellite'; event: SatelliteEvent; score: number };

const pad = (s: string) => ` ${s} `;

export function buildSearchIndex(program: Program): SearchIndex {
  const sessionsOf = new Map<string, string[]>();
  for (const pr of program.presentations) {
    const s = program.sessions.get(pr.sessionId);
    if (!s) continue;
    const list = sessionsOf.get(pr.paperId) ?? [];
    list.push(s.name);
    sessionsOf.set(pr.paperId, list);
  }

  const papers = program.papers.map<PaperDoc>((paper) => ({
    paper,
    title: fold(paper.title),
    titleTokens: pad(tokenize(paper.title).join(' ')),
    authors: pad(tokenize(paper.authors.join(' ')).join(' ')),
    presenters: pad(tokenize(paper.presenters.join(' ')).join(' ')),
    affiliation: fold(paper.affiliation),
    country: fold(paper.country),
    sessions: fold((sessionsOf.get(paper.id) ?? []).join(' ')),
    board: fold(paper.id),
  }));

  const satellite = program.satellite.map<SatelliteDoc>((event) => ({
    event,
    acronym: fold(event.acronym),
    name: fold(event.name),
    theme: fold(event.theme),
    room: fold(event.room),
  }));

  return { program, papers, satellite };
}

/** 单个 token 对一篇论文的得分。0 表示不匹配，调用方据此实现 AND 语义。 */
function scorePaperToken(d: PaperDoc, tok: string): number {
  let best = 0;
  if (d.board.includes(tok)) best = Math.max(best, 400);
  if (d.title === tok) best = Math.max(best, 500);
  else if (d.titleTokens.includes(` ${tok} `)) best = Math.max(best, 300);
  else if (d.titleTokens.includes(` ${tok}`)) best = Math.max(best, 220);
  else if (d.title.includes(tok)) best = Math.max(best, 100);
  if (d.presenters.includes(` ${tok} `)) best = Math.max(best, 260);
  else if (d.presenters.includes(` ${tok}`)) best = Math.max(best, 200);
  if (d.authors.includes(` ${tok} `)) best = Math.max(best, 250);
  else if (d.authors.includes(` ${tok}`)) best = Math.max(best, 190);
  if (d.affiliation.includes(tok)) best = Math.max(best, 180);
  if (d.sessions.includes(tok)) best = Math.max(best, 120);
  if (d.country.includes(tok)) best = Math.max(best, 60);
  return best;
}

function scoreSatelliteToken(d: SatelliteDoc, tok: string): number {
  let best = 0;
  if (d.acronym === tok) best = Math.max(best, 900);
  else if (d.acronym.includes(tok)) best = Math.max(best, 400);
  if (d.name.includes(tok)) best = Math.max(best, 220);
  if (d.theme.includes(tok)) best = Math.max(best, 110);
  if (d.room.includes(tok)) best = Math.max(best, 80);
  return best;
}

export function search(index: SearchIndex, query: string, limit = 50): SearchResult[] {
  const board = asBoardNumber(query);
  if (board) {
    const paper = index.program.byPaperId.get(board);
    if (paper) return [{ kind: 'paper', paper, score: 10_000 }];
  }

  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const out: SearchResult[] = [];

  for (const d of index.papers) {
    let total = 0;
    for (const tok of tokens) {
      const s = scorePaperToken(d, tok);
      if (s === 0) { total = 0; break; }   // AND: 有一个 token 不中就整条淘汰
      total += s;
    }
    if (total > 0) {
      // 整串出现在标题里给一次强加成，让完整标题查询排到最前
      if (index.papers.length && d.title.includes(fold(query))) total += 400;
      out.push({ kind: 'paper', paper: d.paper, score: total });
    }
  }

  for (const d of index.satellite) {
    let total = 0;
    for (const tok of tokens) {
      const s = scoreSatelliteToken(d, tok);
      if (s === 0) { total = 0; break; }
      total += s;
    }
    if (total > 0) out.push({ kind: 'satellite', event: d.event, score: total });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd web && npx vitest run test/search.test.ts`
Expected: PASS，13 个测试全绿。若 `Nurnberg` 或 `Ohio State` 用例失败，检查 `fold` 是否在 `affiliation` 上应用过。

- [ ] **Step 6: 提交**

```bash
git add web/src/search web/test/search.test.ts
git commit -m "feat(web): client-side search over titles, authors, affiliations and satellite events"
```

---

## Task 3: 本地存储与状态

**Files:**
- Create: `web/src/store/storage.ts`, `web/src/store/StoreProvider.tsx`
- Create: `web/test/storage.test.ts`

**Interfaces:**
- Produces: `loadState(): StoredState`；`saveState(s: StoredState): void`；`StoredState = { v: 1; bookmarks: string[]; followedAuthors: string[]; followedAffiliations: string[]; excluded: string[]; prefs: { reminderMinutes: number } }`；React 侧 `useStore()` 返回 `{ state, isBookmarked, toggleBookmark, isFollowingAuthor, toggleFollowAuthor, isFollowingAffiliation, toggleFollowAffiliation, toggleExcluded, setReminderMinutes, replaceState }`

- [ ] **Step 1: 写失败的测试**

`web/test/storage.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, defaultState, loadState, saveState } from '../src/store/storage';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadState()).toEqual(defaultState());
  });

  it('round-trips state', () => {
    const s = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-042:oral'] };
    saveState(s);
    expect(loadState().bookmarks).toEqual(['M-PM-001', 'M-PM-042:oral']);
  });

  it('ignores corrupt JSON instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(defaultState());
  });

  it('ignores a state written by a future schema', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, bookmarks: ['X'] }));
    expect(loadState().bookmarks).toEqual([]);
  });

  it('repairs missing fields from a partial state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, bookmarks: ['A'] }));
    const s = loadState();
    expect(s.bookmarks).toEqual(['A']);
    expect(s.followedAuthors).toEqual([]);
    expect(s.prefs.reminderMinutes).toBe(15);
  });

  it('survives localStorage throwing (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => saveState(defaultState())).not.toThrow();
    spy.mockRestore();
  });

  it('survives getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(loadState()).toEqual(defaultState());
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/storage.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 storage**

`web/src/store/storage.ts`：

```ts
export const STORAGE_KEY = 'miccai-subscribe:v1';
export const SCHEMA = 1;

export interface StoredState {
  v: number;
  bookmarks: string[];            // presentation id 或 satellite event id
  followedAuthors: string[];      // author slug
  followedAffiliations: string[]; // affiliation key
  excluded: string[];             // 从关注结果里手动排除的 presentation id
  prefs: { reminderMinutes: number };
}

export function defaultState(): StoredState {
  return { v: SCHEMA, bookmarks: [], followedAuthors: [], followedAffiliations: [],
           excluded: [], prefs: { reminderMinutes: 15 } };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** 永不抛异常。隐私模式、配额不足、脏数据一律退回默认值。 */
export function loadState(): StoredState {
  let text: string | null = null;
  try { text = localStorage.getItem(STORAGE_KEY); } catch { return defaultState(); }
  if (!text) return defaultState();

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return defaultState(); }
  if (typeof parsed !== 'object' || parsed === null) return defaultState();

  const o = parsed as Record<string, unknown>;
  if (o.v !== SCHEMA) return defaultState();   // 未知版本，宁可丢也不误读

  const prefs = (o.prefs ?? {}) as Record<string, unknown>;
  return {
    v: SCHEMA,
    bookmarks: strings(o.bookmarks),
    followedAuthors: strings(o.followedAuthors),
    followedAffiliations: strings(o.followedAffiliations),
    excluded: strings(o.excluded),
    prefs: {
      reminderMinutes: typeof prefs.reminderMinutes === 'number' ? prefs.reminderMinutes : 15,
    },
  };
}

export function saveState(state: StoredState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 无痕模式，只活在内存里 */ }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run test/storage.test.ts`
Expected: PASS，7 个测试全绿

- [ ] **Step 5: 实现 React 层**

`web/src/store/StoreProvider.tsx` —— 用 `useState` 持有 `StoredState`，每次变更 `saveState`。导出 `useStore()`。所有 toggle 用不可变更新，示例：

```tsx
const toggleBookmark = useCallback((id: string) => {
  setState((s) => {
    const has = s.bookmarks.includes(id);
    const next = { ...s, bookmarks: has ? s.bookmarks.filter((x) => x !== id) : [...s.bookmarks, id] };
    saveState(next);
    return next;
  });
}, []);
```

`toggleFollowAuthor` / `toggleFollowAffiliation` / `toggleExcluded` 结构完全相同，分别作用于 `followedAuthors` / `followedAffiliations` / `excluded`。`replaceState(next)` 直接整体替换并落盘，供 Task 8 的导入功能使用。

- [ ] **Step 6: 提交**

```bash
git add web/src/store web/test/storage.test.ts
git commit -m "feat(web): fault-tolerant local-first bookmark and follow store"
```

---

## Task 4: 日程聚合与三档冲突判定

**Files:**
- Create: `web/src/store/schedule.ts`
- Create: `web/test/schedule.test.ts`

**Interfaces:**
- Consumes: `Program`（Task 1）、`StoredState`（Task 3）
- Produces: `buildSchedule(program, state): ScheduleDay[]`；`ScheduleDay = { date: string; items: ScheduleItem[] }`；`ScheduleItem = { key: string; source: 'bookmark' | 'author' | 'affiliation'; sourceLabel: string; presentation?: Presentation; paper?: Paper; session?: Session; satellite?: SatelliteEvent; start: string; end: string; conflicts: Conflict[] }`；`Conflict = { level: 'hard' | 'soft' | 'same-poster-session'; withKey: string }`；另导出 `formatDay(iso)`、`formatTime(iso)`、`overlaps(a, b)`

- [ ] **Step 1: 写失败的测试**

`web/test/schedule.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { defaultState } from '../src/store/storage';
import { buildSchedule, formatDay, formatTime, overlaps } from '../src/store/schedule';
import type { Program } from '../src/data/types';
import raw from '../public/data/program.min.json';

let program: Program;
beforeAll(() => { program = decodeProgram(raw as never); });

describe('time formatting is timezone-independent', () => {
  it('reads conference-local time straight off the ISO string', () => {
    // 若实现改用 new Date()，机器设成 Asia/Tokyo 时这条会挂
    expect(formatTime('2026-09-28T16:00:00+02:00')).toBe('16:00');
    expect(formatDay('2026-09-28T16:00:00+02:00')).toBe('2026-09-28');
  });
});

describe('overlaps', () => {
  it('detects overlap', () => {
    expect(overlaps(
      { start: '2026-09-28T10:30:00+02:00', end: '2026-09-28T12:00:00+02:00' },
      { start: '2026-09-28T11:00:00+02:00', end: '2026-09-28T13:00:00+02:00' },
    )).toBe(true);
  });
  it('treats touching intervals as non-overlapping', () => {
    expect(overlaps(
      { start: '2026-09-28T10:30:00+02:00', end: '2026-09-28T12:00:00+02:00' },
      { start: '2026-09-28T12:00:00+02:00', end: '2026-09-28T13:00:00+02:00' },
    )).toBe(false);
  });
});

describe('buildSchedule', () => {
  it('is empty with no bookmarks', () => {
    expect(buildSchedule(program, defaultState())).toEqual([]);
  });

  it('groups by day and sorts by start time', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-042:oral', 'M-PM-001'] };
    const days = buildSchedule(program, state);
    expect(days.map((d) => d.date)).toEqual(['2026-09-28']);
    expect(days[0].items.map((i) => i.start)).toEqual([
      '2026-09-28T10:30:00+02:00',  // O1A oral
      '2026-09-28T16:00:00+02:00',  // P1 poster
    ]);
  });

  it('does NOT flag two posters in the same session as a conflict', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-002'] };
    const [day] = buildSchedule(program, state);
    for (const item of day.items) {
      expect(item.conflicts.every((c) => c.level === 'same-poster-session')).toBe(true);
    }
  });

  it('flags two overlapping oral sessions as a hard conflict', () => {
    // O1A 和 O1B 都是 Mon 10:30-12:00
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const b = program.presentations.find((p) => p.sessionId === 'O1B' && p.kind !== 'poster')!;
    const state = { ...defaultState(), bookmarks: [a.id, b.id] };
    const [day] = buildSchedule(program, state);
    expect(day.items[0].conflicts.some((c) => c.level === 'hard')).toBe(true);
  });

  it('pulls in a followed author\'s papers and labels their source', () => {
    const state = { ...defaultState(), followedAuthors: ['yuan-xue'] };
    const days = buildSchedule(program, state);
    const item = days.flatMap((d) => d.items).find((i) => i.paper?.id === 'M-PM-001');
    expect(item?.source).toBe('author');
    expect(item?.sourceLabel).toBe('Yuan Xue');
  });

  it('honours exclusions from a follow', () => {
    const state = { ...defaultState(), followedAuthors: ['yuan-xue'], excluded: ['M-PM-001'] };
    const days = buildSchedule(program, state);
    expect(days.flatMap((d) => d.items).some((i) => i.paper?.id === 'M-PM-001')).toBe(false);
  });

  it('an explicit bookmark wins over a follow as the item source', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001'], followedAuthors: ['yuan-xue'] };
    const items = buildSchedule(program, state).flatMap((d) => d.items).filter((i) => i.paper?.id === 'M-PM-001');
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('bookmark');
  });

  it('includes bookmarked satellite events', () => {
    const ev = program.satellite[0];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [ev.id] });
    expect(days[0].date).toBe('2026-09-27');
    expect(days[0].items[0].satellite?.acronym).toBe(ev.acronym);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/schedule.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 schedule**

`web/src/store/schedule.ts`：

```ts
import type { Paper, Presentation, Program, SatelliteEvent, Session } from '../data/types';
import type { StoredState } from './storage';

/** 所有时间戳都已是 Europe/Paris 本地时间，切字符串即可，绝不用 Date 取时分。 */
export const formatDay = (iso: string): string => iso.slice(0, 10);
export const formatTime = (iso: string): string => iso.slice(11, 16);

export interface Interval { start: string; end: string }
export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

export type ConflictLevel = 'hard' | 'soft' | 'same-poster-session';
export interface Conflict { level: ConflictLevel; withKey: string }

export interface ScheduleItem {
  key: string;
  source: 'bookmark' | 'author' | 'affiliation';
  sourceLabel: string;
  presentation?: Presentation;
  paper?: Paper;
  session?: Session;
  satellite?: SatelliteEvent;
  start: string;
  end: string;
  conflicts: Conflict[];
}

export interface ScheduleDay { date: string; items: ScheduleItem[] }

function collect(program: Program, state: StoredState): ScheduleItem[] {
  const excluded = new Set(state.excluded);
  const byKey = new Map<string, ScheduleItem>();

  const addPresentation = (
    id: string, source: ScheduleItem['source'], label: string,
  ): void => {
    if (excluded.has(id)) return;
    const pr = program.byPresentationId.get(id);
    if (!pr) return;
    const session = program.sessions.get(pr.sessionId);
    const paper = program.byPaperId.get(pr.paperId);
    if (!session || !paper) return;
    const existing = byKey.get(id);
    // 显式收藏优先于关注带出来的
    if (existing && (existing.source === 'bookmark' || source !== 'bookmark')) return;
    byKey.set(id, { key: id, source, sourceLabel: label, presentation: pr, paper, session,
                    start: session.start, end: session.end, conflicts: [] });
  };

  for (const id of state.bookmarks) {
    const sat = program.bySatelliteId.get(id);
    if (sat) {
      byKey.set(id, { key: id, source: 'bookmark', sourceLabel: '', satellite: sat,
                      start: sat.start, end: sat.end, conflicts: [] });
      continue;
    }
    addPresentation(id, 'bookmark', '');
  }

  for (const slug of state.followedAuthors) {
    const author = program.authors.get(slug);
    if (!author) continue;
    for (const paperId of author.paperIds) {
      for (const pid of program.byPaperId.get(paperId)?.presentationIds ?? []) {
        addPresentation(pid, 'author', author.name);
      }
    }
  }

  for (const key of state.followedAffiliations) {
    const aff = program.affiliations.get(key);
    if (!aff) continue;
    for (const paperId of aff.paperIds) {
      for (const pid of program.byPaperId.get(paperId)?.presentationIds ?? []) {
        addPresentation(pid, 'affiliation', aff.name);
      }
    }
  }

  return [...byKey.values()];
}

function annotateConflicts(items: ScheduleItem[]): void {
  for (const a of items) {
    for (const b of items) {
      if (a === b || !overlaps(a, b)) continue;
      const bothPosters = a.presentation?.kind === 'poster' && b.presentation?.kind === 'poster';
      if (bothPosters && a.presentation!.sessionId === b.presentation!.sessionId) {
        // 同一场 poster session 里收藏多篇很正常，2 小时够依次看完，不该报警
        a.conflicts.push({ level: 'same-poster-session', withKey: b.key });
        continue;
      }
      const aTalk = a.presentation ? a.presentation.kind !== 'poster' : !!a.satellite;
      const bTalk = b.presentation ? b.presentation.kind !== 'poster' : !!b.satellite;
      a.conflicts.push({ level: aTalk && bTalk ? 'hard' : 'soft', withKey: b.key });
    }
  }
}

export function buildSchedule(program: Program, state: StoredState): ScheduleDay[] {
  const items = collect(program, state);
  annotateConflicts(items);
  items.sort((a, b) => (a.start === b.start ? a.key.localeCompare(b.key) : a.start.localeCompare(b.start)));

  const days = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const d = formatDay(item.start);
    (days.get(d) ?? days.set(d, []).get(d)!).push(item);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, i]) => ({ date, items: i }));
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run test/schedule.test.ts`
Expected: PASS，11 个测试全绿

- [ ] **Step 5: 提交**

```bash
git add web/src/store/schedule.ts web/test/schedule.test.ts
git commit -m "feat(web): schedule aggregation with three-tier conflict detection"
```

---

## Task 5: ICS 生成

**Files:**
- Create: `web/src/calendar/ics.ts`, `web/src/calendar/build.ts`, `web/src/calendar/google.ts`
- Create: `web/test/ics.test.ts`

**Interfaces:**
- Consumes: `ScheduleDay[]`（Task 4）、`Program`
- Produces: `escapeText(s): string`；`foldLine(s): string`；`buildCalendar(events: IcsEvent[], opts): string`；`IcsEvent = { uid: string; start: string; end: string; summary: string; description: string; location: string; url?: string; alarmMinutes?: number }`；`scheduleToEvents(program, days, reminderMinutes): IcsEvent[]`；`googleCalendarUrl(e: IcsEvent): string`

- [ ] **Step 1: 写失败的测试**

`web/test/ics.test.ts`：

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { defaultState } from '../src/store/storage';
import { buildSchedule } from '../src/store/schedule';
import { buildCalendar, escapeText, foldLine, type IcsEvent } from '../src/calendar/ics';
import { scheduleToEvents } from '../src/calendar/build';
import { googleCalendarUrl } from '../src/calendar/google';
import type { Program } from '../src/data/types';
import raw from '../public/data/program.min.json';

let program: Program;
beforeAll(() => { program = decodeProgram(raw as never); });

const sample: IcsEvent = {
  uid: 'M-PM-001@miccaisubscribe.com',
  start: '2026-09-28T16:00:00+02:00',
  end: '2026-09-28T18:00:00+02:00',
  summary: 'Poster Session 1',
  description: 'Board M-PM-001',
  location: 'Strasbourg Convention Center',
  alarmMinutes: 15,
};

describe('escaping (RFC 5545 §3.3.11)', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\;c\\,d\\ne');
  });
  it('escapes the backslash first so it is not doubled twice', () => {
    expect(escapeText('x\\,y')).toBe('x\\\\\\,y');
  });
});

describe('line folding (RFC 5545 §3.1)', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi');
  });
  it('folds at 75 octets with a leading space on continuations', () => {
    const folded = foldLine('SUMMARY:' + 'a'.repeat(200)).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
  });
  it('never splits a multi-byte character across a fold', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(100)).split('\r\n');
    expect(folded.join('').includes('�')).toBe(false);
    expect(folded.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('buildCalendar', () => {
  const ics = buildCalendar([sample], { prodId: '-//MICCAI Subscribe//EN', name: 'MICCAI 2026' });

  it('uses CRLF line endings throughout', () => {
    expect(ics.includes('\n')).toBe(true);
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });
  it('emits a well-formed VCALENDAR envelope', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('CALSCALE:GREGORIAN');
  });
  it('includes a Europe/Paris VTIMEZONE and references it by TZID', () => {
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Europe/Paris');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20260928T160000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20260928T180000');
  });
  it('emits a VALARM at the requested offset', () => {
    expect(ics).toContain('TRIGGER:-PT15M');
  });
  it('keeps UID stable across regeneration', () => {
    const again = buildCalendar([sample], { prodId: '-//MICCAI Subscribe//EN', name: 'MICCAI 2026' });
    const uid = (s: string) => s.match(/UID:(.*)/)![1];
    expect(uid(ics)).toBe(uid(again));
  });
});

describe('scheduleToEvents', () => {
  it('emits ONE event per session even with several talks bookmarked in it', () => {
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const b = program.presentations.filter((p) => p.sessionId === 'O1A' && p.kind !== 'poster')[1];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [a.id, b.id] });
    const events = scheduleToEvents(program, days, 15);
    expect(events).toHaveLength(1);
    expect(events[0].start).toBe('2026-09-28T10:30:00+02:00');
    expect(events[0].end).toBe('2026-09-28T12:00:00+02:00');
  });

  it('lists the bookmarked talks in the description and says times are unpublished', () => {
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const [event] = scheduleToEvents(program, buildSchedule(program, { ...defaultState(), bookmarks: [a.id] }), 15);
    expect(event.description).toContain(program.byPaperId.get(a.paperId)!.title);
    expect(event.description).toMatch(/not published|未公布/);
  });

  it('puts the board number in a poster event description', () => {
    const days = buildSchedule(program, { ...defaultState(), bookmarks: ['M-PM-001'] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.description).toContain('M-PM-001');
  });

  it('does not invent a room for poster sessions', () => {
    const days = buildSchedule(program, { ...defaultState(), bookmarks: ['M-PM-001'] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.location).not.toMatch(/Hall/);
  });

  it('gives satellite events their own room as location', () => {
    const ev = program.satellite[0];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [ev.id] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.location).toContain(ev.room);
  });
});

describe('googleCalendarUrl', () => {
  it('encodes UTC times in the compact basic format', () => {
    const url = googleCalendarUrl(sample);
    expect(url).toContain('dates=20260928T140000Z%2F20260928T160000Z');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/ics.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 ics writer**

`web/src/calendar/ics.ts`：

```ts
export interface IcsEvent {
  uid: string;
  start: string;   // ISO with +02:00
  end: string;
  summary: string;
  description: string;
  location: string;
  url?: string;
  alarmMinutes?: number;
}

export interface CalendarOptions { prodId: string; name: string }

/** RFC 5545 §3.3.11。反斜杠必须最先转，否则会被二次转义。 */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** RFC 5545 §3.1：内容行不超过 75 octets，续行以单个空格开头。按字节折，但不切开多字节字符。 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {          // 按码位迭代，天然不切开多字节字符
    const n = enc.encode(ch).length;
    if (curBytes + n > limit) {
      out.push(cur);
      cur = ' ';                    // 续行前导空格本身占 1 octet
      curBytes = 1;
      limit = 75;
    }
    cur += ch;
    curBytes += n;
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
}

/** 会期全程 CEST，但仍输出完整 VTIMEZONE，让客户端自己换算。 */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** '2026-09-28T16:00:00+02:00' -> '20260928T160000'（本地形式，配 TZID 用） */
export function localStamp(iso: string): string {
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}00`;
}

/** UTC 形式，供 DTSTAMP 和 Google URL 使用 */
export function utcStamp(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

export function buildCalendar(events: IcsEvent[], opts: CalendarOptions): string {
  const stamp = utcStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${opts.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    ...VTIMEZONE,
  ];

  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Paris:${localStamp(e.start)}`,
      `DTEND;TZID=Europe/Paris:${localStamp(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `LOCATION:${escapeText(e.location)}`,
    );
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.alarmMinutes && e.alarmMinutes > 0) {
      lines.push(
        'BEGIN:VALARM',
        `TRIGGER:-PT${e.alarmMinutes}M`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.summary)}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
```

- [ ] **Step 4: 实现 build（session 级事件，决策 D6）**

`web/src/calendar/build.ts`：

```ts
import type { Program } from '../data/types';
import type { ScheduleDay, ScheduleItem } from '../store/schedule';
import type { IcsEvent } from './ics';

const DOMAIN = 'miccaisubscribe.com';
const VENUE = 'Strasbourg Convention Center, Strasbourg, France';

const kindLabel: Record<string, string> = { oral: 'Oral', spotlight: 'Spotlight' };

/**
 * 一个 session 只产出一个事件（决策 D6）。PDF 没有单个报告的精确时间，
 * 均分估算会让用户错过报告，所以事件覆盖整场，描述里列出你收藏的那几篇。
 */
export function scheduleToEvents(
  program: Program, days: ScheduleDay[], reminderMinutes: number,
): IcsEvent[] {
  const items = days.flatMap((d) => d.items);
  const bySession = new Map<string, ScheduleItem[]>();
  const events: IcsEvent[] = [];

  for (const item of items) {
    if (item.satellite) {
      const s = item.satellite;
      events.push({
        uid: `${s.id}@${DOMAIN}`,
        start: s.start, end: s.end,
        summary: `${s.acronym} (${s.type})`,
        description: [s.name, s.theme && `Theme: ${s.theme}`, s.url].filter(Boolean).join('\n'),
        location: `${s.room}${s.floor ? ` (floor ${s.floor})` : ''}, ${VENUE}`,
        url: s.url || undefined,
        alarmMinutes: reminderMinutes,
      });
      continue;
    }
    if (!item.presentation) continue;
    const list = bySession.get(item.presentation.sessionId) ?? [];
    list.push(item);
    bySession.set(item.presentation.sessionId, list);
  }

  for (const [sessionId, group] of bySession) {
    const session = program.sessions.get(sessionId)!;
    const isPoster = session.kind === 'poster';
    const lines: string[] = [
      isPoster
        ? `Your ${group.length} bookmarked poster(s) in this session:`
        : `Your ${group.length} bookmarked talk(s) in this session:`,
      '',
    ];
    for (const item of group.sort((a, b) =>
      (a.presentation!.orderInSession || 0) - (b.presentation!.orderInSession || 0))) {
      const pr = item.presentation!;
      const paper = item.paper!;
      const tag = isPoster
        ? `Board ${pr.paperId}`
        : `${kindLabel[pr.kind] ?? pr.kind} ${pr.orderInSession || '?'}`;
      lines.push(`• [${tag}] ${paper.title}`);
      lines.push(`  ${paper.presenters.join(' & ')}${paper.affiliation ? `, ${paper.affiliation}` : ''}`);
      if (item.source !== 'bookmark') lines.push(`  (from your follow: ${item.sourceLabel})`);
    }
    if (!isPoster) {
      lines.push('', 'Exact per-talk times are not published by MICCAI; this event covers the whole session.');
    } else {
      lines.push('', 'Poster hall location is not published by MICCAI; follow on-site signage.');
    }

    events.push({
      uid: `${sessionId}@${DOMAIN}`,
      start: session.start,
      end: session.end,
      summary: isPoster ? session.name : `${sessionId} · ${session.name}`,
      description: lines.join('\n'),
      location: session.room ? `${session.room}, ${VENUE}` : VENUE,
      alarmMinutes: reminderMinutes,
    });
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
```

- [ ] **Step 5: 实现 google.ts**

`web/src/calendar/google.ts`：

```ts
import type { IcsEvent } from './ics';

/** Google 的 dates= 参数要 UTC 基本格式。会期固定 +02:00，直接减 2 小时。 */
function toUtcBasic(iso: string): string {
  const utc = new Date(iso);
  return `${utc.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

export function googleCalendarUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.summary,
    dates: `${toUtcBasic(e.start)}/${toUtcBasic(e.end)}`,
    details: e.description,
    location: e.location,
    ctz: 'Europe/Paris',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd web && npx vitest run test/ics.test.ts`
Expected: PASS，17 个测试全绿

- [ ] **Step 7: 提交**

```bash
git add web/src/calendar web/test/ics.test.ts
git commit -m "feat(web): RFC 5545 ICS generation with session-level events"
```

---

## Task 6: 应用外壳、路由与搜索界面

**Files:**
- Create: `web/src/App.tsx`（替换 Task 1 的临时版）, `web/src/ui/BottomNav.tsx`, `web/src/ui/Footer.tsx`, `web/src/ui/SearchBox.tsx`, `web/src/ui/PaperCard.tsx`, `web/src/ui/BookmarkButton.tsx`, `web/src/ui/EmptyState.tsx`, `web/src/ui/ProgramContext.tsx`
- Create: `web/src/routes/Home.tsx`, `web/src/routes/SearchResults.tsx`, `web/src/routes/About.tsx`
- Create: `web/test/search-ui.test.tsx`

**Interfaces:**
- Consumes: `loadProgram`、`buildSearchIndex`/`search`、`useStore`
- Produces: `useProgram()` 返回 `{ program, index }`；`<BookmarkButton presentationId>`；路由 `/`、`/search`、`/about`

- [ ] **Step 1: 写失败的测试**

`web/test/search-ui.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperCard } from '../src/ui/PaperCard';
import { StoreProvider } from '../src/store/StoreProvider';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);
const paper = program.byPaperId.get('M-PM-001')!;

describe('PaperCard', () => {
  it('shows enough to decide without opening the paper', () => {
    render(<StoreProvider><PaperCard program={program} paper={paper} /></StoreProvider>);
    expect(screen.getByText(paper.title)).toBeInTheDocument();
    expect(screen.getByText(/Yuan Xue/)).toBeInTheDocument();
    expect(screen.getByText(/The Ohio State University/)).toBeInTheDocument();
    expect(screen.getByText('M-PM-001')).toBeInTheDocument();
  });

  it('exposes bookmark state through aria-pressed and toggles it', () => {
    render(<StoreProvider><PaperCard program={program} paper={paper} /></StoreProvider>);
    const btn = screen.getByRole('button', { name: /bookmark/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('never renders a fabricated poster hall', () => {
    render(<StoreProvider><PaperCard program={program} paper={paper} /></StoreProvider>);
    expect(screen.queryByText(/Poster Hall/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/search-ui.test.tsx`
Expected: FAIL — 组件不存在

- [ ] **Step 3: 实现 ProgramContext**

`web/src/ui/ProgramContext.tsx`：在 mount 时 `loadProgram()`，成功后 `buildSearchIndex`，通过 context 暴露 `{ program, index }`；加载中渲染骨架，失败渲染"无法加载会议数据，请检查网络"并给重试按钮。

- [ ] **Step 4: 实现组件与路由**

- `BookmarkButton`：`<button aria-pressed={on} aria-label={on ? 'Remove bookmark' : 'Bookmark'}>`，尺寸 ≥ 44×44，`★`/`☆` 之外必须带文字或 `aria-label`（图标不能是唯一意义来源）。
- `PaperCard`：标题、作者（presenter 加粗）、机构、展板号、session 名与时间（`formatDay`/`formatTime`）、收藏按钮。**poster 不显示房间**。
- `SearchBox`：受控输入，`type="search"`，`enterKeyHint="search"`，300 ms 防抖后写入 URL `?q=`。
- `Home`：站名 + 会议信息条 + 搜索框 +「今天」快捷区 + 浏览入口。无登录提示。
- `SearchResults`：读 `?q=`，调 `search()`，论文与 satellite 分组展示，显示命中数；空结果给 `EmptyState`。
- `BottomNav`：探索 / 日程 / Satellite / 关于，`pb-[env(safe-area-inset-bottom)]`。
- `Footer`：`Unofficial community tool for MICCAI 2026.` + `Program data: revised {meta.sourceRevision}`。
- `About`：必须包含四块内容 ——
  1. **非官方声明**：本站与 MICCAI 官方无关，未获背书，不使用官方 logo。
  2. **数据来源**：列出 `meta.sourceRevision`、`meta.fetchedAt`，并链接到官网的两份 PDF；写明"官方日程标注 TENTATIVE，仍可能变动"。
  3. **隐私声明**：不收集姓名、邮箱、机构、位置；收藏只存在你自己的浏览器里；只有你主动生成订阅链接时才会有数据离开设备，且那份数据只含条目 ID。
  4. **已知限制**：无摘要与论文链接（官方 PDF 未提供）；单个 oral 报告的精确时间未公布；poster 厅名称官方未公布；同名作者无法区分。
- `App.tsx`：`<BrowserRouter>` + `<StoreProvider>` + `<ProgramProvider>`，路由表含本任务三条路由，其余任务逐步补齐。

`web/public/_redirects`：

```
/*  /index.html  200
```

- [ ] **Step 5: 运行确认通过**

Run: `cd web && npx vitest run`
Expected: PASS，全部既有测试 + 3 个新测试

- [ ] **Step 6: 目视验证**

Run: `cd web && npm run dev`，浏览器开 375×812 模拟 iPhone，确认：搜索 `Yuan Xue`、`Fudan`、`M-PM-001`、`segmentation` 都有合理结果；无横向滚动；底部导航不被 home indicator 遮挡。

- [ ] **Step 7: 提交**

```bash
git add web/src web/public/_redirects web/test/search-ui.test.tsx
git commit -m "feat(web): app shell, routing, search UI"
```

---

## Task 7: 详情页与关注

**Files:**
- Create: `web/src/routes/PaperDetail.tsx`, `web/src/routes/AuthorDetail.tsx`, `web/src/routes/AffiliationDetail.tsx`, `web/src/routes/SessionDetail.tsx`
- Create: `web/src/ui/FollowButton.tsx`, `web/src/ui/PresentationRow.tsx`
- Modify: `web/src/App.tsx`（加路由）
- Create: `web/test/detail.test.tsx`

**Interfaces:**
- Consumes: `useProgram`、`useStore`
- Produces: 路由 `/paper/:id`、`/author/:slug`、`/affiliation/:key`、`/session/:id`

- [ ] **Step 1: 写失败的测试**

`web/test/detail.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from '../src/store/StoreProvider';
import { FollowButton } from '../src/ui/FollowButton';

describe('FollowButton', () => {
  it('states the homonym limitation next to the control', () => {
    render(
      <StoreProvider>
        <FollowButton kind="author" id="yuan-xue" label="Yuan Xue" hint="The Ohio State University" />
      </StoreProvider>,
    );
    const btn = screen.getByRole('button', { name: /follow/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    // 机构必须显示出来，因为同名作者无法区分
    expect(screen.getByText(/The Ohio State University/)).toBeInTheDocument();
  });

  it('toggles follow state', () => {
    render(
      <StoreProvider>
        <FollowButton kind="author" id="yuan-xue" label="Yuan Xue" hint="" />
      </StoreProvider>,
    );
    const btn = screen.getByRole('button', { name: /follow/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/detail.test.tsx`
Expected: FAIL — `FollowButton` 不存在

- [ ] **Step 3: 实现**

`web/src/ui/FollowButton.tsx`：

```tsx
import { useStore } from '../store/StoreProvider';

interface Props {
  kind: 'author' | 'affiliation';
  id: string;
  label: string;
  /** 作者页传机构名。同名作者无法区分，机构是用户唯一的判别依据，必须始终显示。 */
  hint: string;
}

export function FollowButton({ kind, id, label, hint }: Props) {
  const { isFollowingAuthor, isFollowingAffiliation, toggleFollowAuthor, toggleFollowAffiliation } = useStore();
  const on = kind === 'author' ? isFollowingAuthor(id) : isFollowingAffiliation(id);
  const toggle = () => (kind === 'author' ? toggleFollowAuthor(id) : toggleFollowAffiliation(id));

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? `Unfollow ${label}` : `Follow ${label}`}
        className="min-h-11 min-w-11 rounded-lg px-4 text-sm font-medium"
      >
        {on ? 'Following' : 'Follow'}
      </button>
      {hint && <span className="text-xs text-[--color-muted]">{hint}</span>}
    </div>
  );
}
```
- `PaperDetail`：标题、完整作者列表（presenter 高亮）、机构、国家、展板号；列出该论文的**全部** presentation（poster + 可能的 oral），每条显示 session 名、日期、时间、房间（poster 为「场地见现场指引」）、`orderInSession`；收藏按钮按 presentation 分别提供；「加入 Google 日历」「下载 .ics」。**不显示摘要或论文链接**——数据里没有。
- `AuthorDetail`：姓名、机构列表、关注按钮、其全部论文卡片；顶部一行提示：同名作者无法区分，请结合机构确认。
- `AffiliationDetail`：机构名、论文数、关注按钮、论文列表。
- `SessionDetail`：session 名、类型、时间、房间、chairs、按 `orderInSession` 排序的全部报告。
- `App.tsx` 注册四条路由。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src web/test/detail.test.tsx
git commit -m "feat(web): paper/author/affiliation/session pages with follow"
```

---

## Task 8: 我的日程页

**Files:**
- Create: `web/src/routes/Schedule.tsx`, `web/src/ui/ConflictBadge.tsx`, `web/src/ui/ScheduleItemRow.tsx`
- Modify: `web/src/App.tsx`
- Create: `web/test/schedule-ui.test.tsx`

**Interfaces:**
- Consumes: `buildSchedule`（Task 4）
- Produces: 路由 `/schedule`

- [ ] **Step 1: 写失败的测试**

`web/test/schedule-ui.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConflictBadge } from '../src/ui/ConflictBadge';

describe('ConflictBadge', () => {
  it('renders nothing when there is no conflict', () => {
    const { container } = render(<ConflictBadge conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('calls a same-poster-session overlap what it is, not a conflict', () => {
    render(<ConflictBadge conflicts={[{ level: 'same-poster-session', withKey: 'x' }]} />);
    expect(screen.getByText(/same poster session/i)).toBeInTheDocument();
    expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument();
  });
  it('shows a hard conflict for two overlapping talks', () => {
    render(<ConflictBadge conflicts={[{ level: 'hard', withKey: 'x' }]} />);
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
  });
  it('shows partial overlap for a talk against a poster session', () => {
    render(<ConflictBadge conflicts={[{ level: 'soft', withKey: 'x' }]} />);
    expect(screen.getByText(/partial overlap/i)).toBeInTheDocument();
  });
  it('shows the most severe level when several apply', () => {
    render(<ConflictBadge conflicts={[
      { level: 'same-poster-session', withKey: 'a' }, { level: 'hard', withKey: 'b' }]} />);
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/schedule-ui.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

- `ConflictBadge`：按 `hard` > `soft` > `same-poster-session` 取最严重一档；文案分别为 `Time conflict`（红）、`Partial overlap`（黄）、`Same poster session`（中性灰，明确不是警告）。
- `ScheduleItemRow`：时间段、标题、session、房间或展板号、来源标签（关注带出来的显示「from your follow: X」并提供「排除这条」）、`ConflictBadge`、取消收藏。
- `Schedule`：5 个日期 tab（`2026-09-27`…`2026-10-01`），当天优先选中；每天内按时间排序；空态 `EmptyState` + 「去找论文」按钮；顶部「Add to calendar」跳 `/calendar`。

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src web/test/schedule-ui.test.tsx
git commit -m "feat(web): My Schedule with three-tier conflict display"
```

---

## Task 9: 日历页、导出与跨设备迁移

**Files:**
- Create: `web/src/store/transfer.ts`, `web/src/routes/CalendarPage.tsx`, `web/src/routes/ImportPage.tsx`, `web/src/ui/DownloadIcsButton.tsx`
- Modify: `web/src/App.tsx`
- Create: `web/test/transfer.test.ts`

**Interfaces:**
- Consumes: `scheduleToEvents`、`buildCalendar`、`replaceState`
- Produces: `encodeTransfer(state): string`；`decodeTransfer(s): StoredState | null`；路由 `/calendar`、`/import`

- [ ] **Step 1: 写失败的测试**

`web/test/transfer.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { defaultState } from '../src/store/storage';
import { encodeTransfer, decodeTransfer } from '../src/store/transfer';

describe('cross-device transfer', () => {
  it('round-trips a state through a URL-safe string', () => {
    const s = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-042:oral'], followedAuthors: ['yuan-xue'] };
    const decoded = decodeTransfer(encodeTransfer(s));
    expect(decoded?.bookmarks).toEqual(s.bookmarks);
    expect(decoded?.followedAuthors).toEqual(['yuan-xue']);
  });
  it('produces a string safe to put in a URL fragment', () => {
    const encoded = encodeTransfer({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it('returns null for garbage rather than throwing', () => {
    expect(decodeTransfer('!!!not-base64!!!')).toBeNull();
    expect(decodeTransfer('')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/transfer.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 transfer**

`web/src/store/transfer.ts`：JSON → `TextEncoder` → base64url（`btoa` 后 `+`→`-`、`/`→`_`、去 `=`）。`decodeTransfer` 反向，整体包 try/catch，任何异常返回 `null`，并复用 `loadState` 的字段校验逻辑（抽成 `sanitize(parsed)` 共用）。

- [ ] **Step 4: 实现日历页**

`CalendarPage` 的顺序**必须**是：

1. **「下载 .ics」放第一位**（主推路径）。点击生成 Blob 并 `download="miccai-2026-my-schedule.ics"`。
2. **「订阅链接」第二位**，并在其下方原文显示：*"日历应用自行决定刷新频率，Google 日历可能长达 24 小时。会期中如有改动，建议重新下载 .ics。"* 未开启云同步时，这里显示「生成订阅链接」按钮（Task 12 接后端；在此之前按钮禁用并注明"即将上线"）。
3. 提醒时间设置（`reminderMinutes`，选项 0 / 5 / 15 / 30 / 60）。
4. 跨设备迁移：生成 `/import#<encoded>` 链接 + 复制按钮 + 下载 JSON。

**绝不出现「实时同步」「自动同步」字样。**

`ImportPage` 读 `location.hash`，`decodeTransfer`，展示将导入的条目数并要求确认，确认后 `replaceState`。

- [ ] **Step 5: 运行确认通过**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 6: 真机日历验证（不可跳过）**

把生成的 `.ics` 分别导入 Apple Calendar、Google Calendar、Outlook，逐项确认：
- 事件落在 **2026-09-28 16:00–18:00 Europe/Paris**（把系统时区改成 Asia/Shanghai 再验一次，时间必须仍显示为当地换算后的正确时刻）
- 标题、描述里的换行与逗号正常，没有出现 `\n` 或 `\,` 字面量
- 提醒生效

- [ ] **Step 7: 提交**

```bash
git add web/src web/test/transfer.test.ts
git commit -m "feat(web): calendar export, reminder prefs, cross-device transfer"
```

---

## Task 10: Satellite events 浏览

**Files:**
- Create: `web/src/routes/Satellite.tsx`, `web/src/routes/SatelliteDetail.tsx`, `web/src/ui/SatelliteCard.tsx`
- Modify: `web/src/App.tsx`
- Create: `web/test/satellite-ui.test.tsx`

**Interfaces:**
- Produces: 路由 `/satellite`、`/satellite/:id`

- [ ] **Step 1: 写失败的测试**

`web/test/satellite-ui.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreProvider } from '../src/store/StoreProvider';
import { SatelliteCard } from '../src/ui/SatelliteCard';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);
const ev = program.satellite.find((e) => e.acronym === 'CDMRI')!;

describe('SatelliteCard', () => {
  it('shows acronym, full name, type, room and conference-local time', () => {
    render(<MemoryRouter><StoreProvider><SatelliteCard event={ev} /></StoreProvider></MemoryRouter>);
    expect(screen.getByText('CDMRI')).toBeInTheDocument();
    expect(screen.getByText(/Computational Diffusion MRI/)).toBeInTheDocument();
    expect(screen.getByText(/workshop/i)).toBeInTheDocument();
    expect(screen.getByText(/Adeanauer/)).toBeInTheDocument();
    expect(screen.getByText(/08:00/)).toBeInTheDocument();
  });
  it('is bookmarkable', () => {
    render(<MemoryRouter><StoreProvider><SatelliteCard event={ev} /></StoreProvider></MemoryRouter>);
    expect(screen.getByRole('button', { name: /bookmark/i })).toHaveAttribute('aria-pressed', 'false');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && npx vitest run test/satellite-ui.test.tsx`
Expected: FAIL

- [ ] **Step 3: 实现**

- `Satellite`：两个日期 tab（`2026-09-27` / `2026-10-01`）；两种视图切换——**列表**（按时间分组）与**房间网格**（行=房间，列=4 个时段）；按类型（workshop/challenge/tutorial）和主题筛选。
- `SatelliteCard`：缩写（大字）、全称、类型徽章、房间 + 楼层、时间段、收藏按钮。
- `SatelliteDetail`：全部字段 + 外部网站链接（`rel="noopener noreferrer"`）+ 联系人 + 加日历。
- 页面顶部一行说明：**各 workshop 内部的论文列表由各自主办方在官网发布，本站只收录活动级日程。**

- [ ] **Step 4: 运行确认通过**

Run: `cd web && npx vitest run`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src web/test/satellite-ui.test.tsx
git commit -m "feat(web): satellite events browsing by day, room and type"
```

---

## Task 11: 视觉打磨与深色模式

**Files:**
- Modify: `web/src/index.css`, `web/src/ui/*`, `web/index.html`

**Interfaces:** 无新接口，纯视觉。

- [ ] **Step 1: 定义设计 token**

在 `index.css` 用 Tailwind v4 的 `@theme` 定义色板、字阶、圆角、阴影。深色模式用 `@media (prefers-color-scheme: dark)`，并给 `:root[data-theme]` 留手动覆盖入口。给 `body` 显式背景色。

- [ ] **Step 2: 类型编码**

为 6 种类型分配语义色并全站统一：`oral` / `spotlight` / `poster` / `workshop` / `challenge` / `tutorial`。颜色只承担功能，不做装饰。**颜色不能是唯一区分手段**，每个徽章必须同时有文字。

- [ ] **Step 3: 排版**

元信息（时间、房间、展板号）用 `font-variant-numeric: tabular-nums` 对齐。标题用紧凑字距。系统字体栈优先。

- [ ] **Step 4: 动效**

只给收藏状态切换、页面切换、列表项进入加过渡。全部包在：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 5: 自检**

对照 SPEC §10.1 的禁止清单逐条确认：无大面积渐变、无玻璃拟态、无营销式 hero、无桌面 dashboard 布局。

- [ ] **Step 6: 提交**

```bash
git add web/src web/index.html
git commit -m "style(web): design tokens, type-coded palette, dark mode"
```

---

## Task 12: 离线与 PWA

**Files:**
- Create: `web/public/manifest.webmanifest`, `web/src/sw.ts`
- Modify: `web/vite.config.ts`, `web/index.html`

- [ ] **Step 1: 装插件**

```bash
cd web && npm install -D vite-plugin-pwa
```

- [ ] **Step 2: 配置**

在 `vite.config.ts` 加 `VitePWA({ registerType: 'autoUpdate', workbox: { globPatterns: ['**/*.{js,css,html,woff2}'], runtimeCaching: [{ urlPattern: /\/data\/program\.min\.json$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'miccai-program-v1' } }] } })`。

manifest：`name: "MICCAI Subscribe"`、`short_name: "MICCAI"`、`display: "standalone"`、`theme_color` 与 `background_color` 跟 `index.css` 的 token 一致。

**不实现 Web Push**（SPEC §15 非目标）。

- [ ] **Step 3: 验证离线**

`npm run build && npx vite preview`，Chrome DevTools → Network → Offline，刷新后确认：搜索可用、日程可见、详情页可开。

- [ ] **Step 4: 提交**

```bash
git add web
git commit -m "feat(web): offline-first service worker and PWA manifest"
```

---

## Task 13: 同步 Worker 与订阅 feed

**Files:**
- Create: `worker/wrangler.toml`, `worker/src/index.ts`, `worker/test/worker.test.ts`
- Modify: `web/src/routes/CalendarPage.tsx`（接上真实按钮）

**Interfaces:**
- Produces: `PUT /api/sync/:token`、`GET /api/sync/:token`、`DELETE /api/sync/:token`、`GET /cal/:token.ics`

- [ ] **Step 1: 写失败的测试**

`worker/test/worker.test.ts`（Vitest + `@cloudflare/vitest-pool-workers`，或用 miniflare）覆盖：

- `PUT` 合法 token 写入后 `GET` 能读回
- `GET /cal/<unknown>.ics` 返回 404 且 body 含 `invalid or has been revoked`
- `GET /cal/<token>.ics` 返回 `Content-Type: text/calendar; charset=utf-8`
- token 短于 32 字符一律 400
- 响应头含 `Cache-Control: private, no-store`
- `DELETE` 之后再 `GET` 返回 404

- [ ] **Step 2: 实现**

`worker/src/index.ts`：

```ts
export interface Env { SYNC: KVNamespace }

const TTL_UNTIL = Date.UTC(2026, 11, 31) / 1000;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** token 只以哈希形式落盘，明文永不写入 KV。 */
async function keyFor(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sync:${hex}`;
}

const validToken = (t: string) => /^[A-Za-z0-9_-]{32,64}$/.test(t);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const sync = url.pathname.match(/^\/api\/sync\/([^/]+)$/);
    const feed = url.pathname.match(/^\/cal\/([^/]+)\.ics$/);
    const token = sync?.[1] ?? feed?.[1];

    if (!token) return new Response('Not found', { status: 404, headers: NO_STORE });
    if (!validToken(token)) return new Response('Bad token', { status: 400, headers: NO_STORE });
    const key = await keyFor(token);

    if (feed) {
      const stored = await env.SYNC.get(key, 'json') as { icsText?: string } | null;
      if (!stored?.icsText) {
        return new Response('This calendar link is invalid or has been revoked.',
          { status: 404, headers: NO_STORE });
      }
      return new Response(stored.icsText, {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', ...NO_STORE },
      });
    }

    if (req.method === 'PUT') {
      const body = await req.text();
      if (body.length > 512 * 1024) return new Response('Too large', { status: 413, headers: NO_STORE });
      await env.SYNC.put(key, body, { expiration: TTL_UNTIL });
      return new Response(null, { status: 204, headers: NO_STORE });
    }
    if (req.method === 'GET') {
      const v = await env.SYNC.get(key);
      return v
        ? new Response(v, { headers: { 'Content-Type': 'application/json', ...NO_STORE } })
        : new Response('Not found', { status: 404, headers: NO_STORE });
    }
    if (req.method === 'DELETE') {
      await env.SYNC.delete(key);
      return new Response(null, { status: 204, headers: NO_STORE });
    }
    return new Response('Method not allowed', { status: 405, headers: NO_STORE });
  },
};
```

要点：

- token 由**客户端**用 `crypto.getRandomValues(new Uint8Array(20))` 生成（160 bit），**绝不用 `Math.random()`**。
- KV 键为 `sync:${sha256hex(token)}`，**存哈希不存明文**。值为 `{ bookmarks, followedAuthors, followedAffiliations, excluded, prefs, updatedAt }`，TTL 到 `2026-12-31`。
- `/cal/:token.ics` 读 KV，服务端不持有 program 数据，因此把**客户端已生成的 ICS 文本**一并存进 KV（`icsText` 字段），feed 直接回吐。这样 Worker 不需要解析会议数据，逻辑极小。客户端每次收藏变更后防抖 2 s 重新生成并 `PUT`。
- 对 `PUT` 限流：每 IP 每分钟 30 次。浏览行为不限流。
- 所有响应加 `Cache-Control: private, no-store`。

- [ ] **Step 3: 部署并验证**

```bash
cd worker && npx wrangler kv namespace create SYNC
npx wrangler deploy
```

用 curl 跑一遍上述 6 条断言。

- [ ] **Step 4: 前端接上**

`CalendarPage` 的「生成订阅链接」改为真实调用，展示链接 + 复制按钮 + 「撤销此链接」（调 `DELETE`）。刷新延迟警告文案保持不变。

- [ ] **Step 5: 提交**

```bash
git add worker web/src/routes/CalendarPage.tsx
git commit -m "feat(worker): KV-backed optional sync and ICS subscription feed"
```

---

## Task 14: 部署与发布前 QA

**Files:**
- Create: `.github/workflows/build-data.yml`, `docs/RUNBOOK.md`

- [ ] **Step 1: 部署到 Cloudflare Pages**

Pages 项目指向仓库，build command `cd web && npm ci && npm run build`，output directory `web/dist`。绑定 `miccaisubscribe.com`，确认 HTTPS 与 HSTS 生效。

- [ ] **Step 2: 每日数据刷新**

`.github/workflows/build-data.yml`：每天 05:00 UTC（07:00 CEST）跑 `python3 scripts/fetch.py && python3 scripts/build.py`；若 `data/processed/program.json` 有变更则开 PR 并把 `diff-report.md` 贴进 PR 描述。**不自动合并**——人工看过 diff 再合，因为官方改过一次 PDF 结构。

- [ ] **Step 3: 数据正确性人工验证（SPEC §14）**

- 随机抽 30 篇 poster，逐字比对官网 PDF 的标题、作者、展板号、session
- 18 个 oral/spotlight session 的时间与会场逐个核对
- 5 个 poster session 的时间逐个核对
- 随机抽 20 个 satellite events 与网格 PDF 比对
- 确认 `T-AM-098` 不出现在站内

- [ ] **Step 4: 真机 QA**

iPhone Safari、Android Chrome、macOS Safari、Chrome 桌面各跑一遍 SPEC §14 的 15 条验收标准。重点：320 px 无横向滚动；底部导航不被 home indicator 遮挡；断网后可浏览。

- [ ] **Step 5: 无障碍检查**

Lighthouse a11y ≥ 95。键盘可走完「搜索 → 收藏 → 日程 → 导出」全流程。VoiceOver 抽查收藏按钮播报状态。

- [ ] **Step 6: 性能验证**

Lighthouse 移动端 performance ≥ 90，LCP < 1.5 s，JS bundle gzip < 150 KB（`npx vite build --mode production` 后看产物大小）。

- [ ] **Step 7: 写 RUNBOOK**

`docs/RUNBOOK.md`：会期每日刷新数据的操作步骤、站点挂了怎么回滚（Pages 一键回滚到上一次部署）、Worker 出错怎么排查、KV 数据怎么导出。

- [ ] **Step 8: 提交**

```bash
git add .github docs/RUNBOOK.md
git commit -m "chore: deployment, daily data refresh workflow, runbook"
```

---

## 任务依赖与砍单顺序

```
Task 1 (数据) ──┬─ Task 2 (搜索) ─┐
                ├─ Task 3 (存储) ─┼─ Task 6 (外壳+搜索UI) ─ Task 7 (详情+关注)
                │                 │                          │
                └─ Task 4 (日程) ─┴──────────────────────────┴─ Task 8 (日程页)
                          │
                   Task 5 (ICS) ─────────────────────────────── Task 9 (日历页)
                                                                 │
Task 10 (satellite) · Task 11 (视觉) · Task 12 (离线) ───────────┤
                                                    Task 13 (Worker) ─ Task 14 (部署QA)
```

时间不够时**从后往前砍**：Task 13（云同步与订阅 feed）→ Task 7 的关注部分 → Task 10（satellite）。

**不可砍**：Task 1–6、Task 8、Task 9（搜索、收藏、日程、下载 .ics 是产品的全部意义）。
