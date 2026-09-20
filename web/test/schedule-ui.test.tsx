import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConflictBadge } from '../src/ui/ConflictBadge';
import { ScheduleItemRow } from '../src/ui/ScheduleItemRow';
import { Schedule } from '../src/routes/Schedule';
import { StoreProvider } from '../src/store/StoreProvider';
import { ProgramProvider } from '../src/ui/ProgramContext';
import { STORAGE_KEY, defaultState, type StoredState } from '../src/store/storage';
import { decodeProgram } from '../src/data/decode';
import type { ScheduleItem } from '../src/store/schedule';
import raw from '../public/data/program.min.json';

// Stub the network boundary (loadProgram), not our own logic — same pattern as detail.test.tsx.
vi.mock('../src/data/load', () => ({ loadProgram: vi.fn() }));
import { loadProgram } from '../src/data/load';

const mockedLoadProgram = vi.mocked(loadProgram);
const program = decodeProgram(raw as never);

// --- ConflictBadge --------------------------------------------------------
// (required by the task brief verbatim)

describe('ConflictBadge', () => {
  it('renders nothing when there is no conflict', () => {
    const { container } = render(<ConflictBadge conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('calls a same-poster-session overlap what it is, not a conflict', () => {
    render(<ConflictBadge conflicts={[{ level: 'same-poster-session', withKey: 'x' }]} />);
    expect(screen.getByText(/same poster session/i)).toBeInTheDocument();
    expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument();
  });
  it('shows a hard conflict for two overlapping talks', () => {
    render(<ConflictBadge conflicts={[{ level: 'hard', withKey: 'x' }]} />);
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
  });
  it('shows partial overlap for a talk against a poster session', () => {
    render(<ConflictBadge conflicts={[{ level: 'soft', withKey: 'x' }]} />);
    expect(screen.getByText(/partial overlap/i)).toBeInTheDocument();
  });
  it('shows the most severe level when several apply', () => {
    render(
      <ConflictBadge
        conflicts={[
          { level: 'same-poster-session', withKey: 'a' },
          { level: 'hard', withKey: 'b' },
        ]}
      />,
    );
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
  });
  it('picks the most severe level regardless of input order (soft before hard)', () => {
    // Guards against an implementation that just takes conflicts[0] instead
    // of actually ranking severity.
    render(
      <ConflictBadge
        conflicts={[
          { level: 'soft', withKey: 'a' },
          { level: 'hard', withKey: 'b' },
        ]}
      />,
    );
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
    expect(screen.queryByText(/partial overlap/i)).not.toBeInTheDocument();
  });
});

// --- ScheduleItemRow --------------------------------------------------------

const SESSION = program.sessions.get('O1A')!;
const PRESENTATION = program.presentations.find((p) => p.sessionId === 'O1A' && p.kind !== 'poster')!;
const PAPER = program.byPaperId.get(PRESENTATION.paperId)!;

function bookmarkedItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    key: PRESENTATION.id,
    source: 'bookmark',
    sourceLabel: '',
    presentation: PRESENTATION,
    paper: PAPER,
    session: SESSION,
    start: SESSION.start,
    end: SESSION.end,
    conflicts: [],
    ...overrides,
  };
}

function followItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    key: PRESENTATION.id,
    source: 'author',
    sourceLabel: 'Jane Doe',
    presentation: PRESENTATION,
    paper: PAPER,
    session: SESSION,
    start: SESSION.start,
    end: SESSION.end,
    conflicts: [],
    ...overrides,
  };
}

function renderRow(item: ScheduleItem) {
  return render(
    <MemoryRouter>
      <StoreProvider>
        <ScheduleItemRow item={item} />
      </StoreProvider>
    </MemoryRouter>,
  );
}

