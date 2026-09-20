import { useState } from 'react';
import { useStore } from '../store/StoreProvider';

interface BookmarkButtonProps {
  /** A bookmark id: a presentation id (poster/oral) or a satellite event id. */
  presentationId: string;
  className?: string;
}

/**
 * A star toggle. The star glyph is decorative (aria-hidden) — state and
 * purpose are carried by aria-pressed and aria-label, never by the glyph alone.
 *
 * The one animation in the app: the star pops as it fills. It is deliberately
 * gated on a user-driven turn-*on* rather than on `on` itself, so opening a
 * page that already has twenty bookmarks does not set twenty stars animating
 * at once — motion here reports a change the user just made, and nothing
 * else. `prefers-reduced-motion` collapses it globally (index.css).
 *
 * The replay is driven by remounting the glyph (`key={pops}`) rather than by
 * adding and then clearing a class on an `onAnimationEnd` handler. A CSS
 * animation only restarts when the element is new or the class is newly
 * applied, so a class that is cleared asynchronously has to land before the
 * next click or the second pop silently does not play. A key change cannot
 * race: every turn-on mounts a fresh node, which is also the only form of
 * this that is observable from a test.
 */
export function BookmarkButton({ presentationId, className = '' }: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useStore();
  const on = isBookmarked(presentationId);
  const [pops, setPops] = useState(0);

  const handleClick = () => {
    if (!on) setPops((n) => n + 1);
    toggleBookmark(presentationId);
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove bookmark' : 'Bookmark'}
      onClick={handleClick}
      className={[
        'focus-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border text-xl leading-none transition-colors',
        on
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
        className,
      ].join(' ')}
    >
      <span
        key={pops}
        aria-hidden="true"
        className={
          pops > 0 ? 'inline-block animate-[bookmark-pop_220ms_ease-out]' : 'inline-block'
        }
      >
        {on ? '★' : '☆'}
      </span>
    </button>
  );
}
