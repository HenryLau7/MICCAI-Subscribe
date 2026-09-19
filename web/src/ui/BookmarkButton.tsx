import { useStore } from '../store/StoreProvider';

interface BookmarkButtonProps {
  /** A bookmark id: a presentation id (poster/oral) or a satellite event id. */
  presentationId: string;
  className?: string;
}

/**
 * A star toggle. The star glyph is decorative (aria-hidden) — state and
 * purpose are carried by aria-pressed and aria-label, never by the glyph alone.
 */
export function BookmarkButton({ presentationId, className = '' }: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useStore();
  const on = isBookmarked(presentationId);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove bookmark' : 'Bookmark'}
      onClick={() => toggleBookmark(presentationId)}
      className={[
        'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border text-xl leading-none transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        on
          ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}
