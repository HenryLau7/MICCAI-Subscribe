import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from '../src/store/StoreProvider';
import { ProgramProvider } from '../src/ui/ProgramContext';
import { SatelliteCard } from '../src/ui/SatelliteCard';
import { Satellite } from '../src/routes/Satellite';
import { SatelliteDetail } from '../src/routes/SatelliteDetail';
import { STORAGE_KEY } from '../src/store/storage';
import { decodeProgram } from '../src/data/decode';
import type { Program, SatelliteEvent } from '../src/data/types';
import raw from '../public/data/program.min.json';

// Stub the network boundary (loadProgram), not our own logic — same pattern as detail.test.tsx.
vi.mock('../src/data/load', () => ({ loadProgram: vi.fn() }));
import { loadProgram } from '../src/data/load';

const mockedLoadProgram = vi.mocked(loadProgram);
const program = decodeProgram(raw as never);
const ev = program.satellite.find((e) => e.acronym === 'CDMRI')!;

// --- SatelliteCard (required verbatim by the task brief) --------------------

describe('SatelliteCard', () => {
  it('shows acronym, full name, type, room and conference-local time', () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <SatelliteCard event={ev} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('CDMRI')).toBeInTheDocument();
    expect(screen.getByText(/Computational Diffusion MRI/)).toBeInTheDocument();
    expect(screen.getByText(/workshop/i)).toBeInTheDocument();
    expect(screen.getByText(/Adeanauer/)).toBeInTheDocument();
    expect(screen.getByText(/08:00/)).toBeInTheDocument();
  });
  it('is bookmarkable', () => {
    render(
      <MemoryRouter>
        <StoreProvider>
          <SatelliteCard event={ev} />
        </StoreProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /bookmark/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// --- Satellite (list/grid page) ---------------------------------------------

// Known real fixtures from the decoded bundle (2026-09-27):
// CDMRI — workshop, theme "Multimodal Learning", room "Adeanauer"
// BIC-MAC — challenge, theme "Responsible AI", room "Berlin"
const CDMRI = program.satellite.find((e) => e.acronym === 'CDMRI')!;
const BICMAC = program.satellite.find((e) => e.acronym === 'BIC-MAC')!;

async function renderSatellite() {
  render(
    <MemoryRouter initialEntries={['/satellite']}>
      <StoreProvider>
        <ProgramProvider>
          <Satellite />
        </ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1, name: /satellite events/i });
}

describe('Satellite page', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedLoadProgram.mockResolvedValue(program);
  });

  it('states the activity-level-only scope limit up front', async () => {
    await renderSatellite();
    expect(
      screen.getByText(/activity-level|paper list.*organi[sz]er|own website/i),
    ).toBeInTheDocument();
  });

  it('renders both conference bookend days as tabs, both non-empty', async () => {
    await renderSatellite();
    const tabs = screen.getAllByRole('tab');
    const labels = tabs.map((t) => t.textContent ?? '');
    expect(labels.some((l) => /27/.test(l))).toBe(true);
    expect(labels.some((l) => /1/.test(l) && !/27/.test(l))).toBe(true);
  });

  it('switching the day tab changes which events are visible', async () => {
    await renderSatellite();
    // Day 1 (2026-09-27) tab is selected by default; CDMRI (day 1) is visible.
    expect(screen.getByText('CDMRI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /thu|10-01|1\b/i }));
    expect(screen.queryByText('CDMRI')).not.toBeInTheDocument();
  });

  it('narrows the list when a type filter is applied, without dropping other types wrongly', async () => {
    await renderSatellite();
    expect(screen.getByText('CDMRI')).toBeInTheDocument(); // workshop
    expect(screen.getByText('BIC-MAC')).toBeInTheDocument(); // challenge

    // Turn off "Workshop" — the workshop-type event must disappear, the
    // challenge-type event must remain (proves it's a real narrowing filter,
    // not something that happens to hide everything).
    fireEvent.click(screen.getByRole('button', { name: /^workshop$/i }));
    expect(screen.queryByText('CDMRI')).not.toBeInTheDocument();
    expect(screen.getByText('BIC-MAC')).toBeInTheDocument();
  });

  it('narrows the list when a theme filter is applied', async () => {
    await renderSatellite();
    const select = screen.getByLabelText(/theme/i);
    fireEvent.change(select, { target: { value: 'Responsible AI' } });
    expect(screen.queryByText('CDMRI')).not.toBeInTheDocument();
    expect(screen.getByText('BIC-MAC')).toBeInTheDocument();
  });

  it('shows the same underlying events in the grid view as the list view', async () => {
    await renderSatellite();
    const listIds = screen.getAllByRole('button', { name: /^bookmark$|^remove bookmark$/i }).length;

    fireEvent.click(screen.getByRole('button', { name: /grid/i }));
    const gridIds = screen.getAllByRole('button', { name: /^bookmark$|^remove bookmark$/i }).length;
    expect(gridIds).toBe(listIds);
    expect(gridIds).toBeGreaterThan(0);
    // And the same specific event is present in both views.
    expect(screen.getByText('CDMRI')).toBeInTheDocument();
  });

  it('renders the room grid inside a bounded, horizontally scrollable region (no page-level overflow)', async () => {
    await renderSatellite();
    fireEvent.click(screen.getByRole('button', { name: /grid/i }));
    const table = screen.getByRole('table');
    // The scroll boundary is the nearest ancestor with overflow-x-auto —
    // asserting its class, not just that the table exists, since a table
    // with no scroll wrapper is exactly the 320px overflow bug this guards.
    const scrollRegion = table.closest('.overflow-x-auto');
    expect(scrollRegion).not.toBeNull();
  });

  it('bookmarks a satellite event using the event id directly, not a constructed id', async () => {
    await renderSatellite();
    const card = screen.getByText('CDMRI').closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: /^bookmark$/i }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.bookmarks).toContain(CDMRI.id);
  });
});

