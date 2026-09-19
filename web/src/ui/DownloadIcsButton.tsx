import type { ReactNode } from 'react';
import { buildCalendar, type IcsEvent } from '../calendar/ics';

interface DownloadIcsButtonProps {
  events: IcsEvent[];
  /** e.g. "miccai-2026-my-schedule.ics" */
  filename: string;
  /** VCALENDAR X-WR-CALNAME */
  calendarName: string;
  className?: string;
  children?: ReactNode;
}

function download(events: IcsEvent[], filename: string, calendarName: string): void {
  const ics = buildCalendar(events, { prodId: '-//MICCAI Subscribe//EN', name: calendarName });
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The primary export path (see task-9 brief: download comes before
 * subscription). Disabled with no events rather than producing an empty,
 * confusing .ics file.
 */
export function DownloadIcsButton({ events, filename, calendarName, className = '', children }: DownloadIcsButtonProps) {
  const disabled = events.length === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => download(events, filename, calendarName)}
      className={[
        'inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        disabled
          ? 'cursor-not-allowed border-[var(--border)] text-[var(--fg-muted)]'
          : 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90',
        className,
      ].join(' ')}
    >
      {children ?? 'Download .ics'}
    </button>
  );
}
