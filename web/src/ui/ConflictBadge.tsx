import type { Conflict, ConflictLevel } from '../store/schedule';

// hard beats soft beats same-poster-session; when several conflicts apply to
// one item we only ever show the worst one.
const SEVERITY: Record<ConflictLevel, number> = { hard: 3, soft: 2, 'same-poster-session': 1 };

const TEXT: Record<ConflictLevel, string> = {
  hard: 'Time conflict',
  soft: 'Partial overlap',
  // Never the word "conflict" here: five bookmarked posters in one two-hour
  // session are five easy walks between boards, not a scheduling problem —
  // calling that a conflict trains users to ignore the badge.
  'same-poster-session': 'Same poster session',
};

const STYLE: Record<ConflictLevel, string> = {
  hard: 'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
  soft: 'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
  'same-poster-session': 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]',
};

function mostSevere(conflicts: Conflict[]): ConflictLevel | null {
  if (conflicts.length === 0) return null;
  return conflicts.reduce<ConflictLevel>(
    (worst, c) => (SEVERITY[c.level] > SEVERITY[worst] ? c.level : worst),
    conflicts[0].level,
  );
}

/**
 * Renders nothing when there is no conflict — an item with a clean schedule
 * gets no badge at all, not an empty or "OK" one. When several conflicts
 * apply, shows only the most severe: hard (red) > soft (amber) >
 * same-poster-session (neutral, explicitly not framed as a warning).
 */
export function ConflictBadge({ conflicts }: { conflicts: Conflict[] }) {
  const level = mostSevere(conflicts);
  if (!level) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLE[level]}`}
    >
      {TEXT[level]}
    </span>
  );
}
