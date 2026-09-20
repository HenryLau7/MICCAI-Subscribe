import { Link } from 'react-router-dom';
import type { Paper, Program } from '../data/types';
import { formatTime } from '../store/schedule';
import { formatDayLabel } from '../store/conference';
import { BookmarkButton } from './BookmarkButton';
import { BoardNumber } from './BoardNumber';
import { TypeBadge } from './TypeBadge';

function AuthorLine({ paper }: { paper: Paper }) {
  const presenters = new Set(paper.presenters);
  return (
    <p className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">
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
 *
 * Depth is carried by fill, not by a second border: the per-presentation rows
 * sit on --bg-subtle inside the card's --bg-elevated rather than drawing their
 * own outline inside the card's, and take the smaller row radius. A border
 * inside a border at the same weight reads as a rendering mistake.
 */
export function PaperCard({ program, paper }: { program: Program; paper: Paper }) {
  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-base font-semibold leading-snug">
        <Link to={`/paper/${paper.id}`} className="hover:text-[var(--accent)] focus-ring">
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
      <BoardNumber id={paper.id} className="mt-2.5" />
      <ul className="mt-3 flex flex-col gap-2">
        {paper.presentationIds.map((pid) => {
          const presentation = program.byPresentationId.get(pid);
          const session = presentation ? program.sessions.get(presentation.sessionId) : undefined;
          if (!presentation || !session) return null;
          const isPoster = session.kind === 'poster';
          return (
            <li
              key={pid}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-row)] bg-[var(--bg-subtle)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <TypeBadge type={presentation.kind} />
                <p className="mt-1.5 truncate text-sm font-medium text-[var(--fg)]">{session.name}</p>
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  <span className="font-medium text-[var(--fg)]">
                    {formatDayLabel(session.start)} {formatTime(session.start)}–
                    {formatTime(session.end)}
                  </span>
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
