import type { IcsEvent } from './ics';

/** Google's dates= parameter needs UTC in the compact basic format. */
function toUtcBasic(iso: string): string {
  const utc = new Date(iso);
  return `${utc.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

export function googleCalendarUrl(e: IcsEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.summary,
    dates: `${toUtcBasic(e.start)}/${toUtcBasic(e.end)}`,
    details: e.description,
    location: e.location,
    ctz: 'Europe/Paris',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
