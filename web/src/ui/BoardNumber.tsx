/**
 * A paper's board number, e.g. M-PM-001.
 *
 * This is the app's one piece of physical wayfinding: MICCAI does not publish
 * poster hall names, so in a room with hundreds of boards the number is the
 * only thing that gets a delegate to the right one. It is treated as an
 * identifier rather than as prose — monospaced, on its own fill, at a size
 * that survives being read at arm's length while walking — so it can be
 * picked out of a card without reading the card.
 */
export function BoardNumber({ id, className = '' }: { id: string; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs text-[var(--fg-muted)] ${className}`}>
      Board
      <span className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[0.8125rem] font-semibold tracking-tight text-[var(--fg)]">
        {id}
      </span>
    </p>
  );
}
