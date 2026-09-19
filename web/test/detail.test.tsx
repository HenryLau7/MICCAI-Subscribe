import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactElement } from 'react';
import { StoreProvider } from '../src/store/StoreProvider';
import { FollowButton } from '../src/ui/FollowButton';
import { PaperDetail } from '../src/routes/PaperDetail';
import { AuthorDetail } from '../src/routes/AuthorDetail';
import { AffiliationDetail } from '../src/routes/AffiliationDetail';
import { SessionDetail } from '../src/routes/SessionDetail';
import { STORAGE_KEY } from '../src/store/storage';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

// Stub the network boundary (loadProgram), not our own logic — same pattern as ProgramContext.test.tsx.
vi.mock('../src/data/load', () => ({ loadProgram: vi.fn() }));
import { loadProgram } from '../src/data/load';
import { ProgramProvider } from '../src/ui/ProgramContext';

const mockedLoadProgram = vi.mocked(loadProgram);
const program = decodeProgram(raw as never);

// Real papers with known shapes, picked from the decoded program so a broken
// implementation can't be "fixed" by relaxing an assertion.
const MULTI_KIND_PAPER_ID = 'M-PM-042'; // has both a poster and an oral presentation
const AUTHOR_SLUG = 'yuan-xue'; // has 2 papers in the program
const SESSION_WITH_ORDER = 'O1A'; // oral session with several ordered talks

const MULTI_INSTITUTION_AUTHOR_SLUG = 'guang-yang'; // 10 papers, 7 distinct affiliations after normalization
// Never a presenter on any of their 2 papers, so Author.affiliations (decode.ts) is empty —
// this is the specific 80.5%-of-authors case the hint fix covers.
const NON_PRESENTER_AUTHOR_SLUG = 'yiqiang-zhan';
// 9 papers; one raw affiliation is "University of Liverpool", another is the bare-lowercase
// "university of liverpool" — a pure casing duplicate that normalization must collapse to one.
const CASING_DUPLICATE_AUTHOR_SLUG = 'yitian-zhao';
// 8 papers, 7 distinct (short-named) institutions — the hint for this one stays under 200
// characters even with all 3 named slots used, unlike some other multi-institution authors
// whose institution names are themselves long (see the fix-round-2 report for real examples).
const MANY_SHORT_INSTITUTIONS_AUTHOR_SLUG = 'shuo-li';

beforeEach(() => {
  localStorage.clear();
  mockedLoadProgram.mockResolvedValue(program);
});

function renderAt(path: string, route: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <ProgramProvider>
          <Routes>
            <Route path={route} element={element} />
          </Routes>
        </ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
}

