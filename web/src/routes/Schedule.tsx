import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { useStore } from '../store/StoreProvider';
import { buildSchedule, unresolvedBookmarks, type ScheduleDay } from '../store/schedule';
import { todayInParis } from '../store/conference';
import { EmptyState } from '../ui/EmptyState';
import { IconEmptyCalendar } from '../ui/icons';
import { ScheduleItemRow } from '../ui/ScheduleItemRow';
import { useRovingTabList } from '../ui/useRovingTabList';

const CONFERENCE_DAYS = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];
const DAY_LABEL: Record<string, string> = {
  '2026-09-27': 'Sun 27',
  '2026-09-28': 'Mon 28',
  '2026-09-29': 'Tue 29',
  '2026-09-30': 'Wed 30',
  '2026-10-01': 'Thu 1',
};

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
  const lost = useMemo(() => unresolvedBookmarks(program, state), [program, state]);
  const [selected, setSelected] = useState(() => defaultSelectedDay(days));
  const { tabProps } = useRovingTabList(CONFERENCE_DAYS, selected, setSelected);

  const activeItems = days.find((d) => d.date === selected)?.items ?? [];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pb-16 pt-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight text-[var(--fg)]">My schedule</h1>
        <Link
          to="/calendar"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--accent)] px-3 text-sm font-medium text-[var(--accent)] focus-ring"
        >
          Add to calendar
        </Link>
      </header>

      {lost.length > 0 && (
        <p
          role="status"
          className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning)]"
        >
          {lost.length === 1
            ? '1 saved item is no longer in the program'
            : `${lost.length} saved items are no longer in the program`}{' '}
          and can&rsquo;t be shown. The official schedule is tentative and changes; these entries were
          withdrawn or renumbered since you saved them.
        </p>
      )}

      <div role="tablist" aria-label="Conference day" className="flex gap-2 overflow-x-auto pb-1">
        {CONFERENCE_DAYS.map((date, index) => {
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
              {...tabProps(index)}
              className={[
                'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                'focus-ring',
                isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
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
            icon={<IconEmptyCalendar />}
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
