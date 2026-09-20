/**
 * Regression guards for claims the UI makes about itself.
 *
 * The project's headline commitment is that it never invents data and never
 * overpromises. Those are one-line strings, which makes them exactly the
 * thing a later edit can quietly break, so each is pinned here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { About } from '../src/routes/About';
import { Schedule } from '../src/routes/Schedule';
import { StoreProvider } from '../src/store/StoreProvider';
import { ProgramProvider } from '../src/ui/ProgramContext';
import { STORAGE_KEY, defaultState, type StoredState } from '../src/store/storage';
import { decodeProgram } from '../src/data/decode';
import raw from '../public/data/program.min.json';

vi.mock('../src/data/load', () => ({ loadProgram: vi.fn() }));
import { loadProgram } from '../src/data/load';

const mockedLoadProgram = vi.mocked(loadProgram);
const program = decodeProgram(raw as never);

beforeEach(() => {
  localStorage.clear();
  mockedLoadProgram.mockResolvedValue(program);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

async function renderRoute(node: React.ReactNode, path: string, heading: RegExp) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <ProgramProvider>{node}</ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: heading });
}

describe('the 404 route does not tell users the app is unfinished', () => {
  // _redirects rewrites /* to index.html, so every typo, stale link and
  // misread QR code lands here. "Not built yet" would be false on a shipped
  // product and is the first thing a lost user reads.
  it('says the page does not exist, not that the section is unbuilt', async () => {
    window.history.pushState({}, '', '/no-such-page');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument();
    expect(screen.queryByText(/isn’t built yet|isn't built yet|check back soon|coming soon/i)).toBeNull();
  });
});

describe('About page states only what is true', () => {
  it('does not present the cut subscription feed as a data path', async () => {
    await renderRoute(<About />, '/about', /about/i);
    const body = document.body.textContent ?? '';
    // The generate-link control ships disabled; nothing can leave via it.
    expect(body).not.toMatch(/generate a calendar subscription link/i);
    expect(body).not.toMatch(/nothing is ever sent to a server/i);
    expect(body).toMatch(/chart on this page loads from Star History/i);
    expect(body).toMatch(/sends that event’s details to Google/i);
  });

  it('describes the path by which data actually does leave the browser', async () => {
    await renderRoute(<About />, '/about', /about/i);
    const body = document.body.textContent ?? '';
    // The transfer link is real egress-adjacent behaviour and was unmentioned.
    expect(body).toMatch(/transfer link/i);
    expect(body).toMatch(/browsers never\s+transmit/i);
  });

  it('prints the fetch date, not a raw machine timestamp', async () => {
    await renderRoute(<About />, '/about', /about/i);
    const body = document.body.textContent ?? '';
    expect(body).toMatch(/fetched\s+\d{4}-\d{2}-\d{2}/);
    expect(body).not.toMatch(/\d{2}:\d{2}:\d{2}/);       // no wall-clock
    expect(body).not.toMatch(/T\d{2}:\d{2}|\+00:00/);    // no ISO tail
  });
});

describe('a bookmark the program no longer contains is reported, not dropped', () => {
  // The schedule is TENTATIVE and refreshed daily during the conference.
  // Silently losing a saved talk is the one way this app can destroy a
  // delegate's data without telling them.
  const renderSchedule = async (state: StoredState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    await renderRoute(<Schedule />, '/schedule', /my schedule/i);
  };

  // The empty-day EmptyState is also a live region, so match on the text and
  // then assert the role on that element rather than querying the role alone.
  const lostBanner = async (pattern: RegExp) => {
    const el = await screen.findByText(pattern);
    expect(el).toHaveAttribute('role', 'status');   // must be announced, not silent
    return el;
  };

  it('warns when a saved id no longer resolves', async () => {
    // M-PM-001 is a poster with no oral slot, so ':oral' is exactly the
    // dangling shape a refresh leaves behind when a talk is withdrawn.
    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-001:oral'] });
    await lostBanner(/1 saved item is no longer in the program/i);
  });

  it('counts several of them', async () => {
    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-001:oral', 'sat:gone-1'] });
    await lostBanner(/2 saved items are no longer in the program/i);
  });

  it('shows nothing when every bookmark resolves', async () => {
    await renderSchedule({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(screen.queryByText(/no longer in the program/i)).toBeNull();
  });
});
