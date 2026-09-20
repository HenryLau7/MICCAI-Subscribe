import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CalendarPage } from '../src/routes/CalendarPage';
import { ImportPage } from '../src/routes/ImportPage';
import { StoreProvider } from '../src/store/StoreProvider';
import { ProgramProvider } from '../src/ui/ProgramContext';
import { STORAGE_KEY, defaultState, type StoredState } from '../src/store/storage';
import { decodeTransfer, encodeTransfer } from '../src/store/transfer';
import { decodeProgram } from '../src/data/decode';
import type { Program } from '../src/data/types';
import raw from '../public/data/program.min.json';

// Same network-boundary stub as schedule-ui.test.tsx.
vi.mock('../src/data/load', () => ({ loadProgram: vi.fn() }));
import { loadProgram } from '../src/data/load';

const mockedLoadProgram = vi.mocked(loadProgram);
const program: Program = decodeProgram(raw as never);

const FORBIDDEN = [/instant sync/i, /real-?time sync/i, /syncs automatically/i, /automatic sync/i];

/** RFC 5545 folding can split any text at a byte boundary; unfold before substring assertions. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

/**
 * Stubs `URL.createObjectURL`/`revokeObjectURL` and captures the Blob passed
 * in, instead of relying on jsdom's real object-URL machinery (it errors on
 * a non-jsdom Blob instance in this test environment). The DOM lib types
 * `createObjectURL`'s parameter as `Blob | MediaSource`; narrowed to `Blob`
 * *inside* the mock body (our production code only ever passes a Blob),
 * rather than narrowing the mock's own parameter type, which the real
 * signature doesn't allow.
 */
function mockObjectUrl(): { captured: () => Blob | undefined } {
  let captured: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
    if (obj instanceof Blob) captured = obj;
    return 'blob:mock';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return { captured: () => captured };
}

async function renderCalendar(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <StoreProvider>
        <ProgramProvider>
          <CalendarPage />
        </ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: /calendar/i });
}

describe('CalendarPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedLoadProgram.mockResolvedValue(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('orders its sections download, subscription, reminder, transfer', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '');
    const idx = (re: RegExp) => headings.findIndex((t) => re.test(t));
    const download = idx(/download/i);
    const subscribe = idx(/subscription/i);
    const reminder = idx(/reminder/i);
    const transfer = idx(/move to another device/i);
    expect(download).toBeGreaterThanOrEqual(0);
    expect(subscribe).toBeGreaterThan(download);
    expect(reminder).toBeGreaterThan(subscribe);
    expect(transfer).toBeGreaterThan(reminder);
  });

  it('never renders any overpromising-sync language', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    const text = document.body.textContent ?? '';
    for (const re of FORBIDDEN) {
      expect(text).not.toMatch(re);
    }
  });

  it('states plainly that refresh is app-controlled and can take up to 24 hours, directly under the subscription option', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    const subscribeHeading = screen.getByRole('heading', { level: 2, name: /subscription link/i });
    const section = subscribeHeading.closest('section')!;
    expect(within(section).getByText(/24 hours/i)).toBeInTheDocument();
    expect(within(section).getByText(/re-downloading the \.ics/i)).toBeInTheDocument();
  });

  it('disables the subscription generate-link control and labels it not yet available, with its explanation reachable via aria-describedby', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    const btn = screen.getByRole('button', { name: /not yet available/i });
    expect(btn).toBeDisabled();
    const describedBy = btn.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy!);
    expect(description).toBeInTheDocument();
    expect(description?.textContent).toMatch(/24 hours/i);
  });

  it('downloading .ics produces a calendar file containing the bookmarked session', async () => {
    const { captured } = mockObjectUrl();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    fireEvent.click(screen.getByRole('button', { name: /^download \.ics$/i }));

    expect(clickSpy).toHaveBeenCalled();
    expect(captured()).toBeDefined();
    const text = unfold(await captured()!.text());
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('M-PM-001'); // the bookmarked poster's board number, in the session description
    // The session window this brief's step 6 calls out: 2026-09-28 16:00-18:00 Europe/Paris.
    expect(text).toContain('DTSTART;TZID=Europe/Paris:20260928T160000');
    expect(text).toContain('DTEND;TZID=Europe/Paris:20260928T180000');
  });

  it('disables the download button when there is nothing bookmarked or followed', async () => {
    await renderCalendar(defaultState());
    expect(screen.getByRole('button', { name: /^download \.ics$/i })).toBeDisabled();
  });

  it('lets the reminder preference be changed and persists it to the store', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    const thirty = screen.getByRole('radio', { name: /30 min before/i });
    expect(thirty).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(thirty);
    expect(thirty).toHaveAttribute('aria-checked', 'true');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as StoredState;
    expect(stored.prefs.reminderMinutes).toBe(30);
  });

  it('reflects the changed reminder preference in the next .ics download', async () => {
    const { captured } = mockObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    fireEvent.click(screen.getByRole('radio', { name: /60 min before/i }));
    fireEvent.click(screen.getByRole('button', { name: /^download \.ics$/i }));
    const text = await captured()!.text();
    expect(text).toContain('TRIGGER:-PT60M');
  });

  it('shows an import link for another device pointing at /import#<transfer-string> that decodes back to the current state', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'], followedAuthors: ['yuan-xue'] });
    const link = screen.getByText(/\/import#/i);
    const match = link.textContent!.match(/\/import#([A-Za-z0-9_-]+)$/);
    expect(match).not.toBeNull();
    const decoded = decodeTransfer(match![1]);
    expect(decoded?.bookmarks).toEqual(['M-PM-001']);
    expect(decoded?.followedAuthors).toEqual(['yuan-xue']);
  });

  it('copies the transfer link to the clipboard and shows confirmation, when the Clipboard API is available', async () => {
    // jsdom has no Clipboard API at all, so this exercises the real
    // integration point rather than assuming a no-op guard is the only path.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    fireEvent.click(screen.getByRole('button', { name: /copy transfer link/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/\/import#[A-Za-z0-9_-]+$/);
    await screen.findByRole('button', { name: /^copied$/i });

    // @ts-expect-error -- test-only cleanup of a property we defined above
    delete navigator.clipboard;
  });

  it('does not throw when Copy is clicked and the Clipboard API is unavailable', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(() => fireEvent.click(screen.getByRole('button', { name: /copy transfer link/i }))).not.toThrow();
  });

  it('downloads a JSON transfer file that matches the current store state', async () => {
    const { captured } = mockObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const state = { ...defaultState(), bookmarks: ['M-PM-001'] };
    await renderCalendar(state);
    fireEvent.click(screen.getByRole('button', { name: /download as json/i }));
    const text = await captured()!.text();
    expect(JSON.parse(text).bookmarks).toEqual(['M-PM-001']);
  });
});

