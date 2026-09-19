import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** A calm placeholder for "nothing to show yet" — no results, no bookmarks, etc. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div role="status" className="mx-auto flex max-w-sm flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-base font-medium text-[var(--fg)]">{title}</p>
      {description && <p className="text-sm text-[var(--fg-muted)]">{description}</p>}
      {action}
    </div>
  );
}
