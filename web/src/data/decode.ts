import type {
  Affiliation, Author, Paper, Presentation, Program, ProgramMeta,
  PresentationKind, SatelliteEvent, Session, SessionKind,
} from './types';

export interface MinBundle {
  meta: { conference: string; venue: string; timezone: string; schema_version: number;
          source_revision: string; fetched_at: string; generated_at: string };
  kinds: PresentationKind[];
  names: string[];
  affiliations: string[];
  papers: [string, string, number[], number[], number, string, string][];
  presentations: [string, number, string, number][];
  sessions: [string, string, string, string, string, string, string[]][];
  satellite: [string, string, string, string, string, string, string, string, string, string][];
}

export const SUPPORTED_SCHEMA = 1;

/** Presentation ids are derived, never stored. Keep this the single source of truth. */
export function presentationId(paperId: string, kind: PresentationKind): string {
  return kind === 'poster' ? paperId : `${paperId}:oral`;
}

export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function decodeProgram(raw: MinBundle): Program {
  if (raw.meta.schema_version !== SUPPORTED_SCHEMA) {
    throw new Error(
      `program.min.json schema ${raw.meta.schema_version} is not supported (expected ${SUPPORTED_SCHEMA})`,
    );
  }

  const meta: ProgramMeta = {
    conference: raw.meta.conference,
    venue: raw.meta.venue,
    timezone: raw.meta.timezone,
    schemaVersion: raw.meta.schema_version,
    sourceRevision: raw.meta.source_revision,
    fetchedAt: raw.meta.fetched_at,
    generatedAt: raw.meta.generated_at,
  };

  const papers: Paper[] = raw.papers.map(
    ([id, title, authorIdx, presenterIdx, affIdx, country, affKey]) => ({
      id,
      title,
      authors: authorIdx.map((i) => raw.names[i]),
      presenters: presenterIdx.map((i) => raw.names[i]),
      affiliation: affIdx >= 0 ? raw.affiliations[affIdx] : '',
      affiliationKey: affKey,
      country,
      presentationIds: [],
    }),
  );
  const byPaperId = new Map(papers.map((p) => [p.id, p]));

  const presentations: Presentation[] = raw.presentations.map(
    ([paperId, kindIdx, sessionId, order]) => {
      const kind = raw.kinds[kindIdx];
      return { id: presentationId(paperId, kind), paperId, kind, sessionId, orderInSession: order };
    },
  );
  for (const pr of presentations) byPaperId.get(pr.paperId)?.presentationIds.push(pr.id);
  const byPresentationId = new Map(presentations.map((pr) => [pr.id, pr]));

  const sessions = new Map<string, Session>(
    raw.sessions.map(([id, kind, name, start, end, room, chairs]) => [
      id, { id, kind: kind as SessionKind, name, start, end, room, chairs },
    ]),
  );

  const satellite: SatelliteEvent[] = raw.satellite.map(
    ([id, acronym, name, type, theme, room, floor, start, end, url]) => ({
      id, acronym, name, type: type as SatelliteEvent['type'], theme, room, floor, start, end, url,
    }),
  );
  const bySatelliteId = new Map(satellite.map((e) => [e.id, e]));

  const authors = new Map<string, Author>();
  const affiliations = new Map<string, Affiliation>();
  for (const p of papers) {
    const seen = new Set<string>();
    for (const name of [...p.authors, ...p.presenters]) {
      const id = slugifyName(name);
      if (!id) continue;
      let a = authors.get(id);
      if (!a) { a = { id, name, paperIds: [], affiliations: [] }; authors.set(id, a); }
      if (!seen.has(id)) { a.paperIds.push(p.id); seen.add(id); }
    }
    for (const name of p.presenters) {
      const a = authors.get(slugifyName(name));
      if (a && p.affiliation && !a.affiliations.includes(p.affiliation)) a.affiliations.push(p.affiliation);
    }
    if (p.affiliationKey) {
      let f = affiliations.get(p.affiliationKey);
      if (!f) {
        f = { id: p.affiliationKey, name: p.affiliation, country: p.country, paperIds: [] };
        affiliations.set(p.affiliationKey, f);
      }
      f.paperIds.push(p.id);
    }
  }

  return { meta, papers, byPaperId, presentations, byPresentationId,
           sessions, satellite, bySatelliteId, authors, affiliations };
}
