import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { useStore } from '../store/StoreProvider';
import { buildSchedule } from '../store/schedule';
import { scheduleToEvents } from '../calendar/build';
import { encodeTransfer } from '../store/transfer';
import { DownloadIcsButton } from '../ui/DownloadIcsButton';
import { ShareIcsButton } from '../ui/ShareIcsButton';
import { downloadBlob } from '../calendar/download';

const REMINDER_OPTIONS = [0, 5, 15, 30, 60];
const reminderLabel = (m: number): string => (m === 0 ? 'No reminder' : `${m} min before`);

function downloadJson(state: unknown, filename: string): void {
  downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), filename);
}

function sectionHeading(id: string, text: string) {
  return (
    <h2 id={id} className="text-sm font-semibold text-[var(--fg)]">
      {text}
    </h2>
  );
}

const buttonClass =
  'inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] focus-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--fg)]';

/**
 * Export + cross-device transfer hub. Section order is a product
 * requirement: download first (the reliable path), then
 * subscription (with an honest refresh-interval warning and its
 * generate-link control disabled — no backend exists yet, so we never hand
 * out a fake URL), then reminder preference, then transfer.
 */
export function CalendarPage() {
  const { program } = useProgram();
  const { state, setReminderMinutes } = useStore();
  const days = useMemo(() => buildSchedule(program, state), [program, state]);
  const events = useMemo(
    () => scheduleToEvents(program, days, state.prefs.reminderMinutes),
    [program, days, state.prefs.reminderMinutes],
  );

  const [copied, setCopied] = useState(false);
  const importUrl = useMemo(() => {
    const encoded = encodeTransfer(state);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/import#${encoded}`;
  }, [state]);

  const subscriptionHintId = useId();
  const reminderHeadingId = useId();

  const copyLink = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(importUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-tight text-[var(--fg)]">Calendar</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {events.length === 0
            ? 'Nothing to export yet.'
            : `${events.length} event${events.length === 1 ? '' : 's'} from your bookmarks and follows.`}
        </p>
      </header>

      {/* 1. Download — the primary, reliable path. */}
      <section aria-labelledby="download-heading" className="flex flex-col gap-2">
        {sectionHeading('download-heading', 'Download .ics')}
        <p className="text-xs text-[var(--fg-muted)]">
          One file with every session on your schedule. Import it into Apple Calendar, Google Calendar, Outlook, or
          any app that reads .ics files.
        </p>
        <div className="flex flex-wrap gap-2">
          <DownloadIcsButton
            events={events}
            filename="miccai-2026-my-schedule.ics"
            calendarName="My MICCAI 2026 Schedule"
          />
          <ShareIcsButton
            events={events}
            filename="miccai-2026-my-schedule.ics"
            calendarName="My MICCAI 2026 Schedule"
          />
        </div>
        {events.length === 0 && (
          <p className="text-xs text-[var(--fg-muted)]">
            <Link to="/search" className="text-[var(--accent)] underline underline-offset-2">
              Bookmark a paper
            </Link>{' '}
            or follow an author or affiliation first.
          </p>
        )}
      </section>

      {/* 2. Subscription — explained honestly, generate-link disabled: this app
          has no backend, so there is no URL to hand out and we never fake one. */}
      <section aria-labelledby="subscribe-heading" className="flex flex-col gap-2">
        {sectionHeading('subscribe-heading', 'Subscription link')}
        <p className="text-xs text-[var(--fg-muted)]">
          A subscription link lets a calendar app pull your schedule on its own, without you downloading a file each
          time.
        </p>
        <p id={subscriptionHintId} className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-xs text-[var(--warning)]">
          Calendar apps decide their own refresh interval for a subscribed feed — Google Calendar&rsquo;s can take up
          to 24 hours. For a conference that runs three days, that is too slow for last-minute changes. During the
          conference, re-downloading the .ics above is the reliable way to pick up an update.
        </p>
        <button type="button" disabled aria-describedby={subscriptionHintId} className={buttonClass}>
          Generate subscription link — not yet available
        </button>
      </section>

      {/* 3. Reminder preference. */}
      <section aria-labelledby={reminderHeadingId} className="flex flex-col gap-2">
        {sectionHeading(reminderHeadingId, 'Reminder')}
        <p className="text-xs text-[var(--fg-muted)]">
          Applies to every session in your next .ics download. Doesn&rsquo;t change a file you already downloaded.
        </p>
        <div role="radiogroup" aria-labelledby={reminderHeadingId} className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((m) => {
            const isSelected = state.prefs.reminderMinutes === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setReminderMinutes(m)}
                className={[
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                  'focus-ring',
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
                ].join(' ')}
              >
                {reminderLabel(m)}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Cross-device transfer. */}
      <section aria-labelledby="transfer-heading" className="flex flex-col gap-2">
        {sectionHeading('transfer-heading', 'Move to another device')}
        <p className="text-xs text-[var(--fg-muted)]">
          Your bookmarks and follows live only in this browser. Open the link below on another device or browser to
          copy them there.
        </p>
        <p className="break-all rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 font-mono text-xs text-[var(--fg-muted)]">
          {importUrl}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className={buttonClass}>
            {copied ? 'Copied' : 'Copy transfer link'}
          </button>
          <button
            type="button"
            onClick={() => downloadJson(state, 'miccai-2026-my-schedule.json')}
            className={buttonClass}
          >
            Download as JSON
          </button>
        </div>
      </section>
    </div>
  );
}
