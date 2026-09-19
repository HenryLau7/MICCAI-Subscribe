import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

  if (state.status === 'loading') {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <div
          aria-hidden="true"
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] motion-reduce:animate-none"
        />
        <p className="text-sm text-[var(--fg-muted)]">Loading the MICCAI 2026 program…</p>
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
          className="min-h-11 rounded-xl border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ProgramContext.Provider value={{ program: state.program, index: state.index }}>
      {children}
    </ProgramContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components -- hook and provider share one small file by design (mirrors StoreProvider.tsx)
export function useProgram(): ProgramApi {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error('useProgram must be used within a ProgramProvider');
  return ctx;
}
