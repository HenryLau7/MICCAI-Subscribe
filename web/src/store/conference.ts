import type { Program } from '../data/types';
import { formatDay } from './schedule';

/**
 * The conference's own calendar, as distinct from the user's schedule.
 *
 * Everything here is a pure function of a `YYYY-MM-DD` string. The one impure
 * entry point is `todayInParis()`, and it is timezone-*pinned*, not
 * device-timezone-*dependent*: a delegate flies in with their phone clock
 * unchanged, and a naive device-local "today" lands on the wrong conference
 * day exactly when it matters most (23:30 in Strasbourg on day 1 reads as
 * day 2 on a phone still set to an eastern timezone).
 *
 * `Date` appears twice below and nowhere else. Both uses operate on plain
 * calendar dates through `Date.UTC`, which is arithmetic on a proleptic
 * Gregorian calendar with no local-time component to drift — not the
 * "parse a timestamp and hope" pattern the rest of this codebase avoids by
 * slicing ISO strings.
 */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `YYYY-MM-DD` -> days since the epoch. Pure calendar arithmetic. */
function dayNumberOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Today in Strasbourg, as `YYYY-MM-DD`. The only clock reading in the app. */
export function todayInParis(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** `2026-09-28` -> `Mon 28 Sep`. Accepts a full timestamp as well as a date. */
export function formatDayLabel(iso: string): string {
  const [y, m, d] = formatDay(iso).split('-').map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTH[m - 1]}`;
}

/** `2026-09-27`, `2026-10-01` -> `27 Sep – 1 Oct`. Collapses a shared month. */
export function formatDayRange(first: string, last: string): string {
  if (first === last) return formatDayLabel(first);
  const [, m1, d1] = first.split('-').map(Number);
  const [, m2, d2] = last.split('-').map(Number);
  const head = m1 === m2 ? `${d1}` : `${d1} ${MONTH[m1 - 1]}`;
  return `${head} – ${d2} ${MONTH[m2 - 1]}`;
}

/**
 * Every day the program actually has something on, in order.
 *
 * Derived from the data rather than declared as a constant, so a schedule
 * revision that adds or drops a day moves this with it. There is already one
 * hardcoded day list in `Schedule.tsx` (the day tabs, which must stay stable
 * across an empty day); this deliberately is not a second one.
 */
export function conferenceDays(program: Program): string[] {
  const days = new Set<string>();
  for (const s of program.sessions.values()) days.add(formatDay(s.start));
  for (const e of program.satellite) days.add(formatDay(e.start));
  return [...days].sort();
}

export type ConferenceState =
  | { phase: 'before'; first: string; last: string; daysUntil: number }
  | { phase: 'during'; today: string; dayNumber: number; totalDays: number }
  | { phase: 'after'; first: string; last: string };

/**
 * Where `today` sits relative to the conference. Returns null only when the
 * program carries no days at all, which `validate.py` already refuses to ship.
 *
 * `dayNumber` counts published days, not calendar days — if a revision ever
 * drops a middle day, "Day 3 of 4" still names a day that exists, which is
 * what a delegate reading the tab bar needs it to mean.
 */
export function conferenceState(days: string[], today: string): ConferenceState | null {
  if (days.length === 0) return null;
  const first = days[0];
  const last = days[days.length - 1];

  if (today < first) {
    return { phase: 'before', first, last, daysUntil: dayNumberOf(first) - dayNumberOf(today) };
  }
  if (today > last) return { phase: 'after', first, last };

  const index = days.indexOf(today);
  // Inside the window but on an unpublished day (a gap in a revised program):
  // count the days already started, so the number never goes backwards.
  const dayNumber = index >= 0 ? index + 1 : days.filter((d) => d <= today).length;
  return { phase: 'during', today, dayNumber, totalDays: days.length };
}
