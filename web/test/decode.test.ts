import { describe, it, expect } from 'vitest';
import { decodeProgram, type MinBundle } from '../src/data/decode';
import raw from '../public/data/program.min.json';

const program = decodeProgram(raw as never);

describe('decodeProgram', () => {
  it('decodes every paper', () => {
    expect(program.papers).toHaveLength(1165);
  });

  it('resolves dictionary-encoded author names', () => {
    const p = program.byPaperId.get('M-PM-001')!;
    expect(p.title).toBe('Automatic LV Localization and Short-Axis Plane Estimation from Arbitrary CMR Slice');
    expect(p.authors).toEqual(['Yi Yu','Yixuan Liu','Ziyu Zhang','Parker Martin','Zhenyu Bu','Yuchi Han','Yuan Xue']);
    expect(p.presenters).toEqual(['Yuan Xue']);
    expect(p.affiliation).toBe('The Ohio State University');
    expect(p.country).toBe('United States');
  });

  it('derives presentation ids: poster keeps the board number, talks get :oral', () => {
    const ids = program.presentations
      .filter((pr) => pr.paperId === 'M-PM-042')
      .map((pr) => pr.id)
      .sort();
    expect(ids).toEqual(['M-PM-042', 'M-PM-042:oral']);
  });

  it('links presentations to sessions', () => {
    const oral = program.presentations.find((pr) => pr.id === 'M-PM-042:oral')!;
    expect(oral.kind).toBe('oral');
    expect(program.sessions.get(oral.sessionId)!.room).toBe('Erasme Hall');
  });

  it('builds an author index that merges co-authorship', () => {
    const a = program.authors.get('wen-yan')!;
    expect(a.name).toBe('Wen Yan');
    expect(a.paperIds).toContain('M-PM-042');
  });

  it('builds an affiliation index keyed by affiliation_key', () => {
    const f = program.affiliations.get('ohio-state-university')!;
    expect(f.paperIds).toContain('M-PM-001');
  });

  it('keeps poster session rooms empty rather than inventing one', () => {
    expect(program.sessions.get('P1')!.room).toBe('');
  });

  it('keeps only absolute http(s) organizer links', () => {
    // An organizer link is rendered as an external <a href> and written into
    // the .ics URL property, which RFC 5545 leaves unescaped. The importer
    // already refuses anything else, but the bundle is the app's untrusted
    // input: a relative path points the "organizer website" button back at
    // this app (the shipped iMIMIC contact-link bug), and a non-http scheme
    // or an embedded newline turns a link into an injection.
    const row = (id: string, url: string): MinBundle['satellite'][number] =>
      [id, 'X', 'Event X', 'workshop', '', 'Rome', '1',
       '2026-09-27T08:00:00+02:00', '2026-09-27T09:00:00+02:00', url];
    const links = [
      'https://example.org/w', 'http://example.org/w', '/cdn-cgi/l/email-protection#7a',
      'javascript:alert(1)', 'https://example.org/w\r\nBEGIN:VEVENT', 'example.org/w', '',
    ];
    const decoded = decodeProgram({
      ...(raw as unknown as MinBundle),
      satellite: links.map((url, i) => row(`sat:${i}`, url)),
    });
    expect(decoded.satellite.map((e) => e.url)).toEqual(
      ['https://example.org/w', 'http://example.org/w', '', '', '', '', ''],
    );
  });

  it('decodes satellite events', () => {
    expect(program.satellite).toHaveLength(111);
    const cdmri = program.satellite.find((e) => e.acronym === 'CDMRI')!;
    expect(cdmri.room).toBe('Adeanauer');
    expect(cdmri.start).toBe('2026-09-27T08:00:00+02:00');
  });
});
