import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { useStore } from '../store/StoreProvider';
import { buildSchedule, type ScheduleDay } from '../store/schedule';
import { EmptyState } from '../ui/EmptyState';
import { ScheduleItemRow } from '../ui/ScheduleItemRow';

const CONFERENCE_DAYS = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];
const DAY_LABEL: Record<string, string> = {
  '2026-09-27': 'Sun 27',
  '2026-09-28': 'Mon 28',
  '2026-09-29': 'Tue 29',
  '2026-09-30': 'Wed 30',
  '2026-10-01': 'Thu 1',
};

/**
 * The one permitted Date/Intl use in this app (see task-8 brief): the
 * timeZone is explicit, so this is timezone-*pinned*, not device-timezone-
 * *dependent*. The core user flies in with their phone clock unchanged, and
 * a naive device-local "today" can land on the wrong conference day right
 * when it matters most (e.g. 23:30 Paris on day 1 reads as day 2 on a phone
 * still on an eastern timezone).
 */
function todayInParis(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Picks which day tab opens by default. When "today" (Paris-pinned) falls
 * inside the conference window, that's the obvious answer. Outside it —
 * before the conference starts, or after it ends — there is no "current
 * day" to default to, so we fall back to the first day that actually has
 * something on it: a returning user with bookmarks shouldn't land on an
 * empty tab. Only when nothing has been bookmarked or followed at all do we
 * fall back further, to day 1, since there's no content to prefer any other
 * day by.
 */
function defaultSelectedDay(days: ScheduleDay[]): string {
  const today = todayInParis();
  if (CONFERENCE_DAYS.includes(today)) return today;
  const firstWithItems = days.find((d) => d.items.length > 0);
  return firstWithItems?.date ?? CONFERENCE_DAYS[0];
}

export function Schedule() {
  const { program } = useProgram();
  const { state } = useStore();
  const days = useMemo(() => buildSchedule(program, state), [program, state]);
  const [selected, setSelected] = useState(() => defaultSelectedDay(days));

  const activeItems = days.find((d) => d.date === selected)?.items ?? [];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--fg)]">My schedule</h1>
        <Link
          to="/calendar"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--accent)] px-3 text-sm font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Add to calendar
        </Link>
      </header>

      <div role="tablist" aria-label="Conference day" className="flex gap-2 overflow-x-auto pb-1">
        {CONFERENCE_DAYS.map((date) => {
          const count = days.find((d) => d.date === date)?.items.length ?? 0;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              role="tab"
              id={`day-tab-${date}`}
              aria-selected={isSelected}
              aria-controls="schedule-panel"
              onClick={() => setSelected(date)}
              className={[
                'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
              ].join(' ')}
            >
              {DAY_LABEL[date]}
              {count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      <section
        id="schedule-panel"
        role="tabpanel"
        aria-labelledby={`day-tab-${selected}`}
        className="flex flex-col gap-3"
      >
        {activeItems.length === 0 ? (
          <EmptyState
            title="Nothing scheduled for this day yet"
            description="Bookmark a paper or follow an author or affiliation to build your schedule."
            action={
              <Link to="/search" className="text-sm text-[var(--accent)] underline underline-offset-2">
                Find papers
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {activeItems.map((item) => (
              <ScheduleItemRow key={item.key} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
