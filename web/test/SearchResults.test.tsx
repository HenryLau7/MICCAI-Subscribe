import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchResults } from '../src/routes/SearchResults';
import { StoreProvider } from '../src/store/StoreProvider';
import { decodeProgram } from '../src/data/decode';
import { buildSearchIndex, search } from '../src/search/engine';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);
const index = buildSearchIndex(program);

// SearchResults gets { program, index } from ProgramContext; stub that boundary with real
// decoded data so search() behaviour is genuine, without going through the network loader.
vi.mock('../src/ui/ProgramContext', () => ({
  useProgram: () => ({ program, index }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <SearchResults />
      </StoreProvider>
    </MemoryRouter>,
  );
}

describe('SearchResults', () => {
  beforeEach(() => localStorage.clear());

  it('shows a result count for a query with hits', () => {
    renderAt('/search?q=M-PM-001');

    // Board-number lookup is a deterministic single hit — singular phrasing included.
    expect(screen.getByRole('status')).toHaveTextContent('1 result for “M-PM-001”');
    expect(screen.getByText('Papers (1)')).toBeInTheDocument();
  });

  it('shows the empty state, not a bare "0", when the query has no hits', () => {
    renderAt('/search?q=zzzznotarealquerystring');

    expect(screen.getByText(/No results for/i)).toBeInTheDocument();
    expect(screen.getByText(/zzzznotarealquerystring/)).toBeInTheDocument();
    // The "Papers (N)" / result-count grouping only renders on the non-empty branch —
    // a real result count and "no results" must never both be on screen at once.
    expect(screen.queryByText(/^Papers \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Satellite events \(/)).not.toBeInTheDocument();
  });

  it('treats an absent ?q= as "no query yet", distinct from zero results', () => {
    renderAt('/search');

    expect(screen.getByText(/Enter a search term/i)).toBeInTheDocument();
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Papers \(/)).not.toBeInTheDocument();
  });

  it('treats a blank ?q= the same as absent — "no query yet", not zero results', () => {
    renderAt('/search?q=');

    expect(screen.getByText(/Enter a search term/i)).toBeInTheDocument();
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
  });
});

describe('the "50+" result count does not overclaim', () => {
  // The page caps display at 50. It used to print "50+" whenever it held 50
  // rows — including when 50 was the true total — so it claimed hits that did
  // not exist. It now fetches one extra hit purely to tell the two apart.
  //
  // These two exercise the REAL engine, but neither one alone catches the bug:
  // both also pass against the pre-fix code, because the overclaim only shows
  // at a true total of exactly 50 and no real query has exactly 50 hits (a
  // fixture pinned to one would break on the next daily data refresh). The
  // boundary itself is covered, red-green, in search-count-boundary.test.tsx
  // with a stubbed engine. These guard that the real engine still feeds the
  // count correctly on either side of it.
  it('shows the + when there really are more than 50', () => {
    renderAt('/search?q=segmentation');   // 354 hits
    expect(screen.getByRole('status')).toHaveTextContent(/^50\+ results for/);

    // The extra hit is fetched to count with, never to display: the 51st
    // result must not appear on the page.
    const hits = search(index, 'segmentation', 51);
    expect(hits).toHaveLength(51);
    const fiftyFirst = hits[50];
    const title = fiftyFirst.kind === 'paper' ? fiftyFirst.paper.title : fiftyFirst.event.name;
    expect(screen.queryByText(title)).toBeNull();
  });

  it('shows a bare count when the total is under the cap', () => {
    renderAt('/search?q=federated');      // 13 hits
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^13 results for/);
    expect(status).not.toHaveTextContent('+');
  });
});
