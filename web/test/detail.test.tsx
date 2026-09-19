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
