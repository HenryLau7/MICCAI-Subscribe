import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { FollowButton } from '../ui/FollowButton';
import { PaperCard } from '../ui/PaperCard';
import type { Paper } from '../data/types';

/**
 * `Author.affiliations` (from decode.ts) only records an institution when this
 * name was the *presenter* on a paper — non-presenting co-authors get nothing,
 * which is 80.5% of authors in this dataset. Every `Paper`, though, always
 * carries its own `.affiliation` (the paper's presenter's institution), so we
 * derive the hint from the author's actual paper list instead. This is a
 * statement about the papers, never a claim about the person: `paper.affiliation`
 * is where that paper's presenter was based, not necessarily where this author
 * (who may not be the presenter) works.
 */
function affiliationHint(papers: Paper[]): string {
  const n = papers.length;
  const paperWord = n === 1 ? 'paper' : 'papers';
  const affiliations = [...new Set(papers.map((p) => p.affiliation).filter(Boolean))];

  if (affiliations.length === 0) {
    return `Appears on ${n} ${paperWord}; no institution is recorded for them.`;
  }
  if (affiliations.length === 1) {
    return `Appears on ${n} ${paperWord}, presented from ${affiliations[0]}.`;
  }
  return (
    `Appears on ${n} ${paperWord}, presented from ${affiliations.length} different institutions: ` +
    `${affiliations.join(', ')}. Following this name includes all of them.`
  );
}

export function AuthorDetail() {
  const { program } = useProgram();
  const { slug } = useParams<{ slug: string }>();
  const author = slug ? program.authors.get(slug) : undefined;

  if (!author) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <EmptyState
          title="Author not found"
          description="No one with this identifier is in the program."
          action={
            <Link to="/search" className="text-sm text-[var(--accent)] underline underline-offset-2">
              Back to search
            </Link>
          }
        />
      </div>
    );
  }

  const papers = author.paperIds.map((pid) => program.byPaperId.get(pid)).filter((p): p is NonNullable<typeof p> => !!p);
  const paperAffiliations = [...new Set(papers.map((p) => p.affiliation).filter(Boolean))];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-3">
        <p role="note" className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--fg-muted)]">
          Author identity here is just a name string — there are no ORCIDs and no disambiguation, so people who
          share this name cannot be told apart. Check the institutions below before assuming this is who you mean.
        </p>
        <h1 className="text-xl font-semibold text-[var(--fg)]">{author.name}</h1>
        {paperAffiliations.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-sm text-[var(--fg-muted)]">
            {paperAffiliations.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        <FollowButton kind="author" id={author.id} label={author.name} hint={affiliationHint(papers)} />
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
