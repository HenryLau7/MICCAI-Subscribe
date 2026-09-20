import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { useStore } from '../store/StoreProvider';
import { SearchBox } from '../ui/SearchBox';
import {
  conferenceDays,
  conferenceState,
  formatDayLabel,
  formatDayRange,
  todayInParis,
  type ConferenceState,
} from '../store/conference';

const count = (n: number): string => n.toLocaleString('en-US');

/**
 * The conference's own clock, as the first thing on the screen.
 *
 * A home screen for a conference companion has one honest hero: where the
 * conference is right now. During it, that is a day number and a way into
 * today — the single most likely reason someone opened the app standing in a
 * corridor. Outside it, a countdown or a closing note, which is a statement
 * of fact rather than a call to act, so it is not a link and does not pretend
 * to be one.
 */
function ConferenceStatus({ state }: { state: ConferenceState }) {
  if (state.phase === 'during') {
    return (
      <Link
        to="/schedule"
        className="focus-ring flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3.5 transition-colors hover:bg-[var(--accent)]/15"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold leading-none text-[var(--accent)]">
            Day {state.dayNumber} of {state.totalDays}
          </span>
          <span className="text-sm text-[var(--fg-muted)]">What you have on today</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-[var(--fg-muted)]">
          {formatDayLabel(state.today)}
        </span>
      </Link>
    );
  }

  const detail =
    state.phase === 'before'
      ? state.daysUntil === 1
        ? 'Starts tomorrow'
        : `Starts in ${state.daysUntil} days`
      : 'This program has finished';

  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 shadow-[var(--shadow-card)]">
      <span className="text-lg font-semibold leading-none text-[var(--fg)]">
        {formatDayRange(state.first, state.last)}
      </span>
      <span className="shrink-0 text-sm text-[var(--fg-muted)]">{detail}</span>
    </div>
  );
}

function BrowseCard({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="focus-ring flex flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)]"
    >
      <span className="text-sm font-semibold text-[var(--fg)]">{title}</span>
      <span className="text-xs text-[var(--fg-muted)]">{detail}</span>
    </Link>
  );
}

export function Home() {
  const { program } = useProgram();
  const { state: stored } = useStore();
  const status = useMemo(
    () => conferenceState(conferenceDays(program), todayInParis()),
    [program],
  );

  // A boolean, not a count. The schedule also gathers follow-derived items,
  // so any number shown here would have to re-run buildSchedule — cost on the
  // one route that owns first paint — or else disagree with the day tabs.
  const hasSaved =
    stored.bookmarks.length > 0 ||
    stored.followedAuthors.length > 0 ||
    stored.followedAffiliations.length > 0;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-7 px-4 pb-16 pt-9">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-none text-[var(--fg)]">
          MICCAI Subscribe
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">
          An unofficial companion to the {program.meta.conference} program.
        </p>
      </header>

      {status && <ConferenceStatus state={status} />}

      {/* The form itself carries role="search", so this wrapper stays a plain
          container — an aria-label here would nest two search landmarks. */}
      <section className="flex flex-col gap-2">
        <SearchBox targetPath="/search" autoFocus placeholder="Search the program" />
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
          {count(program.papers.length)} papers and {count(program.satellite.length)} satellite events.
          Try a title, an author&rsquo;s name, an institution, or a board number like M-PM-001.
        </p>
      </section>

      <section aria-labelledby="browse-heading" className="flex flex-col gap-3">
        <h2 id="browse-heading" className="text-sm font-semibold text-[var(--fg)]">
          Browse
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BrowseCard
            to="/schedule"
            title="Your schedule"
            detail={hasSaved ? 'Bookmarks and follows, by day' : 'Nothing saved yet'}
          />
          <BrowseCard
            to="/satellite"
            title="Satellite events"
            detail={`${program.satellite.length} workshops, challenges & tutorials`}
          />
        </div>
      </section>

      <p className="text-xs text-[var(--fg-muted)]">{program.meta.venue}</p>
    </div>
  );
}
