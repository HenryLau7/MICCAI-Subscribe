export interface IcsEvent {
  uid: string;
  start: string;   // ISO with +02:00
  end: string;
  summary: string;
  description: string;
  location: string;
  url?: string;
  alarmMinutes?: number;
}

export interface CalendarOptions { prodId: string; name: string }

/** RFC 5545 §3.7.3. Shared by every export path so they identify one producer. */
export const PROD_ID = '-//MICCAI Subscribe//EN';

/**
 * RFC 5545 §3.3.11. Backslash must be escaped first, or a later-escaped
 * character's own backslash would get doubled again.
 */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * RFC 5545 §3.1: content lines must not exceed 75 octets; continuation
 * lines start with a single space. Folds by UTF-8 byte count but never
 * splits a multi-byte code point.
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  const limit = 75;
  for (const ch of line) {          // iterate by code point so we never split a multi-byte char
    const n = enc.encode(ch).length;
    if (curBytes + n > limit) {
      out.push(cur);
      cur = ' ';                    // the continuation's leading space counts toward its own budget
      curBytes = 1;
    }
    cur += ch;
    curBytes += n;
  }
  if (cur) out.push(cur);
  return out.join('\r\n');
}

/** The conference runs entirely in CEST, but we still emit a full VTIMEZONE so clients convert correctly. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** '2026-09-28T16:00:00+02:00' -> '20260928T160000' (local form, paired with a TZID param) */
export function localStamp(iso: string): string {
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}00`;
}

/** UTC form, for DTSTAMP and the Google Calendar URL. */
export function utcStamp(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

export function buildCalendar(events: IcsEvent[], opts: CalendarOptions): string {
  const stamp = utcStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${opts.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    ...VTIMEZONE,
  ];

  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Paris:${localStamp(e.start)}`,
      `DTEND;TZID=Europe/Paris:${localStamp(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `LOCATION:${escapeText(e.location)}`,
    );
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.alarmMinutes && e.alarmMinutes > 0) {
      lines.push(
        'BEGIN:VALARM',
        `TRIGGER:-PT${e.alarmMinutes}M`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(e.summary)}`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
