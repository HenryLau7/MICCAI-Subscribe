/**
 * The exactly-at-the-cap boundary for the result count.
 *
 * The page displays at most 50 results and appends "+" to mean "there are
 * more than these". It used to append the + whenever it held 50 rows, which
 * is also what a true total of exactly 50 looks like — so at that one value
 * it claimed hits that do not exist.
 *
 * This needs a fixture of exactly 50 hits. No real query has exactly 50, and
 * pinning one would break on the next daily data refresh, so `search` is
 * stubbed here and the real engine is exercised in SearchResults.test.tsx.
 * What is under test is the count-display logic, not the search.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreProvider } from '../src/store/StoreProvider';
import { decodeProgram } from '../src/data/decode';
import type { SearchResult } from '../src/search/engine';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);

vi.mock('../src/ui/ProgramContext', () => ({
  useProgram: () => ({ program, index: { program, papers: [], satellite: [] } }),
}));

// The component asks for one more than it displays; honour the limit so the
// stub behaves like the real engine rather than ignoring it.
const hits = vi.hoisted(() => ({ total: 0 }));
vi.mock('../src/search/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/search/engine')>();
  return {
    ...actual,
    search: (_i: unknown, _q: string, limit = 50): SearchResult[] =>
      Array.from({ length: Math.min(hits.total, limit) }, (_, n) => ({
        kind: 'paper' as const,
        paper: program.papers[n],
        score: 100 - n,
      })),
  };
});

import { SearchResults } from '../src/routes/SearchResults';

function renderWith(total: number) {
  hits.total = total;
  render(
    <MemoryRouter initialEntries={['/search?q=anything']}>
      <StoreProvider>
        <SearchResults />
      </StoreProvider>
    </MemoryRouter>,
  );
  return screen.getByRole('status');
}

describe('result count at the display cap', () => {
  it('says "50 results", not "50+", when the true total is exactly 50', () => {
    expect(renderWith(50)).toHaveTextContent(/^50 results for/);
  });

  it('says "50+ results" when the true total is 51', () => {
    expect(renderWith(51)).toHaveTextContent(/^50\+ results for/);
  });

  it('says "49 results" just below the cap', () => {
    expect(renderWith(49)).toHaveTextContent(/^49 results for/);
  });
});
