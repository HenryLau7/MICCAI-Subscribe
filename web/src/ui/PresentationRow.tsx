import { Link } from 'react-router-dom';
import type { Presentation, Program } from '../data/types';
import { formatTime, slotLabel } from '../store/schedule';
import { formatDayLabel } from '../store/conference';
import { BoardNumber } from './BoardNumber';
import { BookmarkButton } from './BookmarkButton';
import { TypeBadge } from './TypeBadge';

interface PresentationRowProps {
  program: Program;
  presentation: Presentation;
  /**
   * true (session context, e.g. SessionDetail): identify the row by paper —
   * title, presenters, board number.
   * false (paper context, e.g. PaperDetail): identify the row by session —
   * name, day, time, room.
   */
  showPaper: boolean;
}

/**
 * One presentation: kind, its position in the session (never a computed
 * clock time — per-talk times don't exist in the source), day/time, and a
 * bookmark toggle. Poster sessions never show a room — MICCAI doesn't
 * publish poster hall names, so we say so instead of guessing.
 */
export function PresentationRow({ program, presentation, showPaper }: PresentationRowProps) {
  const session = program.sessions.get(presentation.sessionId);
  const paper = program.byPaperId.get(presentation.paperId);
  if (!session || !paper) return null;

  const isPoster = session.kind === 'poster';

  return (
    <li className="flex items-center justify-between gap-3 rounded-[var(--radius-row)] bg-[var(--bg-subtle)] px-3 py-2.5">
      <div className="min-w-0">
        <TypeBadge type={presentation.kind} className="mb-1" />
        {showPaper ? (
          <>
            <p className="truncate text-sm font-medium text-[var(--fg)]">
              <Link
                to={`/paper/${paper.id}`}
                className="hover:text-[var(--accent)] focus-ring"
              >
                {paper.title}
              </Link>
            </p>
            <p className="truncate text-xs text-[var(--fg-muted)]">
              {(paper.presenters.length > 0 ? paper.presenters : paper.authors).join(', ')}
            </p>
            <BoardNumber id={paper.id} className="mt-1" />
          </>
        ) : (
          <p className="truncate text-sm font-medium text-[var(--fg)]">
            <Link
              to={`/session/${session.id}`}
              className="hover:text-[var(--accent)] focus-ring"
            >
              {session.name}
            </Link>
          </p>
        )}
        <p className="mt-1 text-xs text-[var(--fg-muted)]">
          {slotLabel(presentation) ? `${slotLabel(presentation)} · ` : ''}
          <span className="font-medium text-[var(--fg)]">
            {formatDayLabel(session.start)} {formatTime(session.start)}–{formatTime(session.end)}
          </span>
          {isPoster
            ? ' · hall not published — find the board number'
            : session.room
              ? ` · ${session.room}`
              : ''}
        </p>
      </div>
      <BookmarkButton presentationId={presentation.id} />
    </li>
  );
}
