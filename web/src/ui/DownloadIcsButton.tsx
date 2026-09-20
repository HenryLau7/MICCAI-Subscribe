import type { ReactNode } from 'react';
import { buildCalendar, PROD_ID, type IcsEvent } from '../calendar/ics';
import { downloadBlob } from '../calendar/download';

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
  const ics = buildCalendar(events, { prodId: PROD_ID, name: calendarName });
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename);
}

/**
 * The primary export path (download comes before
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
        'focus-ring',
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
