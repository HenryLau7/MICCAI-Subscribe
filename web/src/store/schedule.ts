import type { Paper, Presentation, Program, SatelliteEvent, Session } from '../data/types';
import type { StoredState } from './storage';

/** 所有时间戳都已是 Europe/Paris 本地时间，切字符串即可，绝不用 Date 取时分。 */
export const formatDay = (iso: string): string => iso.slice(0, 10);
export const formatTime = (iso: string): string => iso.slice(11, 16);

export interface Interval { start: string; end: string }
export const overlaps = (a: Interval, b: Interval): boolean => a.start < b.end && b.start < a.end;

export type ConflictLevel = 'hard' | 'soft' | 'same-poster-session';
export interface Conflict { level: ConflictLevel; withKey: string }

export interface ScheduleItem {
  key: string;
  source: 'bookmark' | 'author' | 'affiliation';
  sourceLabel: string;
  presentation?: Presentation;
  paper?: Paper;
  session?: Session;
  satellite?: SatelliteEvent;
  start: string;
  end: string;
  conflicts: Conflict[];
}

export interface ScheduleDay { date: string; items: ScheduleItem[] }

function collect(program: Program, state: StoredState): ScheduleItem[] {
  const excluded = new Set(state.excluded);
  const byKey = new Map<string, ScheduleItem>();

  const addPresentation = (
    id: string, source: ScheduleItem['source'], label: string,
  ): void => {
    // excluded 只作用于关注带出来的结果；显式收藏永远不该被它吞掉
    if (source !== 'bookmark' && excluded.has(id)) return;
    const pr = program.byPresentationId.get(id);
    if (!pr) return;
    const session = program.sessions.get(pr.sessionId);
    const paper = program.byPaperId.get(pr.paperId);
    if (!session || !paper) return;
    const existing = byKey.get(id);
    // 显式收藏优先于关注带出来的
    if (existing && (existing.source === 'bookmark' || source !== 'bookmark')) return;
    byKey.set(id, { key: id, source, sourceLabel: label, presentation: pr, paper, session,
                    start: session.start, end: session.end, conflicts: [] });
  };

  for (const id of state.bookmarks) {
    const sat = program.bySatelliteId.get(id);
    if (sat) {
      byKey.set(id, { key: id, source: 'bookmark', sourceLabel: '', satellite: sat,
                      start: sat.start, end: sat.end, conflicts: [] });
      continue;
    }
    addPresentation(id, 'bookmark', '');
  }

  for (const slug of state.followedAuthors) {
    const author = program.authors.get(slug);
    if (!author) continue;
    for (const paperId of author.paperIds) {
      for (const pid of program.byPaperId.get(paperId)?.presentationIds ?? []) {
        addPresentation(pid, 'author', author.name);
      }
    }
  }

  for (const key of state.followedAffiliations) {
    const aff = program.affiliations.get(key);
    if (!aff) continue;
    for (const paperId of aff.paperIds) {
      for (const pid of program.byPaperId.get(paperId)?.presentationIds ?? []) {
        addPresentation(pid, 'affiliation', aff.name);
      }
    }
  }

  return [...byKey.values()];
}

function annotateConflicts(items: ScheduleItem[]): void {
  for (const a of items) {
    for (const b of items) {
      if (a === b || !overlaps(a, b)) continue;
      const bothPosters = a.presentation?.kind === 'poster' && b.presentation?.kind === 'poster';
      if (bothPosters && a.presentation!.sessionId === b.presentation!.sessionId) {
        // 同一场 poster session 里收藏多篇很正常，2 小时够依次看完，不该报警
        a.conflicts.push({ level: 'same-poster-session', withKey: b.key });
        continue;
      }
      const aTalk = a.presentation ? a.presentation.kind !== 'poster' : !!a.satellite;
      const bTalk = b.presentation ? b.presentation.kind !== 'poster' : !!b.satellite;
      a.conflicts.push({ level: aTalk && bTalk ? 'hard' : 'soft', withKey: b.key });
    }
  }
}

export function buildSchedule(program: Program, state: StoredState): ScheduleDay[] {
  const items = collect(program, state);
  annotateConflicts(items);
  items.sort((a, b) => (a.start === b.start ? a.key.localeCompare(b.key) : a.start.localeCompare(b.start)));

  const days = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const d = formatDay(item.start);
    (days.get(d) ?? days.set(d, []).get(d)!).push(item);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, i]) => ({ date, items: i }));
}
