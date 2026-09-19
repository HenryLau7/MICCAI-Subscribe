import { useState } from 'react';
import { Link } from 'react-router-dom';
import { decodeTransfer } from '../store/transfer';
import { useStore } from '../store/StoreProvider';
import { EmptyState } from '../ui/EmptyState';
import type { StoredState } from '../store/storage';

type PageState =
  | { status: 'invalid' }
  | { status: 'ready'; incoming: StoredState }
  | { status: 'done' };

function readHash(): string {
  const h = window.location.hash;
  return h.startsWith('#') ? h.slice(1) : h;
}

function initialState(): PageState {
  const decoded = decodeTransfer(readHash());
  return decoded ? { status: 'ready', incoming: decoded } : { status: 'invalid' };
}

function summarize(s: StoredState): string {
  const parts = [
    `${s.bookmarks.length} bookmark${s.bookmarks.length === 1 ? '' : 's'}`,
    `${s.followedAuthors.length} followed author${s.followedAuthors.length === 1 ? '' : 's'}`,
    `${s.followedAffiliations.length} followed institution${s.followedAffiliations.length === 1 ? '' : 's'}`,
  ];
  return parts.join(', ');
}

/**
 * Reads the transfer payload out of the URL fragment (never sent to a
 * server — it never leaves the browser except by the user copying the
 * link). Requires an explicit confirm click before touching anything: this
 * is a destructive, unrecoverable replace of whatever is currently saved on
 * this device.
 */
export function ImportPage() {
  const { replaceState } = useStore();
  const [page, setPage] = useState<PageState>(initialState);

  if (page.status === 'invalid') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="This link isn't valid"
          description="It may be incomplete, corrupted, or created by a different version of MICCAI Subscribe."
          action={
            <Link to="/" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Go home
            </Link>
          }
        />
      </div>
    );
  }

  if (page.status === 'done') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Schedule imported"
          description="This device now has the bookmarks and follows from that link."
          action={
            <Link to="/schedule" className="text-sm text-[var(--accent)] underline underline-offset-2">
              View my schedule
            </Link>
          }
        />
      </div>
    );
  }

  const count =
    page.incoming.bookmarks.length + page.incoming.followedAuthors.length + page.incoming.followedAffiliations.length;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold text-[var(--fg)]">Import schedule</h1>
      <p className="text-sm text-[var(--fg)]">
        This link contains <strong>{count}</strong> item{count === 1 ? '' : 's'}: {summarize(page.incoming)}.
      </p>
      <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
        Importing replaces everything currently saved on this device. This can&rsquo;t be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            replaceState(page.incoming);
            setPage({ status: 'done' });
          }}
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Replace my schedule
        </button>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
