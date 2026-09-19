import { Link, useParams } from 'react-router-dom';
import { useProgram } from '../ui/ProgramContext';
import { EmptyState } from '../ui/EmptyState';
import { FollowButton } from '../ui/FollowButton';
import { PaperCard } from '../ui/PaperCard';
import type { Paper } from '../data/types';

/**
 * Collapses casing and `&`/`and`/punctuation-spacing variants of the same
 * institution string into one normalized key. Deliberately cheap — it is not
 * a real institution-resolution pass, just enough to stop the most common
 * near-duplicates (e.g. "University of Liverpool" vs "university of
 * liverpool") from each counting as a separate institution.
 */
function normKey(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * `Author.affiliations` (from decode.ts) only records an institution when this
 * name was the *presenter* on a paper — non-presenting co-authors get nothing,
 * which is 80.5% of authors in this dataset. Every `Paper`, though, always
 * carries its own `.affiliation` (the paper's presenter's institution), so we
 * derive this from the author's actual paper list instead.
 *
 * Deduped on `normKey`, but displayed using the first-seen original spelling.
 * Normalization still under-collapses some variants — e.g. "Imperial College,
 * London" vs "Imperial College London" (comma + word order) survive as two
 * entries — which is exactly why `affiliationHint` below never turns this
 * list's length into a claimed institution count.
 */
function dedupedAffiliations(papers: Paper[]): string[] {
  const seen = new Map<string, string>(); // normKey -> first-seen display spelling
  for (const p of papers) {
    if (!p.affiliation) continue;
    const key = normKey(p.affiliation);
    if (!seen.has(key)) seen.set(key, p.affiliation);
  }
  return [...seen.values()];
}

/**
 * This is a statement about the papers, never a claim about the person: each
 * institution is where that paper's *presenter* was based, not necessarily
 * where this author (who may not have been the presenter) works.
 *
 * Deliberately does not name or count institutions here — the full deduped
 * list is already rendered as a `<ul>` right above this control (and this
 * hint is wired to the button via `aria-describedby`, so a screen-reader user
 * who jumps straight to Follow still gets pointed at it), and re-enumerating
 * even 3 of them in prose ran to hundreds of characters for real authors with
 * long institution names — worse than pointless, since it duplicates the list
 * for anyone reading linearly and still didn't fit under a 320px button.
 */
function affiliationHint(paperCount: number, affiliations: string[]): string {
  const paperWord = paperCount === 1 ? 'paper' : 'papers';

  if (affiliations.length === 0) {
    return `Appears on ${paperCount} ${paperWord}; no institution is recorded for them.`;
  }
  const institutionWord = affiliations.length === 1 ? 'one institution' : 'several institutions';
  return `Appears on ${paperCount} ${paperWord}, presented from ${institutionWord} — listed above.`;
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
  const paperAffiliations = dedupedAffiliations(papers);

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
        <FollowButton
          kind="author"
          id={author.id}
          label={author.name}
          hint={affiliationHint(papers.length, paperAffiliations)}
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
