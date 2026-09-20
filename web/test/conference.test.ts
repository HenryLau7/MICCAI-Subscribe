/**
 * The conference calendar: where "today" sits in the program, and how a day
 * is written out.
 *
 * `conferenceState` drives the one piece of the home screen that changes by
 * itself, so it is pinned here at every boundary — the day before day 1, day
 * 1, the last day, and the day after. The date helpers are pure string work
 * over `Date.UTC`; the timezone-independence suite below is the check that
 * matters, since the whole point of `todayInParis` is that it does not move
 * with the reader's device.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  conferenceDays,
  conferenceState,
  formatDayLabel,
  formatDayRange,
  todayInParis,
} from '../src/store/conference';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);
const DAYS = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];

afterEach(() => {
  vi.useRealTimers();
});

describe('conferenceDays', () => {
  it('derives the five published days from the real bundle, in order', () => {
    expect(conferenceDays(program)).toEqual(DAYS);
  });
});

describe('conferenceState', () => {
  it('counts down on the day before it starts', () => {
    expect(conferenceState(DAYS, '2026-09-26')).toEqual({
      phase: 'before',
      first: '2026-09-27',
      last: '2026-10-01',
      daysUntil: 1,
    });
  });

  it('counts across a month boundary without drifting', () => {
    // 2026-08-27 -> 2026-09-27 is 31 days: the arithmetic is calendar-based,
    // not 30-day-months.
    expect(conferenceState(DAYS, '2026-08-27')).toMatchObject({ phase: 'before', daysUntil: 31 });
  });

  it('opens at day 1 on the first day, not day 0', () => {
    expect(conferenceState(DAYS, '2026-09-27')).toEqual({
      phase: 'during',
      today: '2026-09-27',
      dayNumber: 1,
      totalDays: 5,
    });
  });

  it('reports the last day as day 5 of 5, still during', () => {
    expect(conferenceState(DAYS, '2026-10-01')).toMatchObject({
      phase: 'during',
      dayNumber: 5,
      totalDays: 5,
    });
  });

  it('switches to after the morning the conference ends', () => {
    expect(conferenceState(DAYS, '2026-10-02')).toEqual({
      phase: 'after',
      first: '2026-09-27',
      last: '2026-10-01',
    });
  });

  it('never reports day 0 for a gap day inside the window', () => {
    // A revision that drops a middle day must not make the counter go
    // backwards or name a day that is not in the program.
    const gapped = ['2026-09-27', '2026-09-29'];
    expect(conferenceState(gapped, '2026-09-28')).toMatchObject({ phase: 'during', dayNumber: 1 });
  });

  it('returns null rather than inventing a window for an empty program', () => {
    expect(conferenceState([], '2026-09-28')).toBeNull();
  });
});

describe('date labels', () => {
  it('writes a day as weekday, date, month', () => {
    expect(formatDayLabel('2026-09-28')).toBe('Mon 28 Sep');
    expect(formatDayLabel('2026-10-01')).toBe('Thu 1 Oct');
  });

  it('collapses the month when a range stays inside one', () => {
    expect(formatDayRange('2026-09-27', '2026-09-30')).toBe('27 – 30 Sep');
  });

  it('keeps both months when a range crosses one', () => {
    expect(formatDayRange('2026-09-27', '2026-10-01')).toBe('27 Sep – 1 Oct');
  });

  it('collapses a single-day range to that day', () => {
    expect(formatDayRange('2026-09-27', '2026-09-27')).toBe('Sun 27 Sep');
  });
});

describe('todayInParis is pinned to Strasbourg, not to the reader', () => {
  // The delegate's phone is still on the timezone they flew in from. These
  // are the two instants where a device-local "today" and Strasbourg's
  // disagree, in opposite directions.
  it('stays on the Strasbourg day when a phone further east has rolled over', () => {
    // 2026-09-28T20:00Z is 22:00 on the 28th in Strasbourg (UTC+2 in late
    // September) but already 04:00 on the 29th in Shanghai. A delegate who
    // never changed their clock must still be shown day 2, not day 3.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T20:00:00Z'));
    expect(todayInParis()).toBe('2026-09-28');
  });

  it('advances to the Strasbourg day while a phone further west is a day behind', () => {
    // 2026-09-28T23:30Z is 01:30 on the 29th in Strasbourg, still 16:30 on
    // the 28th in Los Angeles. The opposite error, same fix.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T23:30:00Z'));
    expect(todayInParis()).toBe('2026-09-29');
  });
});
