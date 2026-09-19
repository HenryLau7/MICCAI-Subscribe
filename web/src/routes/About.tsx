import { useProgram } from '../ui/ProgramContext';

const MAIN_PDF =
  'https://conferences.miccai.org/2026/files/downloads/MICCAI2026-Main-Conference-Oral-and-Poster-Program.pdf';
const SATELLITE_PDF =
  'https://conferences.miccai.org/2026/files/downloads/MICCAI2026-Satellite-Events-Program.pdf';

export function About() {
  const { program } = useProgram();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-16 pt-8">
      <header>
        <h1 className="text-xl font-semibold text-[var(--fg)]">About</h1>
      </header>

      <section aria-labelledby="disclaimer-heading" className="flex flex-col gap-2">
        <h2 id="disclaimer-heading" className="text-sm font-semibold text-[var(--fg)]">
          Not an official MICCAI site
        </h2>
        <p className="text-sm text-[var(--fg-muted)]">
          MICCAI Subscribe is an independent, unofficial community tool. It is not affiliated with, endorsed by,
          or produced by the MICCAI Society or the MICCAI 2026 organizers, and it does not use their logo or
          branding.
        </p>
      </section>

      <section aria-labelledby="data-heading" className="flex flex-col gap-2">
        <h2 id="data-heading" className="text-sm font-semibold text-[var(--fg)]">
          Where the data comes from
        </h2>
        <p className="text-sm text-[var(--fg-muted)]">
          Program data is parsed from the official MICCAI 2026 schedule PDFs, revision{' '}
          <strong className="font-semibold text-[var(--fg)]">{program.meta.sourceRevision}</strong>, fetched{' '}
          <strong className="font-semibold text-[var(--fg)]">{program.meta.fetchedAt}</strong>.
        </p>
        <p className="text-sm text-[var(--fg-muted)]">
          The official schedule is marked{' '}
          <strong className="font-semibold text-[var(--fg)]">TENTATIVE</strong> and can still change before the
          conference. Always confirm times and rooms on-site.
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            <a
              className="text-[var(--accent)] underline underline-offset-2"
              href={MAIN_PDF}
              target="_blank"
              rel="noreferrer"
            >
              Main conference program (PDF)
            </a>
          </li>
          <li>
            <a
              className="text-[var(--accent)] underline underline-offset-2"
              href={SATELLITE_PDF}
              target="_blank"
              rel="noreferrer"
            >
              Satellite events program (PDF)
            </a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="privacy-heading" className="flex flex-col gap-2">
        <h2 id="privacy-heading" className="text-sm font-semibold text-[var(--fg)]">
          Privacy
        </h2>
        <p className="text-sm text-[var(--fg-muted)]">
          This site does not collect your name, email, institution, or location. Bookmarks, followed authors,
          and preferences live only in this browser&rsquo;s local storage — nothing is sent to a server just by
          using the app. The only time anything leaves your device is if you choose to generate a calendar
          subscription link, and that link contains only entry IDs, never personal information.
        </p>
      </section>

      <section aria-labelledby="limits-heading" className="flex flex-col gap-2">
        <h2 id="limits-heading" className="text-sm font-semibold text-[var(--fg)]">
          Known limitations
        </h2>
        <ul className="list-disc pl-5 text-sm text-[var(--fg-muted)]">
          <li>No abstracts or paper links — the official PDFs don&rsquo;t include them.</li>
          <li>Individual oral talk times aren&rsquo;t published, only the session window.</li>
          <li>Poster hall names aren&rsquo;t published by MICCAI — only the board number.</li>
          <li>Authors with the same name can&rsquo;t always be told apart.</li>
        </ul>
      </section>
    </div>
  );
}
