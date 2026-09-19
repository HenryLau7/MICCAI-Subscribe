import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadState, saveState, type StoredState } from './storage';

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

  const toggleBookmark = useCallback((id: string) => {
    setState((s) => {
      const next = toggleIn(s, 'bookmarks', id);
      saveState(next);
      return next;
    });
  }, []);

  const toggleFollowAuthor = useCallback((slug: string) => {
    setState((s) => {
      const next = toggleIn(s, 'followedAuthors', slug);
      saveState(next);
      return next;
    });
  }, []);

  const toggleFollowAffiliation = useCallback((key: string) => {
    setState((s) => {
      const next = toggleIn(s, 'followedAffiliations', key);
      saveState(next);
      return next;
    });
  }, []);

  const toggleExcluded = useCallback((id: string) => {
    setState((s) => {
      const next = toggleIn(s, 'excluded', id);
      saveState(next);
      return next;
    });
  }, []);

  const setReminderMinutes = useCallback((minutes: number) => {
    setState((s) => {
      const next: StoredState = { ...s, prefs: { ...s.prefs, reminderMinutes: minutes } };
      saveState(next);
      return next;
    });
  }, []);

  const replaceState = useCallback((next: StoredState) => {
    saveState(next);
    setState(next);
  }, []);

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
