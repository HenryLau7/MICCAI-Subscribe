import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SearchBoxProps {
  /** Where a committed query should navigate to. Defaults to the current path
   *  (so on /search it just rewrites ?q= in place; from Home it jumps to /search). */
  targetPath?: string;
  autoFocus?: boolean;
  placeholder?: string;
  id?: string;
}

/**
 * Controlled search input with an explicit submit.
 *
 * Typing is deliberately inert: the query reaches the URL only when the form
 * is submitted, by the Search button or the phone keyboard's Search key. An
 * earlier version committed on a 300 ms debounce, which meant typing on Home
 * navigated out from under you mid-word.
 */
export function SearchBox({ targetPath, autoFocus, placeholder, id = 'search' }: SearchBoxProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const urlQuery = new URLSearchParams(location.search).get('q') ?? '';
  const [value, setValue] = useState(urlQuery);
  // Tracks the URL query this input's local `value` was last synced to. When the
  // URL changes from outside this input (e.g. browser back/forward), resync
  // during render — React's documented pattern for adjusting state to match a
  // changed prop — instead of an effect, which would cost an extra commit.
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setValue(urlQuery);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setValue(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const dest = targetPath ?? location.pathname;
    const qs = value.trim() ? `?q=${encodeURIComponent(value)}` : '';
    navigate(`${dest}${qs}`, { replace: dest === location.pathname });
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full gap-2">
      <label htmlFor={id} className="sr-only">
        Search papers, authors, or satellite events
      </label>
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? 'Search the program'}
        className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-base text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus-ring"
      />
      <button
        type="submit"
        className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90 focus-ring"
      >
        Search
      </button>
    </form>
  );
}
