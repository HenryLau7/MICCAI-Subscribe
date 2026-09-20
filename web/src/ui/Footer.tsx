import { Link } from 'react-router-dom';
import { useProgram } from './ProgramContext';

/**
 * The unofficial-status line is a standing product requirement, not a
 * footer nicety: it is the one place every route carries the disclaimer, so
 * it stays first, in the app's own voice, and is never conditioned on route
 * or state.
 */
export function Footer() {
  const { program } = useProgram();
  return (
    <footer className="border-t border-[var(--border)] px-4 py-7">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-1.5 text-center text-xs text-[var(--fg-muted)]">
        <p>Unofficial community tool for MICCAI 2026.</p>
        <p>Program data revised {program.meta.sourceRevision}</p>
        <Link
          to="/about"
          className="focus-ring mt-1 inline-flex min-h-11 items-center text-[var(--accent)] underline underline-offset-4"
        >
          Sources &amp; privacy
        </Link>
      </div>
    </footer>
  );
}
