import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchResults } from '../src/routes/SearchResults';
import { StoreProvider } from '../src/store/StoreProvider';
import { decodeProgram } from '../src/data/decode';
import { buildSearchIndex } from '../src/search/engine';
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

    expect(screen.getByText(/Start typing to search/i)).toBeInTheDocument();
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Papers \(/)).not.toBeInTheDocument();
  });

  it('treats a blank ?q= the same as absent — "no query yet", not zero results', () => {
    renderAt('/search?q=');

    expect(screen.getByText(/Start typing to search/i)).toBeInTheDocument();
    expect(screen.queryByText(/No results for/i)).not.toBeInTheDocument();
  });
});
