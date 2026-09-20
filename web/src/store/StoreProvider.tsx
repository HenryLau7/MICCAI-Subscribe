import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultState, loadState, sanitize, saveState, STORAGE_KEY, type StoredState } from './storage';

interface StoreApi {
  state: StoredState;
  isBookmarked(id: string): boolean;
  toggleBookmark(id: string): void;
  isFollowingAuthor(slug: string): boolean;
  toggleFollowAuthor(slug: string): void;
  isFollowingAffiliation(key: string): boolean;
  toggleFollowAffiliation(key: string): void;
  isExcluded(id: string): boolean;
  toggleExcluded(id: string): void;
  setReminderMinutes(minutes: number): void;
  replaceState(next: StoredState): void;
}

const StoreContext = createContext<StoreApi | null>(null);

/** 不可变更新一个字符串集合字段：命中则移除，未命中则追加。 */
function toggleIn<K extends keyof StoredState>(
  s: StoredState,
  key: K,
  id: string,
): StoredState {
  const list = s[key] as string[];
  const has = list.includes(id);
  const next: StoredState = {
    ...s,
    [key]: has ? list.filter((x) => x !== id) : [...list, id],
  };
  return next;
}

export function StoreProvider(props: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(() => loadState());
  const current = useRef(state);
  const lastStored = useRef<string | null>(JSON.stringify(state));

  const readLatest = useCallback(() => {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (text !== lastStored.current) {
        const next = text === null ? defaultState() : sanitize(JSON.parse(text));
        if (next) current.current = next;
        lastStored.current = text;
      }
    } catch { /* Storage unavailable: keep in-memory edits. */ }
    return current.current;
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null)) {
        setState(readLatest());
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [readLatest]);

  const update = useCallback((change: (previous: StoredState) => StoredState) => {
    // Read and persist inside the action, before another action or delayed storage event.
    const next = change(readLatest());
    current.current = next;
    if (saveState(next)) lastStored.current = JSON.stringify(next);
    setState(next);
  }, [readLatest]);

  const toggleBookmark = useCallback((id: string) => {
    update((s) => toggleIn(s, 'bookmarks', id));
  }, [update]);

  const toggleFollowAuthor = useCallback((slug: string) => {
    update((s) => toggleIn(s, 'followedAuthors', slug));
  }, [update]);

  const toggleFollowAffiliation = useCallback((key: string) => {
    update((s) => toggleIn(s, 'followedAffiliations', key));
  }, [update]);

  const toggleExcluded = useCallback((id: string) => {
    update((s) => toggleIn(s, 'excluded', id));
  }, [update]);

  const setReminderMinutes = useCallback((minutes: number) => {
    update((s) => ({ ...s, prefs: { ...s.prefs, reminderMinutes: minutes } }));
  }, [update]);

  const replaceState = useCallback((next: StoredState) => {
    update(() => next);
  }, [update]);

  const value = useMemo<StoreApi>(
    () => ({
      state,
      isBookmarked: (id) => state.bookmarks.includes(id),
      toggleBookmark,
      isFollowingAuthor: (slug) => state.followedAuthors.includes(slug),
      toggleFollowAuthor,
      isFollowingAffiliation: (key) => state.followedAffiliations.includes(key),
      toggleFollowAffiliation,
      isExcluded: (id) => state.excluded.includes(id),
      toggleExcluded,
      setReminderMinutes,
      replaceState,
    }),
    [
      state,
      toggleBookmark,
      toggleFollowAuthor,
      toggleFollowAffiliation,
      toggleExcluded,
      setReminderMinutes,
      replaceState,
    ],
  );

  return <StoreContext.Provider value={value}>{props.children}</StoreContext.Provider>;
}

// eslint-disable-next-line react/only-export-components -- hook and provider share one small file by design (see task brief)
export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
