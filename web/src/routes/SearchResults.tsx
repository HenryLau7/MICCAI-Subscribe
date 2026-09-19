import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { search, type SearchIndex, type SearchResult } from '../search/engine';
import { SearchBox } from '../ui/SearchBox';
import { PaperCard } from '../ui/PaperCard';
import { SatelliteCard } from '../ui/SatelliteCard';
import { EmptyState } from '../ui/EmptyState';

const RESULT_LIMIT = 50;

function isPaperResult(r: SearchResult): r is Extract<SearchResult, { kind: 'paper' }> {
  return r.kind === 'paper';
}

function isSatelliteResult(r: SearchResult): r is Extract<SearchResult, { kind: 'satellite' }> {
  return r.kind === 'satellite';
}

function runSearch(index: SearchIndex, query: string): SearchResult[] {
  return query.trim() ? search(index, query, RESULT_LIMIT) : [];
}

export function SearchResults() {
  const { program, index } = useProgram();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  const results = useMemo(() => runSearch(index, query), [index, query]);
  const papers = results.filter(isPaperResult);
  const satellite = results.filter(isSatelliteResult);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-6">
      <h1 className="sr-only">Search results</h1>
      <SearchBox placeholder="Search title, author, board number…" />
      <p className="text-xs text-[var(--fg-muted)]">
        Matches are substrings, so short or common terms can be noisy. Try a full name or the board number
        (e.g. M-PM-001) to narrow it down.
      </p>

      {!query.trim() ? (
        <EmptyState
          title="Start typing to search"
          description="Search by paper title, author, institution, or board number."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title={`No results for “${query}”`}
          description="Check the spelling, try fewer words, or search by board number."
        />
      ) : (
        <>
          <p role="status" className="text-sm font-medium text-[var(--fg)]">
            {results.length}
            {results.length === RESULT_LIMIT ? '+' : ''} result{results.length === 1 ? '' : 's'} for &ldquo;
            {query}&rdquo;
          </p>

          {papers.length > 0 && (
            <section aria-labelledby="papers-heading" className="flex flex-col gap-3">
              <h2 id="papers-heading" className="text-sm font-semibold text-[var(--fg)]">
                Papers ({papers.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {papers.map((r) => (
                  <li key={r.paper.id}>
                    <PaperCard program={program} paper={r.paper} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {satellite.length > 0 && (
            <section aria-labelledby="satellite-heading" className="flex flex-col gap-3">
              <h2 id="satellite-heading" className="text-sm font-semibold text-[var(--fg)]">
                Satellite events ({satellite.length})
              </h2>
              <ul className="flex flex-col gap-3">
                {satellite.map((r) => (
                  <li key={r.event.id}>
                    <SatelliteCard event={r.event} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
