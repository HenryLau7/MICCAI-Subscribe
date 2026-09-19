import { useProgram } from './ProgramContext';

export function Footer() {
  const { program } = useProgram();
  return (
    <footer className="border-t border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--fg-muted)]">
      <p>Unofficial community tool for MICCAI 2026.</p>
      <p>Program data: revised {program.meta.sourceRevision}</p>
    </footer>
  );
}
