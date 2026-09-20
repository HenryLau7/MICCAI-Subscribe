import { Link } from 'react-router-dom';
import type { SatelliteEvent } from '../data/types';
import { formatTime } from '../store/schedule';
import { formatDayLabel } from '../store/conference';
import { BookmarkButton } from './BookmarkButton';
import { TypeBadge } from './TypeBadge';

/**
 * The one satellite-event summary card in the app — used by search results,
 * the /satellite list view, and its room grid. Do not fork a second
 * implementation; extend this one.
 *
 * Acronym and name are separate text nodes (not one interpolated string) so
 * each is independently findable by exact text, the way PaperCard's title
 * link is.
 */
export function SatelliteCard({ event }: { event: SatelliteEvent }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <TypeBadge type={event.type} />
          <h3 className="mt-1.5 leading-snug">
            <Link to={`/satellite/${event.id}`} className="hover:text-[var(--accent)] focus-ring">
              {event.acronym && (
                <span className="block text-base font-bold text-[var(--fg)]">{event.acronym}</span>
              )}
              <span
                className={
                  event.acronym
                    ? 'text-sm leading-snug text-[var(--fg-muted)]'
                    : 'text-base font-semibold text-[var(--fg)]'
                }
              >
                {event.name}
              </span>
            </Link>
          </h3>
        </div>
        <BookmarkButton presentationId={event.id} />
      </div>
      <p className="mt-2.5 text-xs text-[var(--fg-muted)]">
        <span className="font-medium text-[var(--fg)]">
          {formatDayLabel(event.start)} {formatTime(event.start)}–{formatTime(event.end)}
        </span>
        {' · '}
        {event.room}
        {event.floor ? ` (${event.floor})` : ''}
      </p>
    </article>
  );
}
