import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { defaultState } from '../src/store/storage';
import { buildSchedule, formatDay, formatTime, overlaps, unresolvedBookmarks } from '../src/store/schedule';
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

describe('two talks in the same session are not a conflict', () => {
  // 9 of 18 oral sessions pack 6 orals + 6 spotlights into one 90-minute
  // window, so bookmarking two talks from one session is the normal case.
  // One room, one seat, back to back — flagging that red trains users to
  // ignore the badge, which is exactly what the conflict-tiering ruling
  // exists to prevent.
  const twoTalksInOneSession = (): string[] => {
    const talks = program.presentations.filter((p) => p.sessionId === 'O1A' && p.kind !== 'poster');
    return [talks[0].id, talks[1].id];
  };

  it('emits no conflict at all between them', () => {
    const [a, b] = twoTalksInOneSession();
    const [day] = buildSchedule(program, { ...defaultState(), bookmarks: [a, b] });
    // Structural: both must actually resolve, so an empty list from a dropped
    // lookup cannot pass this.
    expect(day.items).toHaveLength(2);
    expect(day.items[0].conflicts).toEqual([]);
    expect(day.items[1].conflicts).toEqual([]);
  });

  it('holds for an oral and a spotlight in the same session', () => {
    const oral = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind === 'oral')!;
    const spot = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind === 'spotlight')!;
    const [day] = buildSchedule(program, { ...defaultState(), bookmarks: [oral.id, spot.id] });
    expect(day.items).toHaveLength(2);
    expect(day.items.flatMap((i) => i.conflicts)).toEqual([]);
  });

  it('still flags a talk in a DIFFERENT overlapping session as hard', () => {
    // Guard against "fixing" the above by suppressing conflicts wholesale.
    const [a] = twoTalksInOneSession();
    const other = program.presentations.find((p) => p.sessionId === 'O1B' && p.kind !== 'poster')!;
    const [day] = buildSchedule(program, { ...defaultState(), bookmarks: [a, other.id] });
    expect(day.items[0].conflicts.some((c) => c.level === 'hard')).toBe(true);
  });
});

describe('unresolvedBookmarks', () => {
  // The program is TENTATIVE and refreshed daily during the conference. A
  // bookmark whose presentation disappears is currently dropped in silence:
  // it vanishes from /schedule, the day counts and the .ics with no trace.
  it('is empty when every bookmark resolves', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001', program.satellite[0].id] };
    expect(unresolvedBookmarks(program, state)).toEqual([]);
  });

  it('reports a bookmark whose presentation no longer exists', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-001:oral', 'sat:gone'] };
    // M-PM-001 has no oral slot, so ':oral' is exactly the dangling-id shape a
    // refresh produces when a talk is withdrawn.
    expect(unresolvedBookmarks(program, state)).toEqual(['M-PM-001:oral', 'sat:gone']);
  });

  it('ignores follows — only explicit bookmarks can be lost', () => {
    const state = { ...defaultState(), followedAuthors: ['nobody-at-all'] };
    expect(unresolvedBookmarks(program, state)).toEqual([]);
  });
});
