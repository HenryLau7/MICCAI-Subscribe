import { Link } from 'react-router-dom';
import type { SatelliteEvent } from '../data/types';
import { formatDay, formatTime } from '../store/schedule';
import { BookmarkButton } from './BookmarkButton';

const TYPE_LABEL: Record<SatelliteEvent['type'], string> = {
  workshop: 'Workshop',
  challenge: 'Challenge',
  tutorial: 'Tutorial',
};

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
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {TYPE_LABEL[event.type] ?? event.type}
          </p>
          <h3 className="leading-snug">
            <Link
              to={`/satellite/${event.id}`}
              className="hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {event.acronym && (
                <span className="block text-base font-bold text-[var(--fg)]">{event.acronym}</span>
              )}
              <span className={event.acronym ? 'text-sm text-[var(--fg-muted)]' : 'text-base font-semibold text-[var(--fg)]'}>
                {event.name}
              </span>
            </Link>
          </h3>
        </div>
        <BookmarkButton presentationId={event.id} />
      </div>
      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        {formatDay(event.start)} · {formatTime(event.start)}–{formatTime(event.end)} · {event.room}
        {event.floor ? ` (${event.floor})` : ''}
      </p>
    </article>
  );
}
