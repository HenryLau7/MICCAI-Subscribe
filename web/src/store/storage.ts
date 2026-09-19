export const STORAGE_KEY = 'miccai-subscribe:v1';
export const SCHEMA = 1;

export interface StoredState {
  v: number;
  bookmarks: string[];            // presentation id 或 satellite event id
  followedAuthors: string[];      // author slug
  followedAffiliations: string[]; // affiliation key
  excluded: string[];             // 从关注结果里手动排除的 presentation id
  prefs: { reminderMinutes: number };
}

export function defaultState(): StoredState {
  return { v: SCHEMA, bookmarks: [], followedAuthors: [], followedAffiliations: [],
           excluded: [], prefs: { reminderMinutes: 15 } };
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** 永不抛异常。隐私模式、配额不足、脏数据一律退回默认值。 */
export function loadState(): StoredState {
  let text: string | null = null;
  try { text = localStorage.getItem(STORAGE_KEY); } catch { return defaultState(); }
  if (!text) return defaultState();

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return defaultState(); }
  if (typeof parsed !== 'object' || parsed === null) return defaultState();

  const o = parsed as Record<string, unknown>;
  if (o.v !== SCHEMA) return defaultState();   // 未知版本，宁可丢也不误读

  const prefs = (o.prefs ?? {}) as Record<string, unknown>;
  return {
    v: SCHEMA,
    bookmarks: strings(o.bookmarks),
    followedAuthors: strings(o.followedAuthors),
    followedAffiliations: strings(o.followedAffiliations),
    excluded: strings(o.excluded),
    prefs: {
      reminderMinutes: typeof prefs.reminderMinutes === 'number' ? prefs.reminderMinutes : 15,
    },
  };
}

export function saveState(state: StoredState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 无痕模式，只活在内存里 */ }
}
