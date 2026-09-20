import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleItem } from '../store/schedule';
import { formatTime, slotLabel } from '../store/schedule';
import { useStore } from '../store/StoreProvider';
import { BookmarkButton } from './BookmarkButton';
import { ConflictBadge } from './ConflictBadge';
import { TypeBadge, type ActivityType } from './TypeBadge';

/**
 * One row in the day's schedule. What it shows depends on the item's shape:
 * a presentation (title, session, kind, board number or room) or a satellite
 * event (name, type, room/floor). Poster sessions never claim a room — the
 * hall isn't published — and per-talk clock times don't exist, so only
 * orderInSession is shown, never a computed time.
 *
 * The trailing control depends on `source`, per the collect() rule in
 * schedule.ts: an explicit bookmark always wins as the source, so a
 * follow-derived row (source === 'author' | 'affiliation') is, by
 * construction, never also in state.bookmarks. Its only removal path is
 * `toggleExcluded` — `toggleExcluded` is a deliberate no-op on bookmarked
 * items, so an "exclude" control must never appear on a bookmarked row (it
 * would look broken, doing nothing on click). The "from your follow: X"
 * text is wired to the exclude button via aria-describedby, the same way
 * FollowButton.tsx wires its disambiguating hint, not left as a bare sibling.
 */
export function ScheduleItemRow({ item }: { item: ScheduleItem }) {
  const { toggleExcluded } = useStore();
  const isFollowDerived = item.source === 'author' || item.source === 'affiliation';
  // Unique per rendered instance, mirroring FollowButton's hintId — several
  // rows on one page must never collide.
  const sourceLabelId = useId();

  const timeRange = `${formatTime(item.start)}–${formatTime(item.end)}`;

  let titleNode: ReactNode;
  let metaNode: ReactNode;
  let locationText: string;
  let activityType: ActivityType;

  if (item.satellite) {
    const sat = item.satellite;
    activityType = sat.type;
    titleNode = (
      <span className="truncate text-sm font-medium text-[var(--fg)]">
        {sat.name} ({sat.acronym})
      </span>
    );
    metaNode = null;
    locationText = sat.room ? `${sat.room}${sat.floor ? `, ${sat.floor}` : ''}` : 'Location not published';
  } else if (item.presentation && item.paper && item.session) {
    const { presentation, paper, session } = item;
    const isPoster = session.kind === 'poster';
    activityType = presentation.kind;
    titleNode = (
      <Link
        to={`/paper/${paper.id}`}
        className="truncate text-sm font-medium text-[var(--fg)] hover:text-[var(--accent)] focus-ring"
      >
        {paper.title}
      </Link>
    );
    metaNode = (
      <span className="text-xs text-[var(--fg-muted)]">
        <Link
          to={`/session/${session.id}`}
          className="hover:text-[var(--accent)] focus-ring"
        >
          {session.name}
        </Link>
        {slotLabel(presentation) ? ` · ${slotLabel(presentation)}` : ''}
      </span>
    );
    locationText = isPoster
      ? `Board ${paper.id} · hall not published`
      : session.room
        ? session.room
        : 'Room not published';
  } else {
    // Defensive: buildSchedule always sets either satellite or
    // presentation+paper+session, so this shouldn't be reachable.
    return null;
  }

  return (
    <li className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 shadow-[var(--shadow-card)]">
      {/* When, and what kind — the two things you scan a day for. The time
          leads at full contrast: in a list of a day's commitments it is the
          key you read first and the one you act on. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[var(--fg)]">{timeRange}</span>
        <TypeBadge type={activityType} />
        <ConflictBadge conflicts={item.conflicts} />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate">{titleNode}</p>
          {metaNode && <p className="mt-0.5 truncate">{metaNode}</p>}
          <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{locationText}</p>
        </div>
        <BookmarkButton presentationId={item.key} />
      </div>

      {isFollowDerived && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2.5">
          <span id={sourceLabelId} className="text-xs text-[var(--fg-muted)]">
            From your follow: {item.sourceLabel}
          </span>
          <button
            type="button"
            onClick={() => toggleExcluded(item.key)}
            aria-label="Exclude from schedule"
            aria-describedby={sourceLabelId}
            className="focus-ring ml-auto inline-flex min-h-11 items-center rounded-[var(--radius-row)] border border-[var(--border)] px-3 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Exclude from schedule
          </button>
        </div>
      )}
    </li>
  );
}
