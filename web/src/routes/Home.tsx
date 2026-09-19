import { Link } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { SearchBox } from '../ui/SearchBox';
import { formatDay } from '../store/schedule';
import type { Program } from '../data/types';

/** Earliest/latest session or satellite day, derived from real data — never Date(). */
function conferenceDayRange(program: Program): { first: string; last: string } | null {
  let first: string | null = null;
  let last: string | null = null;
  const consider = (iso: string) => {
    const day = formatDay(iso);
    if (!first || day < first) first = day;
    if (!last || day > last) last = day;
  };
  for (const s of program.sessions.values()) consider(s.start);
  for (const e of program.satellite) consider(e.start);
  return first && last ? { first, last } : null;
}

export function Home() {
  const { program } = useProgram();
  const range = conferenceDayRange(program);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          Unofficial companion
        </p>
        <h1 className="text-2xl font-semibold text-[var(--fg)]">MICCAI Subscribe</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {program.meta.conference} · {program.meta.venue}
        </p>
        {range && (
          <p className="text-sm text-[var(--fg-muted)]">
            {range.first === range.last ? range.first : `${range.first} – ${range.last}`}
          </p>
        )}
        <p className="text-xs text-[var(--fg-muted)]">Program revised {program.meta.sourceRevision}</p>
      </header>

      <section aria-label="Search">
        <SearchBox targetPath="/search" autoFocus placeholder="Search title, author, board number…" />
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          Try a paper title, an author&rsquo;s name, an institution, or a board number like M-PM-001.
        </p>
      </section>

      <section aria-labelledby="browse-heading" className="flex flex-col gap-3">
        <h2 id="browse-heading" className="text-sm font-semibold text-[var(--fg)]">
          Browse
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/schedule"
            className="rounded-xl border border-[var(--border)] p-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Your schedule
            <span className="mt-1 block text-xs font-normal text-[var(--fg-muted)]">
              Bookmarks and followed authors, aggregated
            </span>
          </Link>
          <Link
            to="/satellite"
            className="rounded-xl border border-[var(--border)] p-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Satellite events
            <span className="mt-1 block text-xs font-normal text-[var(--fg-muted)]">
              {program.satellite.length} workshops, challenges &amp; tutorials
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
