import { useId } from 'react';
import { useStore } from '../store/StoreProvider';

interface FollowButtonProps {
  kind: 'author' | 'affiliation';
  id: string;
  label: string;
  /**
   * Author identity here is just a normalized name string — no ORCID, no
   * disambiguation (5651 distinct names, and common romanized names collide).
   * `hint` is the follow target's affiliation/country: the only thing a user
   * has to judge "is this actually who/where I mean" before following.
   * Rendered next to the control whenever it's non-empty, never hidden behind
   * a tooltip, AND wired to the button via `aria-describedby` — a user who
   * tabs straight to the button (ordinary screen-reader/keyboard practice)
   * gets it read out, not just someone reading the page linearly. Callers
   * should supply a real, non-empty hint whenever there is any disambiguating
   * information to show (for authors, that includes the "no institution
   * recorded" case: say so, don't just render nothing).
   */
  hint: string;
}

/** Toggles following an author or affiliation. State and purpose are carried by
 *  aria-pressed/aria-label, not by the label text alone. */
export function FollowButton({ kind, id, label, hint }: FollowButtonProps) {
  const { isFollowingAuthor, isFollowingAffiliation, toggleFollowAuthor, toggleFollowAffiliation } = useStore();
  const on = kind === 'author' ? isFollowingAuthor(id) : isFollowingAffiliation(id);
  const toggle = () => (kind === 'author' ? toggleFollowAuthor(id) : toggleFollowAffiliation(id));
  // Unique per rendered instance (not derived from kind/id) so two FollowButtons on one
  // page never collide, even if they happen to share a kind+id in some future caller.
  const hintId = useId();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? `Unfollow ${label}` : `Follow ${label}`}
        aria-describedby={hint ? hintId : undefined}
        className={[
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors',
          'focus-ring',
          on
            ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'border-[var(--border)] text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
        ].join(' ')}
      >
        {on ? 'Following' : 'Follow'}
      </button>
      {hint && (
        <span id={hintId} className="text-xs text-[var(--fg-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}
