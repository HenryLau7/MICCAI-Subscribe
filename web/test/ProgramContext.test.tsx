import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgramProvider, useProgram } from '../src/ui/ProgramContext';
import type { Program } from '../src/data/types';

// Stub the network boundary (loadProgram), not our own logic.
vi.mock('../src/data/load', () => ({
  loadProgram: vi.fn(),
}));

import { loadProgram } from '../src/data/load';

const mockedLoadProgram = vi.mocked(loadProgram);

function makeProgram(conference: string): Program {
  return {
    meta: {
      conference,
      venue: 'Strasbourg Convention Center',
      timezone: 'Europe/Paris',
      schemaVersion: 1,
      sourceRevision: '2026-09-10',
      fetchedAt: '2026-09-19T08:17:24+00:00',
      generatedAt: '2026-09-19T08:19:06+00:00',
    },
    papers: [],
    byPaperId: new Map(),
    presentations: [],
    byPresentationId: new Map(),
    sessions: new Map(),
    satellite: [],
    bySatelliteId: new Map(),
    authors: new Map(),
    affiliations: new Map(),
  };
}

function Probe() {
  const { program } = useProgram();
  return <div data-testid="ready">{program.meta.conference}</div>;
}

describe('ProgramProvider', () => {
  beforeEach(() => {
    mockedLoadProgram.mockReset();
  });

  it('shows a loading state before the program resolves', () => {
    mockedLoadProgram.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('ready')).not.toBeInTheDocument();
  });

  it('shows a skeleton — several placeholder cards shaped like the eventual layout, not just a spinner glyph — while loading', () => {
    mockedLoadProgram.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    );

    // Positive assertion of what IS there, not just that a testid exists:
    // several distinct pulsing placeholder bars, matching a heading + search
    // bar + a handful of cards, not a single spinner element.
    const skeleton = screen.getByTestId('program-skeleton');
    const pulsingBars = skeleton.querySelectorAll('.animate-pulse');
    expect(pulsingBars.length).toBeGreaterThanOrEqual(6);
    // Every animated element must be wired to stop animating under
    // prefers-reduced-motion (Tailwind's motion-reduce: variant) — reduced
    // motion should suppress this skeleton's pulse the same way it already
    // suppresses everything else in the app.
    for (const bar of pulsingBars) {
      expect(bar).toHaveClass('motion-reduce:animate-none');
    }
  });

  it('renders an error state with a Retry control when loading fails, and recovers on retry', async () => {
    mockedLoadProgram.mockRejectedValueOnce(new Error('network down'));

    render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    );

    const retryButton = await screen.findByRole('button', { name: /retry/i });
    expect(screen.getByRole('alert')).toHaveTextContent(/unable to load conference data/i);
    expect(screen.queryByTestId('ready')).not.toBeInTheDocument();

    mockedLoadProgram.mockResolvedValueOnce(makeProgram('MICCAI 2026'));
    fireEvent.click(retryButton);

    expect(await screen.findByTestId('ready')).toHaveTextContent('MICCAI 2026');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockedLoadProgram).toHaveBeenCalledTimes(2);
  });

  it('renders the ready state once the program resolves, with children reading it via useProgram()', async () => {
    mockedLoadProgram.mockResolvedValueOnce(makeProgram('MICCAI 2026'));

    render(
      <ProgramProvider>
        <Probe />
      </ProgramProvider>,
    );

    expect(await screen.findByTestId('ready')).toHaveTextContent('MICCAI 2026');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
