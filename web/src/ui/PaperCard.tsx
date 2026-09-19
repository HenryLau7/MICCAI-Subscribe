import { Link } from 'react-router-dom';
import type { Paper, Program } from '../data/types';
import { formatDay, formatTime } from '../store/schedule';
import { BookmarkButton } from './BookmarkButton';

function AuthorLine({ paper }: { paper: Paper }) {
  const presenters = new Set(paper.presenters);
  return (
    <p className="text-sm text-[var(--fg-muted)]">
      {paper.authors.map((name, i) => (
        <span key={`${name}-${i}`}>
          {presenters.has(name) ? (
            <strong className="font-semibold text-[var(--fg)]">{name}</strong>
          ) : (
            name
          )}
          {i < paper.authors.length - 1 ? ', ' : ''}
        </span>
      ))}
    </p>
  );
}

/**
 * Enough to decide without opening the paper: title, authors (presenter bold),
 * affiliation, board number, and every session it appears in with a bookmark
 * toggle per presentation. Poster sessions never show a room — the official
 * program doesn't publish poster hall names, so we say so instead of guessing.
 */
export function PaperCard({ program, paper }: { program: Program; paper: Paper }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
      <h3 className="text-base font-semibold leading-snug">
        <Link
          to={`/paper/${paper.id}`}
          className="hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {paper.title}
        </Link>
      </h3>
      <AuthorLine paper={paper} />
      {paper.affiliation && (
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          {paper.affiliation}
          {paper.country ? ` · ${paper.country}` : ''}
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--fg-muted)]">
        Board <span className="font-mono font-semibold text-[var(--fg)]">{paper.id}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {paper.presentationIds.map((pid) => {
          const presentation = program.byPresentationId.get(pid);
          const session = presentation ? program.sessions.get(presentation.sessionId) : undefined;
          if (!presentation || !session) return null;
          const isPoster = session.kind === 'poster';
          return (
            <li
              key={pid}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--fg)]">{session.name}</p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {formatDay(session.start)} · {formatTime(session.start)}–{formatTime(session.end)}
                  {isPoster
                    ? ' · hall not published — find the board number'
                    : session.room
                      ? ` · ${session.room}`
                      : ''}
                </p>
              </div>
              <BookmarkButton presentationId={pid} />
            </li>
          );
        })}
      </ul>
    </article>
  );
}
