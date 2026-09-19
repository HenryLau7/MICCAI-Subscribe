import { describe, it, expect, beforeAll } from 'vitest';
import { decodeProgram } from '../src/data/decode';
import { defaultState } from '../src/store/storage';
import { buildSchedule } from '../src/store/schedule';
import { buildCalendar, escapeText, foldLine, type IcsEvent } from '../src/calendar/ics';
import { scheduleToEvents } from '../src/calendar/build';
import { googleCalendarUrl } from '../src/calendar/google';
import type { Program } from '../src/data/types';
import raw from '../public/data/program.min.json';

let program: Program;
beforeAll(() => { program = decodeProgram(raw as never); });

const sample: IcsEvent = {
  uid: 'M-PM-001@miccaisubscribe.com',
  start: '2026-09-28T16:00:00+02:00',
  end: '2026-09-28T18:00:00+02:00',
  summary: 'Poster Session 1',
  description: 'Board M-PM-001',
  location: 'Strasbourg Convention Center',
  alarmMinutes: 15,
};

describe('escaping (RFC 5545 §3.3.11)', () => {
  it('escapes backslash, semicolon, comma and newline', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });
  it('escapes the backslash first so it is not doubled twice', () => {
    expect(escapeText('x\\,y')).toBe('x\\\\\\,y');
  });
});

describe('line folding (RFC 5545 §3.1)', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:hi')).toBe('SUMMARY:hi');
  });
  it('folds at 75 octets with a leading space on continuations', () => {
    const folded = foldLine('SUMMARY:' + 'a'.repeat(200)).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    expect(folded.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(folded.slice(1).every((l) => l.startsWith(' '))).toBe(true);
  });
  it('never splits a multi-byte character across a fold', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(100)).split('\r\n');
    expect(folded.join('').includes('�')).toBe(false);
    expect(folded.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('buildCalendar', () => {
  const ics = buildCalendar([sample], { prodId: '-//MICCAI Subscribe//EN', name: 'MICCAI 2026' });

  it('uses CRLF line endings throughout', () => {
    expect(ics.includes('\n')).toBe(true);
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });
  it('emits a well-formed VCALENDAR envelope', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('CALSCALE:GREGORIAN');
  });
  it('includes a Europe/Paris VTIMEZONE and references it by TZID', () => {
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Europe/Paris');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20260928T160000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20260928T180000');
  });
  it('emits a VALARM at the requested offset', () => {
    expect(ics).toContain('TRIGGER:-PT15M');
  });
  it('keeps UID stable across regeneration', () => {
    const again = buildCalendar([sample], { prodId: '-//MICCAI Subscribe//EN', name: 'MICCAI 2026' });
    const uid = (s: string) => s.match(/UID:(.*)/)![1];
    expect(uid(ics)).toBe(uid(again));
  });
});

describe('scheduleToEvents', () => {
  it('emits ONE event per session even with several talks bookmarked in it', () => {
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const b = program.presentations.filter((p) => p.sessionId === 'O1A' && p.kind !== 'poster')[1];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [a.id, b.id] });
    const events = scheduleToEvents(program, days, 15);
    expect(events).toHaveLength(1);
    expect(events[0].start).toBe('2026-09-28T10:30:00+02:00');
    expect(events[0].end).toBe('2026-09-28T12:00:00+02:00');
  });

  it('lists the bookmarked talks in the description and says times are unpublished', () => {
    const a = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
    const [event] = scheduleToEvents(program, buildSchedule(program, { ...defaultState(), bookmarks: [a.id] }), 15);
    expect(event.description).toContain(program.byPaperId.get(a.paperId)!.title);
    expect(event.description).toMatch(/not published|未公布/);
  });

  it('puts the board number in a poster event description', () => {
    const days = buildSchedule(program, { ...defaultState(), bookmarks: ['M-PM-001'] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.description).toContain('M-PM-001');
  });

  it('does not invent a room for poster sessions', () => {
    const days = buildSchedule(program, { ...defaultState(), bookmarks: ['M-PM-001'] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.location).not.toMatch(/Hall/);
  });

  it('gives satellite events their own room as location', () => {
    const ev = program.satellite[0];
    const days = buildSchedule(program, { ...defaultState(), bookmarks: [ev.id] });
    const [event] = scheduleToEvents(program, days, 15);
    expect(event.location).toContain(ev.room);
  });
});

describe('googleCalendarUrl', () => {
  it('encodes UTC times in the compact basic format', () => {
    const url = googleCalendarUrl(sample);
    expect(url).toContain('dates=20260928T140000Z%2F20260928T160000Z');
  });
});