describe('ScheduleItemRow', () => {
  beforeEach(() => localStorage.clear());

  it('shows a bookmarked row as removable, with no exclude control and no follow-source label', () => {
    renderRow(bookmarkedItem());
    // BookmarkButton reflects the actual bookmark state: starts unbookmarked
    // here since the row's presence in the schedule doesn't itself write to
    // localStorage, so seed it first via toggling the visible button.
    const star = screen.getByRole('button', { name: /^bookmark$/i });
    fireEvent.click(star);
    expect(screen.getByRole('button', { name: /remove bookmark/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /exclude/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/from your follow/i)).not.toBeInTheDocument();
  });

  it('shows a follow-derived row with its source label and an exclude control, never a remove-bookmark state', () => {
    renderRow(followItem());
    expect(screen.getByText(/from your follow: jane doe/i)).toBeInTheDocument();
    const excludeBtn = screen.getByRole('button', { name: /exclude/i });
    expect(excludeBtn).toBeInTheDocument();
    // The bookmark star must still read "Bookmark" (off), never "Remove
    // bookmark" — this row isn't in state.bookmarks (collect() guarantees an
    // explicit bookmark always wins as the source), and toggleExcluded is a
    // deliberate no-op on bookmarked items, so a "remove bookmark" reading
    // here would be actively misleading.
    expect(screen.getByRole('button', { name: /^bookmark$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove bookmark/i })).not.toBeInTheDocument();
  });

  it('wires the follow-source text to the exclude button as its accessible description', () => {
    // Same rule as FollowButton: explanatory text next to a control
    // must be reachable via aria-describedby, not left as a bare sibling a
    // screen-reader user tabbing straight to the button would miss.
    renderRow(followItem());
    expect(
      screen.getByRole('button', { name: /exclude from schedule/i, description: 'From your follow: Jane Doe' }),
    ).toBeInTheDocument();
  });

  it('removes itself from the store\'s excluded set toggling once clicking exclude', () => {
    renderRow(followItem({ key: 'M-PM-999:oral' }));
    fireEvent.click(screen.getByRole('button', { name: /exclude/i }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as StoredState;
    expect(stored.excluded).toContain('M-PM-999:oral');
  });

  it('renders the conflict badge distinctly per tier and never says "conflict" for same-poster-session', () => {
    const { rerender } = render(
      <MemoryRouter>
        <StoreProvider>
          <ScheduleItemRow item={bookmarkedItem({ conflicts: [{ level: 'hard', withKey: 'x' }] })} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <StoreProvider>
          <ScheduleItemRow item={bookmarkedItem({ conflicts: [{ level: 'soft', withKey: 'x' }] })} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/partial overlap/i)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <StoreProvider>
          <ScheduleItemRow
            item={bookmarkedItem({ conflicts: [{ level: 'same-poster-session', withKey: 'x' }] })}
          />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/same poster session/i)).toBeInTheDocument();
    expect(screen.queryByText(/conflict/i)).not.toBeInTheDocument();
  });

  it('shows the poster board number and states the hall is not published, never inventing a room', () => {
    const posterPresentation = program.presentations.find((p) => p.kind === 'poster')!;
    const posterPaper = program.byPaperId.get(posterPresentation.paperId)!;
    const posterSession = program.sessions.get(posterPresentation.sessionId)!;
    expect(posterSession.room).toBe('');
    renderRow(
      bookmarkedItem({
        key: posterPresentation.id,
        presentation: posterPresentation,
        paper: posterPaper,
        session: posterSession,
        start: posterSession.start,
        end: posterSession.end,
      }),
    );
    expect(screen.getByText(new RegExp(`board ${posterPaper.id}`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/hall not published/i)).toBeInTheDocument();
  });

  it("shows the row's activity-type badge with its own text label, for both a presentation and a satellite event", () => {
    // Type-coding rule: colour is never the sole distinguishing means, so
    // the text label (not just a colour swatch) must be genuinely present —
    // asserted here against the real fixture's actual kind, whichever of
    // oral/spotlight/poster PRESENTATION happens to be, not a guessed value.
    const KIND_TEXT: Record<string, string> = { oral: 'Oral', spotlight: 'Spotlight', poster: 'Poster' };
    renderRow(bookmarkedItem());
    expect(screen.getByText(KIND_TEXT[PRESENTATION.kind])).toBeInTheDocument();

    const satelliteEvent = program.satellite[0];
    const { unmount } = renderRow({
      key: satelliteEvent.id,
      source: 'bookmark',
      sourceLabel: '',
      satellite: satelliteEvent,
      start: satelliteEvent.start,
      end: satelliteEvent.end,
      conflicts: [],
    });
    const TYPE_TEXT: Record<string, string> = { workshop: 'Workshop', challenge: 'Challenge', tutorial: 'Tutorial' };
    expect(screen.getByText(TYPE_TEXT[satelliteEvent.type])).toBeInTheDocument();
    unmount();
  });
});

// --- Schedule page ----------------------------------------------------------

async function renderSchedule(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(
    <MemoryRouter initialEntries={['/schedule']}>
      <StoreProvider>
        <ProgramProvider>
          <Schedule />
        </ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
  // ProgramProvider loads asynchronously; wait for the real page past its
  // loading spinner before asserting anything.
  await screen.findByRole('heading', { level: 1, name: /my schedule/i });
}

function selectedTabLabel() {
  const tabs = screen.getAllByRole('tab');
  const selected = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  return selected?.id;
}

describe('Schedule page', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedLoadProgram.mockResolvedValue(program);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('pins "today" to Europe/Paris regardless of the device timezone (TZ=Asia/Shanghai, 23:30 Paris on conference day 1)', async () => {
    // At 2026-09-28T21:30:00Z it's 23:30 in Paris (still day 1), but a naive
    // device-local "today" under an eastern timezone would already read
    // 2026-09-29. TZ is pinned *inside the test* via vi.stubEnv — this must
    // hold regardless of what TZ the invoking shell (or CI runner) has, not
    // merely when this file happens to be run under one out-of-band. Only
    // Date is faked (not setTimeout) so React Testing Library's own async
    // polling still runs normally.
    vi.stubEnv('TZ', 'Asia/Shanghai');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T21:30:00Z'));

    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(selectedTabLabel()).toBe('day-tab-2026-09-28');
  });

  it('pins "today" to Europe/Paris regardless of the device timezone (TZ=Pacific/Kiritimati, 23:30 Paris on conference day 1)', async () => {
    // Same case as above, but under the project's other named TZ
    // (Pacific/Kiritimati, UTC+14 — one of the furthest-ahead timezones that
    // exists), so the two tests pin genuinely different device timezones
    // rather than both defaulting to whatever TZ the invoking shell has.
    vi.stubEnv('TZ', 'Pacific/Kiritimati');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T21:30:00Z'));

    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(selectedTabLabel()).toBe('day-tab-2026-09-28');
  });

  it('falls back to the first day with items when "today" is outside the conference window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z')); // weeks before the conference

    const p2Presentation = program.presentations.find((p) => p.sessionId === 'P2')!;
    const p3Presentation = program.presentations.find((p) => p.sessionId === 'P3')!;
    await renderSchedule({ ...defaultState(), bookmarks: [p3Presentation.id, p2Presentation.id] });
    // Both P2 and P3 are on 2026-09-29 — this just proves it lands on a day
    // with content, not day 1 (2026-09-27), which has neither bookmark.
    expect(selectedTabLabel()).toBe('day-tab-2026-09-29');
  });

  it('falls back to day 1 when "today" is outside the conference window and nothing is scheduled', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    await renderSchedule(defaultState());
    expect(selectedTabLabel()).toBe('day-tab-2026-09-27');
  });

  it('shows the empty state with a way to find papers when the selected day has nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    await renderSchedule(defaultState());
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText(/nothing scheduled/i)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /find papers/i })).toHaveAttribute('href', '/search');
  });

  it("sorts a day's items by start time and switches days on tab click", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T09:00:00Z')); // conference day 1, before O1A starts
    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-042:oral', 'M-PM-001'] });

    const panel = screen.getByRole('tabpanel');
    // O1A oral (10:30) must render before the P1 poster (16:00).
    const rows = within(panel).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/10:30/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/16:00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /tue 29/i }));
    expect(selectedTabLabel()).toBe('day-tab-2026-09-29');
  });

  it('does not offer an exclude control on a bookmarked row, and offers one on a genuinely follow-derived row on the same day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
    // M-PM-001 is authored by yuan-xue but also explicitly bookmarked — the
    // bookmark must win as the source (per collect() in schedule.ts). Also
    // follow yiqiang-zhan, a co-author (never presenter) on M-PM-002, a
    // *different* day-1 poster nobody bookmarked — that row is genuinely
    // follow-derived, so both branches of ScheduleItemRow's trailing control
    // are actually exercised in this test, not just asserted-absent on one.
    await renderSchedule({
      ...defaultState(),
      bookmarks: ['M-PM-001'],
      followedAuthors: ['yuan-xue', 'yiqiang-zhan'],
    });

    const panel = screen.getByRole('tabpanel');
    const bookmarkedPaper = program.byPaperId.get('M-PM-001')!;
    const followedPaper = program.byPaperId.get('M-PM-002')!;

    // Positive: both rows are actually present. Without this, a bug that
    // dropped the bookmarked item from the schedule entirely (e.g. wrongly
    // applying the exclusion check to a bookmark — the exact earlier bug
    // collect() guards against) would leave every "absent" assertion below
    // vacuously true.
    const bookmarkedRow = within(panel).getByText(bookmarkedPaper.title).closest('li')!;
    const followedRow = within(panel).getByText(followedPaper.title).closest('li')!;
    expect(bookmarkedRow).toBeInTheDocument();
    expect(followedRow).toBeInTheDocument();

    // Bookmarked row: reachable remove-bookmark control, no exclude, no
    // follow-source label.
    expect(within(bookmarkedRow).getByRole('button', { name: /remove bookmark/i })).toBeInTheDocument();
    expect(within(bookmarkedRow).queryByRole('button', { name: /exclude/i })).not.toBeInTheDocument();
    expect(within(bookmarkedRow).queryByText(/from your follow/i)).not.toBeInTheDocument();

    // Follow-derived row: source label, exclude control, and the bookmark
    // star must read "Bookmark" (off) rather than "Remove bookmark".
    expect(within(followedRow).getByText(/from your follow: yiqiang zhan/i)).toBeInTheDocument();
    expect(within(followedRow).getByRole('button', { name: /exclude/i })).toBeInTheDocument();
    expect(within(followedRow).getByRole('button', { name: /^bookmark$/i })).toBeInTheDocument();
    expect(within(followedRow).queryByRole('button', { name: /remove bookmark/i })).not.toBeInTheDocument();
  });

  it('moves focus and selection across day tabs with the arrow keys (roving tabindex), wrapping at both ends', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z')); // outside the conference window -> day 1 selected
    await renderSchedule(defaultState());

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    tabs[0].focus();
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('tabindex', '0');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[0]).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    // Wraps backward from the first tab to the last.
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(tabs[4]).toHaveFocus();
    expect(tabs[4]).toHaveAttribute('aria-selected', 'true');

    // End jumps straight to the last tab; Home jumps straight to the first.
    fireEvent.keyDown(tabs[4], { key: 'Home' });
    expect(tabs[0]).toHaveFocus();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(tabs[4]).toHaveFocus();
    expect(tabs[4]).toHaveAttribute('aria-selected', 'true');
  });
});