describe('ImportPage', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  function renderImport() {
    return render(
      <MemoryRouter>
        <StoreProvider>
          <ImportPage />
        </StoreProvider>
      </MemoryRouter>,
    );
  }

  it('rejects garbage in the hash rather than crashing, and offers a way back', () => {
    window.location.hash = '#!!!not-a-valid-transfer!!!';
    renderImport();
    expect(screen.getByText(/isn't valid/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('shows the number of items a valid link would import, and requires confirmation before touching storage', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001', 'M-PM-042:oral'], followedAuthors: ['yuan-xue'] };
    window.location.hash = `#${encodeTransfer(state)}`;
    renderImport();

    const summary = screen.getByText(/2 bookmarks/i).closest('p')!;
    expect(summary.textContent).toMatch(/3 items?:/i);
    expect(summary.textContent).toMatch(/2 bookmarks, 1 followed author, 0 followed institutions/i);
    // Nothing should be written to storage until the user confirms.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('replaces the current state only after the confirm click, and shows a done state after', () => {
    const state = { ...defaultState(), bookmarks: ['M-PM-001'] };
    window.location.hash = `#${encodeTransfer(state)}`;
    renderImport();

    fireEvent.click(screen.getByRole('button', { name: /replace my schedule/i }));

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as StoredState;
    expect(stored.bookmarks).toEqual(['M-PM-001']);
    expect(screen.getByText(/imported/i)).toBeInTheDocument();
  });
});

/**
 * The Web Share path exists for iOS, where a downloaded .ics lands in Files
 * and reaching Calendar takes several more taps. `navigator.share` with a
 * file hands the share sheet a real calendar file instead. It is strictly
 * additive: where the API is absent (every desktop browser today), the page
 * must look exactly as it did before.
 */
function stubWebShare(): { share: ReturnType<typeof vi.fn>; restore: () => void } {
  const share = vi.fn().mockResolvedValue(undefined);
  const canShare = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
  return {
    share,
    restore: () => {
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'canShare');
    },
  };
}

describe('CalendarPage Web Share ("Add to Calendar")', () => {
  let web: ReturnType<typeof stubWebShare> | undefined;

  beforeEach(() => {
    localStorage.clear();
    mockedLoadProgram.mockResolvedValue(program);
  });

  afterEach(() => {
    web?.restore();
    web = undefined;
    vi.restoreAllMocks();
  });

  it('renders no share control at all when the browser cannot share files', async () => {
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(screen.queryByRole('button', { name: /add to calendar/i })).not.toBeInTheDocument();
  });

  it('offers Add to Calendar when the browser can share files', async () => {
    web = stubWebShare();
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    expect(screen.getByRole('button', { name: /add to calendar/i })).toBeInTheDocument();
  });

  it('shares a text/calendar file holding the bookmarked session', async () => {
    web = stubWebShare();
    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });

    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
    await vi.waitFor(() => expect(web!.share).toHaveBeenCalled());

    const [payload] = web!.share.mock.calls[0] as [{ files: File[] }];
    expect(payload.files).toHaveLength(1);
    const file = payload.files[0];
    expect(file.name).toMatch(/\.ics$/);
    expect(file.type).toBe('text/calendar');
    const text = unfold(await file.text());
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('DTSTART;TZID=Europe/Paris:20260928T160000');
  });

  it('stays silent when the user dismisses the share sheet, and never falls back to a download', async () => {
    web = stubWebShare();
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    web.share.mockRejectedValue(abort);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
    await vi.waitFor(() => expect(web!.share).toHaveBeenCalled());

    expect(clickSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to a download when the share sheet fails for any reason other than the user dismissing it', async () => {
    web = stubWebShare();
    web.share.mockRejectedValue(Object.assign(new Error('nope'), { name: 'NotAllowedError' }));
    const { captured } = mockObjectUrl();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderCalendar({ ...defaultState(), bookmarks: ['M-PM-001'] });
    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }));
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalled());

    expect(unfold(await captured()!.text())).toContain('BEGIN:VCALENDAR');
  });

  it('disables Add to Calendar when there is nothing to export', async () => {
    web = stubWebShare();
    await renderCalendar(defaultState());
    expect(screen.getByRole('button', { name: /add to calendar/i })).toBeDisabled();
  });
});
