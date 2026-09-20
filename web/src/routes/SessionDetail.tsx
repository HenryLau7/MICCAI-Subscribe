import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { PresentationRow } from '../ui/PresentationRow';
import { TypeBadge } from '../ui/TypeBadge';
import { bySlot, formatDay, formatTime } from '../store/schedule';

export function SessionDetail() {
  const { program } = useProgram();
  const { id } = useParams<{ id: string }>();
  const session = id ? program.sessions.get(id) : undefined;

  if (!session) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Session not found"
          description="No session with this identifier is in the program."
          action={
            <Link to="/search" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Back to search
            </Link>
          }
        />
      </div>
    );
  }

  const isPoster = session.kind === 'poster';
  const presentations = program.presentations
    .filter((pr) => pr.sessionId === session.id)
    .sort(bySlot);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-2">
        <TypeBadge type={session.kind} className="w-fit" />
        <h1 className="text-xl font-semibold leading-snug text-[var(--fg)]">{session.name}</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {formatDay(session.start)} · {formatTime(session.start)}–{formatTime(session.end)}
          {isPoster ? ' · hall not published — find the board number' : session.room ? ` · ${session.room}` : ''}
        </p>
        {session.chairs.length > 0 && (
          <p className="text-sm text-[var(--fg-muted)]">Chairs: {session.chairs.join(' · ')}</p>
        )}
      </header>

      <section aria-labelledby="presentations-heading" className="flex flex-col gap-3">
        <h2 id="presentations-heading" className="text-sm font-semibold text-[var(--fg)]">
          Presentations ({presentations.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {presentations.map((pr) => (
            <PresentationRow key={pr.id} program={program} presentation={pr} showPaper={true} />
          ))}
        </ul>
      </section>
    </div>
  );
}