// --- SatelliteDetail ---------------------------------------------------------

function renderDetailAt(id: string, p: Program = program) {
  mockedLoadProgram.mockResolvedValue(p);
  return render(
    <MemoryRouter initialEntries={[`/satellite/${id}`]}>
      <StoreProvider>
        <ProgramProvider>
          <Routes>
            <Route path="/satellite/:id" element={<SatelliteDetail />} />
          </Routes>
        </ProgramProvider>
      </StoreProvider>
    </MemoryRouter>,
  );
}

describe('SatelliteDetail', () => {
  beforeEach(() => localStorage.clear());

  it('shows the event, its room/floor and time, and an external link with rel="noopener noreferrer"', async () => {
    renderDetailAt(BICMAC.id);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('BIC-MAC');
    expect(screen.getByText(new RegExp(BICMAC.room))).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /website|visit|url/i });
    expect(link).toHaveAttribute('href', BICMAC.url);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders no external link when url is empty, instead of a dead link', async () => {
    const noUrlEvent: SatelliteEvent = { ...CDMRI, id: 'sat:test:no-url', url: '' };
    const patched: Program = {
      ...program,
      satellite: [...program.satellite, noUrlEvent],
      bySatelliteId: new Map(program.bySatelliteId).set(noUrlEvent.id, noUrlEvent),
    };
    renderDetailAt(noUrlEvent.id, patched);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: /website|visit|url/i })).not.toBeInTheDocument();
  });

  it('offers a bookmark toggle keyed by the event id', async () => {
    renderDetailAt(CDMRI.id);
    await screen.findByRole('heading', { level: 1 });
    const btn = screen.getByRole('button', { name: /^bookmark$/i });
    fireEvent.click(btn);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.bookmarks).toContain(CDMRI.id);
  });

  it('offers a calendar download for this single event', async () => {
    renderDetailAt(CDMRI.id);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: /download \.ics/i })).toBeInTheDocument();
  });

  it('shows "not found" for an unknown satellite id instead of crashing', async () => {
    renderDetailAt('nope');
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
