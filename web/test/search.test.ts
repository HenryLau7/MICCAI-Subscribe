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
  it('applies AND semantics to satellite events too', () => {
    expect(search(index, 'STACOM zzzznotaword', 20)).toHaveLength(0);
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
