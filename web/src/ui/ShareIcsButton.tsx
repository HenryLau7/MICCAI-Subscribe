import { useState, type ReactNode } from 'react';
import { buildCalendar, PROD_ID, type IcsEvent } from '../calendar/ics';
import { downloadBlob } from '../calendar/download';

interface ShareIcsButtonProps {
  events: IcsEvent[];
  /** e.g. "miccai-2026-my-schedule.ics" */
  filename: string;
  /** VCALENDAR X-WR-CALNAME */
  calendarName: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Whether this browser can hand a .ics to the OS share sheet. Probed with a
 * real File, because `canShare` accepts or rejects on the file's type — a
 * browser that shares text but not files returns false here, which is what we
 * want.
 */
function canShareIcsFile(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], 'probe.ics', { type: 'text/calendar' })] });
  } catch {
    return false;
  }
}

/**
 * The short path to Calendar on iOS.
 *
 * A downloaded .ics on iPhone lands in Files, and importing it from there
 * takes several more taps — which is where people give up. Sharing the same
 * bytes as a file puts Calendar directly in the share sheet.
 *
 * Strictly additive: renders nothing at all where the API is absent, which is
 * every desktop browser today, so those users see exactly the Download button
 * they saw before.
 */
export function ShareIcsButton({ events, filename, calendarName, className = '', children }: ShareIcsButtonProps) {
  // Probed once per mount: capability does not change while the page is open.
  const [supported] = useState(canShareIcsFile);
  if (!supported) return null;

  const disabled = events.length === 0;

  const share = () => {
    const ics = buildCalendar(events, { prodId: PROD_ID, name: calendarName });
    const file = new File([ics], filename, { type: 'text/calendar' });
    navigator.share({ files: [file], title: calendarName }).catch((error: unknown) => {
      // Dismissing the share sheet is a decision, not a failure — say nothing.
      // Anything else means the sheet never delivered the file, so fall back
      // to the download rather than leaving the user with no calendar at all.
      if (error instanceof Error && error.name === 'AbortError') return;
      downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename);
    });
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={share}
      className={[
        'inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
        disabled
          ? 'cursor-not-allowed border-[var(--border)] text-[var(--fg-muted)]'
          : 'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10',
        className,
      ].join(' ')}
    >
      {children ?? 'Add to Calendar'}
    </button>
  );
}
