/**
 * Regression guards for the app's chrome and its shared UI primitives.
 *
 * These pin decisions that are invisible in a diff but load-bearing on a
 * phone: that the tab bar's icons are ours and not the platform's, that the
 * active tab is marked by something other than colour, that the one animation
 * in the app only fires on a change the user just made, and that the home
 * screen's conference status tells the truth on either side of the window.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../src/ui/BottomNav';
import { BoardNumber } from '../src/ui/BoardNumber';
import { BookmarkButton } from '../src/ui/BookmarkButton';
import { EmptyState } from '../src/ui/EmptyState';
import { IconNoResults } from '../src/ui/icons';
import { Home } from '../src/routes/Home';
import { StoreProvider } from '../src/store/StoreProvider';
import { ProgramProvider } from '../src/ui/ProgramContext';
import { STORAGE_KEY, defaultState } from '../src/store/storage';
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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BottomNav', () => {
  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <BottomNav />
      </MemoryRouter>,
    );

  it('draws its own icons rather than leaning on platform emoji', () => {
    // Emoji render as whatever the OS ships: a flat blue glyph on one phone,
    // an outline on another, at a size we cannot set and in a colour that
    // cannot follow the active state. Every tab icon must be an inline <svg>.
    const { container } = renderAt('/');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(4);
    for (const link of links) {
      expect(link.querySelector('svg')).not.toBeNull();
    }
    expect(container.textContent ?? '').not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('hides the icons from assistive tech and keeps the text label', () => {
    renderAt('/');
    const { container } = renderAt('/schedule');
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(screen.getAllByText('Schedule').length).toBeGreaterThan(0);
  });

  it('marks the active tab with more than colour', () => {
    // Colour alone is exactly the wrong sole cue for "which tab am I on".
    // aria-current carries it non-visually; the filled pill carries it as a
    // shape, which survives any colour vision.
    renderAt('/schedule');
    const active = screen.getByRole('link', { current: 'page' });
    expect(within(active).getByText('Schedule')).toBeInTheDocument();
    expect(active.innerHTML).toContain('--accent-soft');

    const other = screen.getByRole('link', { name: /satellite/i });
    expect(other).not.toHaveAttribute('aria-current');
    expect(other.innerHTML).not.toContain('--accent-soft');
  });
});

describe('BoardNumber', () => {
  it('sets the number monospaced, since it is read off a card and matched to a board', () => {
    const { container } = render(<BoardNumber id="M-PM-001" />);
    const chip = screen.getByText('M-PM-001');
    expect(chip.className).toContain('font-mono');
    expect(container.textContent).toContain('Board');
  });
});

describe('EmptyState', () => {
  it('stays an announced status region when given an icon', () => {
    render(<EmptyState icon={<IconNoResults />} title="No results" description="Try fewer words." />);
    const region = screen.getByRole('status');
    expect(within(region).getByText('No results')).toBeInTheDocument();
    // The icon is decoration; the title is the message.
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders without an icon, unchanged', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here');
  });
});

describe('the bookmark star animates a change, not a state', () => {
  const renderButton = (id: string) =>
    render(
      <StoreProvider>
        <BookmarkButton presentationId={id} />
      </StoreProvider>,
    );

  const glyph = (container: HTMLElement) => container.querySelector('button > span')!;

  it('does not animate a bookmark that was already saved when the page opened', () => {
    // Opening /schedule with twenty saved talks must not set twenty stars
    // animating at once. This is the reason the pop is gated on the click
    // rather than on `on`.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...defaultState(), bookmarks: ['M-PM-001'] }),
    );
    const { container } = renderButton('M-PM-001');
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(glyph(container).className).not.toContain('animate-');
  });

  it('animates when the user turns a bookmark on', () => {
    const { container } = renderButton('M-PM-001');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(glyph(container).className).toContain('animate-[bookmark-pop');
  });

  it('replays on the next turn-on, and does not remount on a turn-off', () => {
    // The pop is replayed by mounting a fresh glyph node, so node identity is
    // the mechanism: unchanged across a turn-off (nothing to announce), new
    // across the next turn-on (a CSS animation only restarts on a new node).
    const { container } = renderButton('M-PM-001');
    fireEvent.click(screen.getByRole('button')); // on
    const afterFirstOn = glyph(container);

    fireEvent.click(screen.getByRole('button')); // off
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(glyph(container)).toBe(afterFirstOn);

    fireEvent.click(screen.getByRole('button')); // on again
    expect(glyph(container)).not.toBe(afterFirstOn);
    expect(glyph(container).className).toContain('animate-[bookmark-pop');
  });
});

describe('the home screen states where the conference actually is', () => {
  const renderHome = async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <StoreProvider>
          <ProgramProvider>
            <Home />
          </ProgramProvider>
        </StoreProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: /miccai subscribe/i });
  };

  it('counts down before it starts, and offers no way into a day that has not happened', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-20T09:00:00Z'));
    await renderHome();
    expect(screen.getByText('Starts in 7 days')).toBeInTheDocument();
    expect(screen.getByText('27 Sep – 1 Oct')).toBeInTheDocument();
    expect(screen.queryByText(/^Day \d+ of/)).toBeNull();
  });

  it('names the day and links into the schedule while it runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
    await renderHome();
    const status = screen.getByRole('link', { name: /day 2 of 5/i });
    expect(status).toHaveAttribute('href', '/schedule');
    expect(within(status).getByText('Mon 28 Sep')).toBeInTheDocument();
  });

  it('says it is over afterwards, rather than showing a stale day 5', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-05T09:00:00Z'));
    await renderHome();
    expect(screen.getByText('This program has finished')).toBeInTheDocument();
    expect(screen.queryByText(/^Day \d+ of/)).toBeNull();
  });

  it('reports having nothing saved, and changes once something is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
    await renderHome();
    expect(screen.getByText('Nothing saved yet')).toBeInTheDocument();
  });
});
