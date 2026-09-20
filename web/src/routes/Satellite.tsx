import { useId, useMemo, useState } from 'react';
import { useProgram } from '../ui/ProgramContext';
import { SatelliteCard } from '../ui/SatelliteCard';
import { EmptyState } from '../ui/EmptyState';
import { IconFilter } from '../ui/icons';
import { formatTime } from '../store/schedule';
import { useRovingTabList } from '../ui/useRovingTabList';
import type { SatelliteEvent, SatelliteType } from '../data/types';

const DAYS = ['2026-09-27', '2026-10-01'] as const;
const DAY_LABEL: Record<(typeof DAYS)[number], string> = {
  '2026-09-27': 'Sun 27',
  '2026-10-01': 'Thu 1',
};

const TYPES: SatelliteType[] = ['workshop', 'challenge', 'tutorial'];
const TYPE_LABEL: Record<SatelliteType, string> = { workshop: 'Workshop', challenge: 'Challenge', tutorial: 'Tutorial' };

// The four published time slots (task brief). Events that span consecutive
// slots keep their own wider start/end (see eventsStartingAt below for how
// the grid places those) rather than being re-split to fit.
const SLOTS: { start: string; end: string }[] = [
  { start: '08:00', end: '10:00' },
  { start: '10:30', end: '12:30' },
  { start: '13:30', end: '15:30' },
  { start: '16:00', end: '18:00' },
];

type ViewMode = 'list' | 'grid';

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Groups a day's already-filtered events by their actual (start, end) time
 * range and sorts the groups chronologically. Events with identical ranges
 * land in the same group; a merged, wider-spanning event gets its own group
 * rather than being force-split into the four canonical slots.
 */
