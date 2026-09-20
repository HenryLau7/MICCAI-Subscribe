import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadProgram } from '../data/load';
import { buildSearchIndex, type SearchIndex } from '../search/engine';
import type { Program } from '../data/types';

interface ProgramApi {
  program: Program;
  index: SearchIndex;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; program: Program; index: SearchIndex };

const ProgramContext = createContext<ProgramApi | null>(null);

/**
 * Loads the program bundle once on mount and builds the search index from it.
 * Owns the loading/error UI: children only ever render once data is ready, so
 * useProgram() never has to handle a missing value.
 */
export function ProgramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // Only resolves asynchronously (.then/.catch) — never a synchronous setState
  // call from within the effect below, so mount and retry share one path.
  const fetchProgram = useCallback(() => {
    loadProgram()
      .then((program) => setState({ status: 'ready', program, index: buildSearchIndex(program) }))
      .catch((err: unknown) => {
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
  }, []);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    fetchProgram();
  }, [fetchProgram]);

  // Mirrors StoreProvider's useMemo-wrapped context value: `state` (from
  // useState) keeps a stable reference across re-renders that don't call
  // setState — e.g. a bookmark toggle re-rendering the parent StoreProvider
  // and cascading down — so this only recomputes on an actual load/retry,
  // not on every unrelated re-render of a component above this one.
  const readyValue = useMemo<ProgramApi | null>(
    () => (state.status === 'ready' ? { program: state.program, index: state.index } : null),
    [state],
  );

  if (state.status === 'loading') {
    // A skeleton, not a spinner: the program bundle is the one thing every
    // route needs before it can render anything, so this loading gate has
    // no route to shape itself around yet. It approximates the shape most
    // routes actually open with — a title and a line under it, one full-width
    // panel (Home's conference status, Schedule's day tabs), a control bar,
    // then cards — so there's little layout shift into the real content once
    // it arrives, which matters more on a slow venue connection than it would
    // on a fast one.
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-9" role="status" aria-live="polite">
        <span className="sr-only">Loading the MICCAI 2026 program…</span>
        <div data-testid="program-skeleton" aria-hidden="true" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="h-7 w-52 rounded-md bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
            <div className="h-4 w-64 max-w-full rounded bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-14 w-full rounded-[var(--radius-card)] bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
          <div className="h-12 w-full rounded-xl bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
              >
                <div className="h-4 w-3/4 rounded bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
                <div className="h-3 w-1/2 rounded bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
                <div className="h-3 w-1/3 rounded bg-[var(--border)] animate-pulse motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p className="text-sm text-[var(--fg)]">Unable to load conference data. Check your connection.</p>
        <button
          type="button"
          onClick={retry}
          className="min-h-11 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  // readyValue is only null while state.status is 'loading' or 'error',
  // both of which returned above — non-null by construction here.
  return <ProgramContext.Provider value={readyValue!}>{children}</ProgramContext.Provider>;
}

// eslint-disable-next-line react/only-export-components -- hook and provider share one small file by design (mirrors StoreProvider.tsx)
export function useProgram(): ProgramApi {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error('useProgram must be used within a ProgramProvider');
  return ctx;
}
