import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** A 24px icon from `./icons`. Decorative — the title carries the meaning. */
  icon?: ReactNode;
}

/**
 * "Nothing to show yet" — no results, no bookmarks, nothing past a filter.
 *
 * An empty screen is an invitation to act, so every caller passes a title
 * that names what is missing and, where there is something to do about it, an
 * action. The icon is decoration in the strict sense: it gives the block a
 * centre of gravity so it reads as a deliberate state rather than as content
 * that failed to load, and it is aria-hidden at source in `icons.tsx`.
 */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-14 text-center"
    >
      {icon && (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--fg-muted)]">
          {icon}
        </span>
      )}
      <p className="text-base font-medium text-[var(--fg)]">{title}</p>
      {description && (
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
