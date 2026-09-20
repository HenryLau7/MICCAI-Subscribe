import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, defaultState, loadState, sanitize, saveState } from '../src/store/storage';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadState()).toEqual(defaultState());
  });

  it('round-trips state', () => {
    const s = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-042:oral'] };
    saveState(s);
    expect(loadState().bookmarks).toEqual(['M-PM-001', 'M-PM-042:oral']);
  });

  it('ignores corrupt JSON instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(defaultState());
  });

  it('ignores a state written by a future schema', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, bookmarks: ['X'] }));
    expect(loadState().bookmarks).toEqual([]);
  });

  it('repairs missing fields from a partial state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, bookmarks: ['A'] }));
    const s = loadState();
    expect(s.bookmarks).toEqual(['A']);
    expect(s.followedAuthors).toEqual([]);
    expect(s.prefs.reminderMinutes).toBe(15);
  });

  it('survives localStorage throwing (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => saveState(defaultState())).not.toThrow();
    spy.mockRestore();
  });

  it('survives getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(loadState()).toEqual(defaultState());
    spy.mockRestore();
  });
});

describe('reminderMinutes must be a whole number of minutes', () => {
  // RFC 5545 durations are integers. A fractional value reaches the export as
  // TRIGGER:-PT15.5M, which a calendar client may reject — and it rejects the
  // whole file, not just the alarm, so one bad pref loses the entire schedule.
  const withPref = (v: unknown) =>
    sanitize({ ...defaultState(), prefs: { reminderMinutes: v } })?.prefs.reminderMinutes;

  it('keeps a valid whole-minute value', () => {
    expect(withPref(30)).toBe(30);
    expect(withPref(0)).toBe(0);
  });

  it('rejects a fractional value', () => {
    expect(withPref(15.5)).toBe(15);
  });

  it('rejects negative, infinite, NaN and absurd values', () => {
    expect(withPref(-3)).toBe(15);
    expect(withPref(Infinity)).toBe(15);
    expect(withPref(Number.NaN)).toBe(15);
    expect(withPref(99999)).toBe(15);
  });

  it('rejects a non-number', () => {
    expect(withPref('30')).toBe(15);
    expect(withPref(null)).toBe(15);
  });
});