describe('FollowButton', () => {
  it('states the homonym limitation next to the control', () => {
    render(
      <StoreProvider>
        <FollowButton kind="author" id="yuan-xue" label="Yuan Xue" hint="The Ohio State University" />
      </StoreProvider>,
    );
    const btn = screen.getByRole('button', { name: /follow/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    // The institution must be visible, because same-name authors can't be told apart.
    expect(screen.getByText(/The Ohio State University/)).toBeInTheDocument();
  });

  it('toggles follow state', () => {
    render(
      <StoreProvider>
        <FollowButton kind="author" id="yuan-xue" label="Yuan Xue" hint="" />
      </StoreProvider>,
    );
    const btn = screen.getByRole('button', { name: /follow/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PaperDetail', () => {
  it('renders every presentation of a paper that has both a poster and an oral talk', async () => {
    const paper = program.byPaperId.get(MULTI_KIND_PAPER_ID)!;
    expect(paper.presentationIds.length).toBe(2); // sanity: fixture really is multi-kind

    renderAt(`/paper/${MULTI_KIND_PAPER_ID}`, '/paper/:id', <PaperDetail />);

    expect(await screen.findByRole('heading', { level: 1, name: paper.title })).toBeInTheDocument();
    // One row per presentation id — both the poster session and the oral session must show up.
    const posterSession = program.sessions.get(program.byPresentationId.get(paper.presentationIds[0])!.sessionId)!;
    const oralSession = program.sessions.get(program.byPresentationId.get(paper.presentationIds[1])!.sessionId)!;
    expect(screen.getByText(posterSession.name)).toBeInTheDocument();
    expect(screen.getByText(oralSession.name)).toBeInTheDocument();
    // Board number always shown, never a fabricated abstract or link.
    expect(screen.getByText(paper.id)).toBeInTheDocument();
    expect(screen.queryByText(/abstract/i)).not.toBeInTheDocument();
  });

  it('gives each presentation its own bookmark toggle', async () => {
    const paper = program.byPaperId.get(MULTI_KIND_PAPER_ID)!;
    renderAt(`/paper/${MULTI_KIND_PAPER_ID}`, '/paper/:id', <PaperDetail />);
    await screen.findByRole('heading', { level: 1, name: paper.title });
    const bookmarkButtons = screen.getAllByRole('button', { name: /bookmark/i });
    expect(bookmarkButtons).toHaveLength(paper.presentationIds.length);
  });

  it('shows "not found" for an unknown board number instead of crashing', async () => {
    renderAt('/paper/NOPE', '/paper/:id', <PaperDetail />);
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});

describe('AuthorDetail', () => {
  it("surfaces all of the followed author's papers and states the homonym limitation", async () => {
    const author = program.authors.get(AUTHOR_SLUG)!;
    expect(author.paperIds.length).toBeGreaterThan(1); // sanity: fixture really has >1 paper

    renderAt(`/author/${AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);

    expect(await screen.findByRole('heading', { level: 1, name: author.name })).toBeInTheDocument();
    expect(screen.getByText(/cannot be told apart|can't be told apart|same name/i)).toBeInTheDocument();
    for (const pid of author.paperIds) {
      const paper = program.byPaperId.get(pid)!;
      expect(screen.getByText(paper.title)).toBeInTheDocument();
    }
  });

  it('toggling follow flips aria-pressed and persists to localStorage', async () => {
    renderAt(`/author/${AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    const btn = await screen.findByRole('button', { name: /follow/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored.followedAuthors).toContain(AUTHOR_SLUG);
  });

  it('discloses institutions by name for an author whose papers span several, without a count claim', async () => {
    const author = program.authors.get(MULTI_INSTITUTION_AUTHOR_SLUG)!;
    const papers = author.paperIds.map((pid) => program.byPaperId.get(pid)!);
    const distinctAffiliations = new Set(papers.map((p) => p.affiliation).filter(Boolean));
    expect(distinctAffiliations.size).toBeGreaterThan(3); // sanity: fixture really spans several

    renderAt(`/author/${MULTI_INSTITUTION_AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    await screen.findByRole('heading', { level: 1, name: author.name });

    // Scope to the follow hint itself — the same institution names also legitimately
    // appear inside each paper's own PaperCard further down the page.
    const btn = screen.getByRole('button', { name: /follow/i });
    const hint = btn.parentElement!.querySelector('span')!.textContent!;
    // Naming institutions is fine; asserting a specific count of them is not — the cheap
    // normalization can't reliably tell how many truly-distinct institutions there are.
    expect(hint).not.toMatch(/\d+ different institutions/);
    expect(hint).toMatch(/several institutions/);
    expect(hint).toMatch(/University of Cambridge/);
    expect(hint).toMatch(/and \d+ more/);
  });

  it('collapses a case-only affiliation duplicate into a single entry', async () => {
    const author = program.authors.get(CASING_DUPLICATE_AUTHOR_SLUG)!;
    const papers = author.paperIds.map((pid) => program.byPaperId.get(pid)!);
    const bareLiverpoolVariants = new Set(
      papers.map((p) => p.affiliation).filter((a) => /^university of liverpool$/i.test(a)),
    );
    expect(bareLiverpoolVariants.size).toBeGreaterThan(1); // sanity: fixture really has the casing collision

    renderAt(`/author/${CASING_DUPLICATE_AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    await screen.findByRole('heading', { level: 1, name: author.name });

    // The header's institution list shows every deduped entry (unlike the capped hint),
    // so it's the right place to check the casing pair actually collapsed to one.
    const header = screen.getByRole('heading', { level: 1 }).closest('header')!;
    const items = within(header)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    const bareLiverpoolEntries = items.filter((t) => /^university of liverpool$/i.test(t));
    expect(bareLiverpoolEntries).toHaveLength(1);
  });

  it('caps the hint at 3 named institutions plus an "and N more" tail, and keeps it short', async () => {
    const author = program.authors.get(MANY_SHORT_INSTITUTIONS_AUTHOR_SLUG)!;
    renderAt(`/author/${MANY_SHORT_INSTITUTIONS_AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    await screen.findByRole('heading', { level: 1, name: author.name });

    const btn = screen.getByRole('button', { name: /follow/i });
    const hint = btn.parentElement!.querySelector('span')!.textContent!;
    expect(hint).toMatch(/Tongji University/);
    expect(hint).toMatch(/Harbin Institute of Technology/);
    expect(hint).toMatch(/Fudan University/);
    expect(hint).toMatch(/and 4 more/);
    // The 4th distinct institution must be folded into "and N more", never named.
    expect(hint).not.toMatch(/Case Western Reserve University/);
    expect(hint.length).toBeLessThan(200);
  });

  it('never asserts a specific institution count in any author hint', async () => {
    for (const slug of [MULTI_INSTITUTION_AUTHOR_SLUG, MANY_SHORT_INSTITUTIONS_AUTHOR_SLUG, CASING_DUPLICATE_AUTHOR_SLUG]) {
      const author = program.authors.get(slug)!;
      const result = renderAt(`/author/${slug}`, '/author/:slug', <AuthorDetail />);
      await screen.findByRole('heading', { level: 1, name: author.name });
      const btn = screen.getByRole('button', { name: /follow/i });
      const hint = btn.parentElement!.querySelector('span')!.textContent!;
      expect(hint).not.toMatch(/\d+ different institutions/);
      result.unmount();
    }
  });

  it('states a single institution plainly for an author with exactly one', async () => {
    const author = program.authors.get(AUTHOR_SLUG)!; // yuan-xue: 2 papers, 1 institution
    renderAt(`/author/${AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    await screen.findByRole('heading', { level: 1, name: author.name });

    expect(screen.getByText(/Appears on 2 papers, presented from The Ohio State University\./)).toBeInTheDocument();
    // Must never claim it's the person's own institution.
    expect(screen.queryByText(/works at|affiliated with/i)).not.toBeInTheDocument();
  });

  it('shows a non-empty follow hint even when Author.affiliations is empty (the 80.5% case)', async () => {
    const author = program.authors.get(NON_PRESENTER_AUTHOR_SLUG)!;
    expect(author.affiliations).toHaveLength(0); // sanity: fixture really hits the broken case

    renderAt(`/author/${NON_PRESENTER_AUTHOR_SLUG}`, '/author/:slug', <AuthorDetail />);
    await screen.findByRole('heading', { level: 1, name: author.name });

    const btn = screen.getByRole('button', { name: /follow/i });
    const hint = btn.parentElement!.querySelector('span');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).not.toBe('');
    expect(hint!.textContent).toMatch(/ShanghaiTech University/);
  });
});

describe('AffiliationDetail', () => {
  it("lists the institution's papers and offers a follow control", async () => {
    const affiliation = [...program.affiliations.values()].find((a) => a.paperIds.length > 1)!;
    renderAt(`/affiliation/${affiliation.id}`, '/affiliation/:key', <AffiliationDetail />);
    expect(await screen.findByRole('heading', { level: 1, name: affiliation.name })).toBeInTheDocument();
    const first = program.byPaperId.get(affiliation.paperIds[0])!;
    expect(screen.getByText(first.title)).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /follow/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('SessionDetail', () => {
  it('lists every presentation in the session, ordered by orderInSession', async () => {
    const session = program.sessions.get(SESSION_WITH_ORDER)!;
    const inSession = program.presentations.filter((pr) => pr.sessionId === SESSION_WITH_ORDER);
    expect(inSession.length).toBeGreaterThan(1); // sanity: fixture really has several talks

    // O1A interleaves an oral track and a spotlight track, each numbered 1..6 on its own —
    // so in the RAW (unsorted) presentation array, M-PM-042 (oral, orderInSession 6) sits
    // right before T-PM-017 (spotlight, orderInSession 1 in O1A; T-PM-017 also has an unrelated
    // poster presentation elsewhere, orderInSession 0). Only a correct sort-by-orderInSession
    // puts T-PM-017 ahead of M-PM-042; picking two same-track entries wouldn't catch a dropped
    // sort, since same-track entries already happen to be pre-sorted in the source data.
    const earlyOrderPaper = program.byPaperId.get('T-PM-017')!;
    const lateOrderPaper = program.byPaperId.get('M-PM-042')!;
    const earlyPr = inSession.find((pr) => pr.paperId === earlyOrderPaper.id)!;
    const latePr = inSession.find((pr) => pr.paperId === lateOrderPaper.id)!;
    expect(earlyPr.orderInSession).toBe(1);
    expect(latePr.orderInSession).toBe(6);

    renderAt(`/session/${SESSION_WITH_ORDER}`, '/session/:id', <SessionDetail />);

    expect(await screen.findByRole('heading', { level: 1, name: session.name })).toBeInTheDocument();
    const list = screen.getByRole('heading', { name: /presentations/i }).closest('section')!;
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(inSession.length);

    const earlyIdx = rows.findIndex((row) => within(row).queryByText(earlyOrderPaper.title));
    const lateIdx = rows.findIndex((row) => within(row).queryByText(lateOrderPaper.title));
    expect(earlyIdx).toBeGreaterThanOrEqual(0);
    expect(earlyIdx).toBeLessThan(lateIdx);
  });
});
