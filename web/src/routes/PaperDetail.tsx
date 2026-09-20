import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { PresentationRow } from '../ui/PresentationRow';
import { buildCalendar } from '../calendar/ics';
import { googleCalendarUrl } from '../calendar/google';
import { slugifyName } from '../data/decode';
import type { IcsEvent } from '../calendar/ics';
import type { Paper, Presentation, Program } from '../data/types';

const VENUE = 'Strasbourg Convention Center, Strasbourg, France';
const KIND_LABEL: Record<Presentation['kind'], string> = { poster: 'Poster', oral: 'Oral', spotlight: 'Spotlight' };

/** One VEVENT per presentation of this paper — never a computed per-talk time,
 *  just the session window, per the global no-fabrication rule. */
function toIcsEvent(program: Program, paper: Paper, presentation: Presentation): IcsEvent | null {
  const session = program.sessions.get(presentation.sessionId);
  if (!session) return null;
  return {
    uid: `${presentation.id}@miccaisubscribe.com`,
    start: session.start,
    end: session.end,
    summary: `${KIND_LABEL[presentation.kind]}: ${paper.title}`,
    description: [paper.title, paper.presenters.join(' & '), paper.affiliation, session.name]
      .filter(Boolean)
      .join('\n'),
    location: session.room ? `${session.room}, ${VENUE}` : VENUE,
  };
}

function downloadIcs(events: IcsEvent[], paper: Paper): void {
  const ics = buildCalendar(events, { prodId: '-//MICCAI Subscribe//EN', name: paper.title });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${paper.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function AuthorList({ paper }: { paper: Paper }) {
  const presenters = new Set(paper.presenters);
  return (
    <p className="text-sm text-[var(--fg-muted)]">
      {paper.authors.map((name, i) => {
        const slug = slugifyName(name);
        const link = (
          <Link
            to={`/author/${slug}`}
            className={[
              'hover:text-[var(--accent)] focus-ring',
              presenters.has(name) ? 'font-semibold text-[var(--fg)]' : '',
            ].join(' ')}
          >
            {name}
          </Link>
        );
        return (
          <span key={`${name}-${i}`}>
            {slug ? link : name}
            {i < paper.authors.length - 1 ? ', ' : ''}
          </span>
        );
      })}
    </p>
  );
}

export function PaperDetail() {
  const { program } = useProgram();
  const { id } = useParams<{ id: string }>();
  const paper = id ? program.byPaperId.get(id) : undefined;

  if (!paper) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Paper not found"
          description="This board number isn't in the program."
          action={
            <Link to="/search" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Back to search
            </Link>
          }
        />
      </div>
    );
  }

  const presentations = paper.presentationIds
    .map((pid) => program.byPresentationId.get(pid))
    .filter((pr): pr is Presentation => !!pr);
  const events = presentations
    .map((pr) => toIcsEvent(program, paper, pr))
    .filter((e): e is IcsEvent => !!e);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold leading-snug text-[var(--fg)]">{paper.title}</h1>
        <AuthorList paper={paper} />
        {paper.affiliation && (
          <p className="text-sm text-[var(--fg-muted)]">
            {paper.affiliationKey ? (
              <Link
                to={`/affiliation/${paper.affiliationKey}`}
                className="hover:text-[var(--accent)] focus-ring"
              >
                {paper.affiliation}
              </Link>
            ) : (
              paper.affiliation
            )}
            {paper.country ? ` · ${paper.country}` : ''}
          </p>
        )}
        <p className="text-xs text-[var(--fg-muted)]">
          Board <span className="font-mono font-semibold text-[var(--fg)]">{paper.id}</span>
        </p>
      </header>

      <section aria-labelledby="presentations-heading" className="flex flex-col gap-3">
        <h2 id="presentations-heading" className="text-sm font-semibold text-[var(--fg)]">
          Presentations
        </h2>
        <ul className="flex flex-col gap-2">
          {presentations.map((pr) => (
            <PresentationRow key={pr.id} program={program} presentation={pr} showPaper={false} />
          ))}
        </ul>
      </section>

      {events.length > 0 && (
        <section aria-labelledby="calendar-heading" className="flex flex-col gap-2">
          <h2 id="calendar-heading" className="text-sm font-semibold text-[var(--fg)]">
            Add to your calendar
          </h2>
          <div className="flex flex-wrap gap-2">
            {events.map((event) => (
              <a
                key={event.uid}
                href={googleCalendarUrl(event)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-ring"
              >
                Google Calendar: {event.summary}
              </a>
            ))}
            <button
              type="button"
              onClick={() => downloadIcs(events, paper)}
              className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-ring"
            >
              Download .ics
            </button>
          </div>
          <p className="text-xs text-[var(--fg-muted)]">
            Exact per-talk times aren&rsquo;t published by MICCAI — events cover the whole session window.
          </p>
        </section>
      )}
    </div>
  );
}
