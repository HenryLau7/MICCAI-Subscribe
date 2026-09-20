import type { Paper, Presentation, Program, SatelliteEvent, Session } from '../data/types';
import type { StoredState } from './storage';

/** 所有时间戳都已是 Europe/Paris 本地时间，切字符串即可，绝不用 Date 取时分。 */
export const formatDay = (iso: string): string => iso.slice(0, 10);
export const formatTime = (iso: string): string => iso.slice(11, 16);

/**
 * How a talk is identified inside its session, e.g. "Oral 3" / "Spotlight 1".
 *
 * `orderInSession` is counted per (session, kind) by the parser, so an Oral 1
 * and a Spotlight 1 both exist in 9 of the 18 oral sessions. A bare "#1" is
 * therefore ambiguous and renders twice on the same page; the kind is what
 * disambiguates it. Posters have no order (the board number locates them),
 * so they get no label.
 */
const KIND_LABEL: Record<string, string> = { oral: 'Oral', spotlight: 'Spotlight' };
export const slotLabel = (p: Pick<Presentation, 'kind' | 'orderInSession'>): string =>
  p.kind === 'poster' || !p.orderInSession ? '' : `${KIND_LABEL[p.kind] ?? p.kind} ${p.orderInSession}`;

/** Orals before spotlights, then by number — never order alone, which interleaves them. */
const KIND_RANK: Record<string, number> = { oral: 0, spotlight: 1, poster: 2 };
export const bySlot = (
  a: Pick<Presentation, 'kind' | 'orderInSession'>, b: Pick<Presentation, 'kind' | 'orderInSession'>,
): number =>
  (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) || (a.orderInSession || 0) - (b.orderInSession || 0);

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
      if (a.presentation && b.presentation && a.presentation.sessionId === b.presentation.sessionId) {
        // 同一场 session 内部永远不是冲突：一个房间、一个座位，依次进行。
        // Posters: 同一场 poster session 里收藏多篇很正常，2 小时够依次看完。
        // Talks: 9/18 oral session 把 6 oral + 6 spotlight 塞进同一个 90 分钟
        // 窗口，收藏同场两个报告是最常见的操作，不是边缘情况 —— 标红会训练
        // 用户忽略这个徽章，正是 conflict-tiering 裁决要避免的代价。
        // 只有 poster 给一个中性提示（换展板要走动）；talks 什么都不显示。
        if (a.presentation.kind === 'poster' && b.presentation.kind === 'poster') {
          a.conflicts.push({ level: 'same-poster-session', withKey: b.key });
        }
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

/**
 * Bookmark ids that no longer resolve to anything in the current program.
 *
 * The official schedule is TENTATIVE and refreshed daily during the
 * conference, so a talk can be withdrawn out from under a saved bookmark.
 * `collect` drops those silently — they vanish from /schedule, from the day
 * counts and from the .ics with no trace, which is the one way this app can
 * quietly lose a delegate's data. Surfacing the count is the honest minimum:
 * we cannot recover the item (the min bundle carries no title_key), but the
 * user can be told it happened.
 *
 * Only explicit bookmarks are reported. A follow that stops matching is not
 * a loss — nothing was ever saved by hand.
 */
export function unresolvedBookmarks(program: Program, state: StoredState): string[] {
  return state.bookmarks.filter((id) => {
    if (program.bySatelliteId.has(id)) return false;
    const pr = program.byPresentationId.get(id);
    if (!pr) return true;
    return !program.sessions.has(pr.sessionId) || !program.byPaperId.has(pr.paperId);
  });
}
