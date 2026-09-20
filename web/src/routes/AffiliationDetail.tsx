import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { FollowButton } from '../ui/FollowButton';
import { PaperCard } from '../ui/PaperCard';

export function AffiliationDetail() {
  const { program } = useProgram();
  const { key } = useParams<{ key: string }>();
  const affiliation = key ? program.affiliations.get(key) : undefined;

  if (!affiliation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Institution not found"
          description="No institution with this identifier is in the program."
          action={
            <Link to="/search" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Back to search
            </Link>
          }
        />
      </div>
    );
  }

  const papers = affiliation.paperIds
    .map((pid) => program.byPaperId.get(pid))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold leading-snug text-[var(--fg)]">{affiliation.name}</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {affiliation.country ? `${affiliation.country} · ` : ''}
          {papers.length} paper{papers.length === 1 ? '' : 's'}
        </p>
        <FollowButton
          kind="affiliation"
          id={affiliation.id}
          label={affiliation.name}
          hint={affiliation.country}
        />
      </header>

      <section aria-labelledby="papers-heading" className="flex flex-col gap-3">
        <h2 id="papers-heading" className="text-sm font-semibold text-[var(--fg)]">
          Papers ({papers.length})
        </h2>
        <ul className="flex flex-col gap-3">
          {papers.map((paper) => (
            <li key={paper.id}>
              <PaperCard program={program} paper={paper} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
