import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleItem } from '../store/schedule';
import { formatTime } from '../store/schedule';
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
 * text is wired to the exclude button via aria-describedby (Task 7's
 * FollowButton precedent), not left as a bare sibling.
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
        className="truncate text-sm font-medium text-[var(--fg)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {paper.title}
      </Link>
    );
    metaNode = (
      <span className="text-xs text-[var(--fg-muted)]">
        <Link
          to={`/session/${session.id}`}
          className="hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {session.name}
        </Link>
        {presentation.orderInSession > 0 ? ` · #${presentation.orderInSession} in session` : ''}
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
    <li className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--fg-muted)]">{timeRange}</p>
          <p className="truncate">{titleNode}</p>
          {metaNode && <p className="truncate">{metaNode}</p>}
          <p className="text-xs text-[var(--fg-muted)]">{locationText}</p>
        </div>
        <BookmarkButton presentationId={item.key} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={activityType} />
        <ConflictBadge conflicts={item.conflicts} />
        {isFollowDerived && (
          <span id={sourceLabelId} className="text-xs text-[var(--fg-muted)]">
            From your follow: {item.sourceLabel}
          </span>
        )}
      </div>

      {isFollowDerived && (
        <button
          type="button"
          onClick={() => toggleExcluded(item.key)}
          aria-label="Exclude from schedule"
          aria-describedby={sourceLabelId}
          className="inline-flex min-h-11 w-fit items-center rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Exclude from schedule
        </button>
      )}
    </li>
  );
}
