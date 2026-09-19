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

/** AND 语义：每个 token 都要中，有一个不中就整条淘汰（返回 0）。 */
function scoreAll(tokens: string[], score: (tok: string) => number): number {
  let total = 0;
  for (const tok of tokens) {
    const s = score(tok);
    if (s === 0) return 0;
    total += s;
  }
  return total;
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
    let total = scoreAll(tokens, (tok) => scorePaperToken(d, tok));
    if (total > 0) {
      // 整串出现在标题里给一次强加成，让完整标题查询排到最前
      if (d.title.includes(fold(query))) total += 400;
      out.push({ kind: 'paper', paper: d.paper, score: total });
    }
  }

  for (const d of index.satellite) {
    const total = scoreAll(tokens, (tok) => scoreSatelliteToken(d, tok));
    if (total > 0) out.push({ kind: 'satellite', event: d.event, score: total });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}
