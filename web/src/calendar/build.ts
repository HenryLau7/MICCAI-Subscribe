import type { Program } from '../data/types';
import type { ScheduleDay, ScheduleItem } from '../store/schedule';
import { bySlot } from '../store/schedule';
import type { IcsEvent } from './ics';

const DOMAIN = 'miccaisubscribe.com';
const VENUE = 'Strasbourg Convention Center, Strasbourg, France';

const kindLabel: Record<string, string> = { oral: 'Oral', spotlight: 'Spotlight' };

/**
 * One event per session (decision D6). The PDF publishes no per-talk start
 * time, so dividing the session window would fabricate one; the event
 * covers the whole session and the description lists which bookmarked
 * talks are in it, in order.
 */
export function scheduleToEvents(
  program: Program, days: ScheduleDay[], reminderMinutes: number,
): IcsEvent[] {
  const items = days.flatMap((d) => d.items);
  const bySession = new Map<string, ScheduleItem[]>();
  const events: IcsEvent[] = [];

  for (const item of items) {
    if (item.satellite) {
      const s = item.satellite;
      events.push({
        uid: `${s.id}@${DOMAIN}`,
        start: s.start, end: s.end,
        summary: `${s.acronym} (${s.type})`,
        description: [s.name, s.theme && `Theme: ${s.theme}`, s.url].filter(Boolean).join('\n'),
        location: `${s.room}${s.floor ? ` (floor ${s.floor})` : ''}, ${VENUE}`,
        url: s.url || undefined,
        alarmMinutes: reminderMinutes,
      });
      continue;
    }
    if (!item.presentation) continue;
    const list = bySession.get(item.presentation.sessionId) ?? [];
    list.push(item);
    bySession.set(item.presentation.sessionId, list);
  }

  for (const [sessionId, group] of bySession) {
    const session = program.sessions.get(sessionId)!;
    const isPoster = session.kind === 'poster';
    const lines: string[] = [
      isPoster
        ? `Your ${group.length} bookmarked poster(s) in this session:`
        : `Your ${group.length} bookmarked talk(s) in this session:`,
      '',
    ];
    for (const item of group.sort((a, b) => bySlot(a.presentation!, b.presentation!))) {
      const pr = item.presentation!;
      const paper = item.paper!;
      const tag = isPoster
        ? `Board ${pr.paperId}`
        : `${kindLabel[pr.kind] ?? pr.kind} ${pr.orderInSession || '?'}`;
      lines.push(`• [${tag}] ${paper.title}`);
      lines.push(`  ${paper.presenters.join(' & ')}${paper.affiliation ? `, ${paper.affiliation}` : ''}`);
      if (item.source !== 'bookmark') lines.push(`  (from your follow: ${item.sourceLabel})`);
    }
    if (!isPoster) {
      lines.push('', 'Exact per-talk times are not published by MICCAI; this event covers the whole session.');
    } else {
      lines.push('', 'Poster hall location is not published by MICCAI; follow on-site signage.');
    }

    events.push({
      uid: `${sessionId}@${DOMAIN}`,
      start: session.start,
      end: session.end,
      summary: isPoster ? session.name : `${sessionId} · ${session.name}`,
      description: lines.join('\n'),
      location: session.room ? `${session.room}, ${VENUE}` : VENUE,
      alarmMinutes: reminderMinutes,
    });
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
