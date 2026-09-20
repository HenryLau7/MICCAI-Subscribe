import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { BookmarkButton } from '../ui/BookmarkButton';
import { DownloadIcsButton } from '../ui/DownloadIcsButton';
import { ShareIcsButton } from '../ui/ShareIcsButton';
import { TypeBadge } from '../ui/TypeBadge';
import { googleCalendarUrl } from '../calendar/google';
import { formatDay, formatTime } from '../store/schedule';
import type { IcsEvent } from '../calendar/ics';
import type { SatelliteEvent } from '../data/types';

const VENUE = 'Strasbourg Convention Center, Strasbourg, France';

/** Mirrors calendar/build.ts's satellite-event branch, for exactly this one event. */
function toIcsEvent(event: SatelliteEvent): IcsEvent {
  return {
    uid: `${event.id}@miccaisubscribe.com`,
    start: event.start,
    end: event.end,
    summary: event.acronym ? `${event.acronym} (${event.type})` : event.name,
    description: [event.name, event.theme && `Theme: ${event.theme}`, event.url].filter(Boolean).join('\n'),
    location: `${event.room}${event.floor ? ` (floor ${event.floor})` : ''}, ${VENUE}`,
    url: event.url || undefined,
  };
}

/**
 * All published fields for one satellite event, plus a bookmark toggle and
 * calendar export. There is no per-talk data here by design — the official
 * program only publishes activity-level scheduling for satellite events, and
 * this app never invents what it wasn't given. Contact information isn't
 * part of the data model (SatelliteEvent has no such field), so none is
 * shown here rather than fabricated.
 */
export function SatelliteDetail() {
  const { program } = useProgram();
  const { id } = useParams<{ id: string }>();
  const event = id ? program.bySatelliteId.get(id) : undefined;

  if (!event) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Satellite event not found"
          description="No satellite event with this identifier is in the program."
          action={
            <Link to="/satellite" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Back to satellite events
            </Link>
          }
        />
      </div>
    );
  }

  const icsEvent = toIcsEvent(event);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-2">
        <TypeBadge type={event.type} className="w-fit" />
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-snug text-[var(--fg)]">
            {event.acronym && <span className="block">{event.acronym}</span>}
            <span className={event.acronym ? 'text-base font-normal text-[var(--fg-muted)]' : ''}>
              {event.name}
            </span>
          </h1>
          <BookmarkButton presentationId={event.id} />
        </div>
        {event.theme && <p className="text-sm text-[var(--fg-muted)]">Theme: {event.theme}</p>}
        <p className="text-sm text-[var(--fg-muted)]">
          {formatDay(event.start)} · {formatTime(event.start)}–{formatTime(event.end)} · {event.room}
          {event.floor ? ` (floor ${event.floor})` : ''}
        </p>
        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit min-h-11 items-center rounded-lg border border-[var(--accent)] px-4 text-sm font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Visit organizer website
          </a>
        )}
      </header>

      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-xs text-[var(--fg-muted)]">
        This site covers activity-level scheduling only. The internal paper list for this{' '}
        {event.type} is published by its organizers on their own website{event.url ? ', linked above' : ''} —
        not here.
      </p>

      <section aria-labelledby="satellite-calendar-heading" className="flex flex-col gap-2">
        <h2 id="satellite-calendar-heading" className="text-sm font-semibold text-[var(--fg)]">
          Add to your calendar
        </h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={googleCalendarUrl(icsEvent)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Google Calendar
          </a>
          <DownloadIcsButton
            events={[icsEvent]}
            filename={`${event.acronym || event.id}.ics`}
            calendarName={event.acronym ? `${event.acronym} — ${event.name}` : event.name}
          />
          <ShareIcsButton
            events={[icsEvent]}
            filename={`${event.acronym || event.id}.ics`}
            calendarName={event.acronym ? `${event.acronym} — ${event.name}` : event.name}
          />
        </div>
      </section>
    </div>
  );
}
