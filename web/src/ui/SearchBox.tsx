import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SearchBoxProps {
  /** Where a committed query should navigate to. Defaults to the current path
   *  (so on /search it just rewrites ?q= in place; from Home it jumps to /search). */
  targetPath?: string;
  autoFocus?: boolean;
  placeholder?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;

/** Controlled search input. Debounces 300ms before writing `?q=` to the URL. */
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const dest = targetPath ?? location.pathname;
      const qs = next.trim() ? `?q=${encodeURIComponent(next)}` : '';
      navigate(`${dest}${qs}`, { replace: dest === location.pathname });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="w-full">
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
        placeholder={placeholder ?? 'Search title, author, board number…'}
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-base text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      />
    </div>
  );
}
