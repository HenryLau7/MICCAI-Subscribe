import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { defaultState } from '../src/store/storage';
import { buildSchedule, formatDay, formatTime, overlaps } from '../src/store/schedule';
import type { Program } from '../src/data/types';
import raw from '../public/data/program.min.json';

let program: Program;
beforeAll(() => { program = decodeProgram(raw as never); });

describe('time formatting is timezone-independent', () => {
  it('reads conference-local time straight off the ISO string', () => {
    // 若实现改用 new Date()，机器设成 Asia/Tokyo 时这条会挂
    expect(formatTime('2026-09-28T16:00:00+02:00')).toBe('16:00');
    expect(formatDay('2026-09-28T16:00:00+02:00')).toBe('2026-09-28');
  });
});

describe('overlaps', () => {
  it('detects overlap', () => {
    expect(overlaps(
      { start: '2026-09-28T10:30:00+02:00', end: '2026-09-28T12:00:00+02:00' },
      { start: '2026-09-28T11:00:00+02:00', end: '2026-09-28T13:00:00+02:00' },
    )).toBe(true);
  });
  it('treats touching intervals as non-overlapping', () => {
    expect(overlaps(
      { start: '2026-09-28T10:30:00+02:00', end: '2026-09-28T12:00:00+02:00' },
      { start: '2026-09-28T12:00:00+02:00', end: '2026-09-28T13:00:00+02:00' },
    )).toBe(false);
  });
});

describe('buildSchedule', () => {
  it('is empty with no bookmarks', () => {
    expect(buildSchedule(program, defaultState())).toEqual([]);
  });

  it('groups by day and sorts by start time', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-042:oral', 'M-PM-001'] };
    const days = buildSchedule(program, state);
    expect(days.map((d) => d.date)).toEqual(['2026-09-28']);
    expect(days[0].items.map((i) => i.start)).toEqual([
      '2026-09-28T10:30:00+02:00',  // O1A oral
      '2026-09-28T16:00:00+02:00',  // P1 poster
    ]);
  });

  it('does NOT flag two posters in the same session as a conflict', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-002'] };
    const [day] = buildSchedule(program, state);
    // Structural: both bookmarks must actually resolve into items, and each must
    // carry a non-empty, same-poster-session-only conflicts list pointing at the
    // other — an empty conflicts array (e.g. from a silently dropped lookup)
    // must NOT pass this test.
    expect(day.items).toHaveLength(2);
    expect(day.items[0].conflicts).toEqual([{ level: 'same-poster-session', withKey: day.items[1].key }]);
    expect(day.items[1].conflicts).toEqual([{ level: 'same-poster-session', withKey: day.items[0].key }]);
  });

  it('flags two overlapping oral sessions as a hard conflict', () => {
    // O1A 和 O1B 都是 Mon 10:30-12:00
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const b = program.presentations.find((p) => p.sessionId === 'O1B' && p.kind !== 'poster')!;
    const state = { ...defaultState(), bookmarks: [a.id, b.id] };
    const [day] = buildSchedule(program, state);
    expect(day.items[0].conflicts.some((c) => c.level === 'hard')).toBe(true);
  });

  it('pulls in a followed author\'s papers and labels their source', () => {
    const state = { ...defaultState(), followedAuthors: ['yuan-xue'] };
    const days = buildSchedule(program, state);
    const item = days.flatMap((d) => d.items).find((i) => i.paper?.id === 'M-PM-001');
    expect(item?.source).toBe('author');
    expect(item?.sourceLabel).toBe('Yuan Xue');
  });

  it('honours exclusions from a follow', () => {
    const state = { ...defaultState(), followedAuthors: ['yuan-xue'], excluded: ['M-PM-001'] };
    const days = buildSchedule(program, state);
    expect(days.flatMap((d) => d.items).some((i) => i.paper?.id === 'M-PM-001')).toBe(false);
  });

  it('an explicit bookmark is never suppressed by an exclusion meant for follow results', () => {
    const state = {
      ...defaultState(),
      followedAuthors: ['yuan-xue'],
      excluded: ['M-PM-001'],
      bookmarks: ['M-PM-001'],
    };
    const item = buildSchedule(program, state).flatMap((d) => d.items).find((i) => i.paper?.id === 'M-PM-001');
    expect(item).toBeDefined();
    expect(item?.source).toBe('bookmark');
  });

  it('an explicit bookmark wins over a follow as the item source', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001'], followedAuthors: ['yuan-xue'] };
    const items = buildSchedule(program, state).flatMap((d) => d.items).filter((i) => i.paper?.id === 'M-PM-001');
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('bookmark');
  });

  it('includes bookmarked satellite events', () => {
    const ev = program.satellite[0];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [ev.id] });
    expect(days[0].date).toBe('2026-09-27');
    expect(days[0].items[0].satellite?.acronym).toBe(ev.acronym);
  });
});