function groupByTimeRange(events: SatelliteEvent[]): { label: string; start: string; items: SatelliteEvent[] }[] {
  const groups = new Map<string, SatelliteEvent[]>();
  for (const e of events) {
    const key = `${e.start}|${e.end}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const [start, end] = key.split('|');
      return { label: `${formatTime(start)}–${formatTime(end)}`, start, items: items.sort((a, b) => a.room.localeCompare(b.room)) };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Events in `room` that belong in this slot column: placed by their own
 * *start* time only, never duplicated across every slot they span.
 *
 * A merged, wider-spanning event (e.g. 10:30–15:30) is shown only in the
 * column matching its start — its card still prints its true, un-truncated
 * time range, so nothing is hidden, just anchored to one cell. This also
 * keeps the grid's total event count identical to the list view's (see
 * satellite-ui.test.tsx), which a colSpan-based "cover every slot it spans"
 * layout cannot guarantee: the real bundle has at least one room
 * (Madrid 2, 2026-09-27) with two events whose intervals genuinely overlap
 * (AFRICAI 08:00–12:30 and MiRASOL 10:30–15:30) — a case an
 * every-slot-it-covers layout has no single cell for without either
 * duplicating or silently dropping one of them.
 */
function eventsStartingAt(room: string, slot: { start: string }, events: SatelliteEvent[]): SatelliteEvent[] {
  return events.filter((e) => e.room === room && formatTime(e.start) === slot.start);
}

const buttonBase =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-ring';
const buttonOn = 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]';
const buttonOff = 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]';

/**
 * Browse the two satellite-event bookend days (Sun 2026-09-27 and Thu
 * 2026-10-01) by day, type and theme, in either a chronological list or a
 * room x time-slot grid. Both views render from the same filtered event set
 * (see the tests: grid and list must never diverge).
 *
 * 320px width: the grid is a native <table> (room rows x 4 slot columns),
 * which is wider than a phone screen once real room names and cards are in
 * it. It sits inside its own `overflow-x-auto` wrapper — that region scrolls
 * horizontally, the page itself never does.
 */
export function Satellite() {
  const { program } = useProgram();
  const [day, setDay] = useState<(typeof DAYS)[number]>(DAYS[0]);
  const [view, setView] = useState<ViewMode>('list');
  const [activeTypes, setActiveTypes] = useState<Set<SatelliteType>>(new Set(TYPES));
  const [theme, setTheme] = useState<string>('all');
  const themeSelectId = useId();
  const viewHeadingId = useId();
  const typeHeadingId = useId();
  const { tabProps } = useRovingTabList(DAYS, day, setDay);

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of DAYS) counts[d] = 0;
    for (const e of program.satellite) {
      const d = dayOf(e.start);
      if (d in counts) counts[d]++;
    }
    return counts;
  }, [program]);

  const themeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of program.satellite) if (e.theme) set.add(e.theme);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [program]);

  const filtered = useMemo(() => {
    return program.satellite.filter(
      (e) => dayOf(e.start) === day && activeTypes.has(e.type) && (theme === 'all' || e.theme === theme),
    );
  }, [program, day, activeTypes, theme]);

  const rooms = useMemo(() => {
    const set = new Set(filtered.map((e) => e.room));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [filtered]);

  const groups = useMemo(() => groupByTimeRange(filtered), [filtered]);

  const toggleType = (t: SatelliteType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold leading-tight text-[var(--fg)]">Satellite events</h1>
        <p className="text-xs text-[var(--fg-muted)]">
          Workshops, challenges and tutorials run the two bookend days of the conference. Each event&rsquo;s own
          paper list is published by its organizers on their own website — this site covers activity-level
          scheduling only: the day, room and time slot, not the talks inside it.
        </p>
      </header>

      <div role="tablist" aria-label="Satellite day" className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map((d, index) => {
          const selected = d === day;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              id={`satellite-day-tab-${d}`}
              aria-selected={selected}
              aria-controls="satellite-panel"
              onClick={() => setDay(d)}
              {...tabProps(index)}
              className={`${buttonBase} ${selected ? buttonOn : buttonOff}`}
            >
              {DAY_LABEL[d]} ({dayCounts[d]})
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1">
        <span id={viewHeadingId} className="text-xs font-medium text-[var(--fg-muted)]">
          View
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby={viewHeadingId}>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`${buttonBase} ${view === 'list' ? buttonOn : buttonOff}`}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`${buttonBase} ${view === 'grid' ? buttonOn : buttonOff}`}
          >
            Room grid
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span id={typeHeadingId} className="text-xs font-medium text-[var(--fg-muted)]">
          Type
        </span>
        <div role="group" aria-labelledby={typeHeadingId} className="flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = activeTypes.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleType(t)}
                className={`${buttonBase} ${on ? buttonOn : buttonOff}`}
              >
                {TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={themeSelectId} className="text-xs font-medium text-[var(--fg-muted)]">
          Theme
        </label>
        <select
          id={themeSelectId}
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="min-h-11 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-ring"
        >
          <option value="all">All themes</option>
          {themeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <section
        id="satellite-panel"
        role="tabpanel"
        aria-labelledby={`satellite-day-tab-${day}`}
        className="flex flex-col gap-4"
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={<IconFilter />}
            title="No satellite events match these filters"
            description="Try a different day, type, or theme."
          />
        ) : view === 'list' ? (
          groups.map((g) => (
            <div key={g.label + g.start} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-[var(--fg)]">{g.label}</h2>
              <ul className="flex flex-col gap-3">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <SatelliteCard event={e} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="sr-only">Room grid — {DAY_LABEL[day]}</h2>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Satellite event room grid for {DAY_LABEL[day]}, rooms by row and time slots by column
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 min-w-[9rem] border-b border-r border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-xs font-semibold text-[var(--fg-muted)]">
                      Room
                    </th>
                    {SLOTS.map((s) => (
                      <th
                        key={s.start}
                        scope="col"
                        className="min-w-[14rem] border-b border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-xs font-semibold text-[var(--fg-muted)]"
                      >
                        {s.start}–{s.end}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room}>
                      <th
                        scope="row"
                        className="sticky left-0 min-w-[9rem] border-b border-r border-[var(--border)] bg-[var(--bg-elevated)] p-2 align-top text-xs font-semibold text-[var(--fg)]"
                      >
                        {room}
                      </th>
                      {SLOTS.map((s) => {
                        const cellEvents = eventsStartingAt(room, s, filtered);
                        return (
                          <td
                            key={s.start}
                            className="min-w-[14rem] border-b border-[var(--border)] p-2 align-top"
                          >
                            <div className="flex flex-col gap-2">
                              {cellEvents.map((e) => (
                                <SatelliteCard key={e.id} event={e} />
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
