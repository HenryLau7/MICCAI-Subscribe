export type PresentationKind = 'poster' | 'oral' | 'spotlight';
export type SessionKind = 'poster' | 'oral';
export type SatelliteType = 'workshop' | 'challenge' | 'tutorial';

export interface Paper {
  id: string;                 // 展板号，例如 M-PM-001
  title: string;
  authors: string[];
  presenters: string[];
  affiliation: string;
  affiliationKey: string;
  country: string;
  presentationIds: string[];
}

export interface Presentation {
  id: string;                 // 派生：poster -> paperId，其余 -> `${paperId}:oral`
  paperId: string;
  kind: PresentationKind;
  sessionId: string;
  orderInSession: number;     // 0 表示无
}

export interface Session {
  id: string;
  kind: SessionKind;
  name: string;
  start: string;              // ISO，永远带 +02:00
  end: string;
  room: string;               // poster session 为 ''
  chairs: string[];
}

export interface SatelliteEvent {
  id: string;
  acronym: string;
  name: string;
  type: SatelliteType;
  theme: string;
  room: string;
  floor: string;
  start: string;
  end: string;
  url: string;
}

export interface Author { id: string; name: string; paperIds: string[]; affiliations: string[]; }
export interface Affiliation { id: string; name: string; country: string; paperIds: string[]; }

export interface ProgramMeta {
  conference: string; venue: string; timezone: string;
  schemaVersion: number; sourceRevision: string;
  fetchedAt: string; generatedAt: string;
}

export interface Program {
  meta: ProgramMeta;
  papers: Paper[];
  byPaperId: Map<string, Paper>;
  presentations: Presentation[];
  byPresentationId: Map<string, Presentation>;
  sessions: Map<string, Session>;
  satellite: SatelliteEvent[];
  bySatelliteId: Map<string, SatelliteEvent>;
  authors: Map<string, Author>;
  affiliations: Map<string, Affiliation>;
}
