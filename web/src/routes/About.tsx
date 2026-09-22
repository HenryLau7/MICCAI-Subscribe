import { useState } from 'react';
import { useProgram } from '../ui/ProgramContext';

const REPOSITORY = 'https://github.com/HenryLau7/MICCAI-Subscribe';
const STAR_HISTORY = 'https://www.star-history.com/#HenryLau7/MICCAI-Subscribe&Date';
const STAR_CHART = 'https://api.star-history.com/svg?repos=HenryLau7/MICCAI-Subscribe&type=Date';

const MAIN_PDF =
  'https://conferences.miccai.org/2026/files/downloads/MICCAI2026-Main-Conference-Oral-and-Poster-Program.pdf';
const SATELLITE_PDF =
  'https://conferences.miccai.org/2026/files/downloads/MICCAI2026-Satellite-Events-Program.pdf';

export function About() {
  const { program } = useProgram();
  const [chartFailed, setChartFailed] = useState(false);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 pb-16 pt-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold leading-tight text-[var(--fg)]">About</h1>
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
          Find the research you care about, build your conference schedule, and take it with you.
          MICCAI Subscribe brings the MICCAI 2026 program into one searchable place — free to use,
          with no account needed.
        </p>
      </header>

      <section aria-labelledby="support-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="support-heading" className="text-lg font-semibold text-[var(--fg)]">
            Make your next stop GitHub.
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            If MICCAI Subscribe helps you plan your conference, give the project a star!
            It&rsquo;s a simple way to support my work and help more people discover it.
            Ideas, issue reports, and contributions are welcome too.
          </p>
        </div>
        <a
          href={REPOSITORY}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-fg)] hover:opacity-90 focus-ring"
        >
          <span aria-hidden="true">★</span> Star on GitHub
        </a>
        <a
          href={REPOSITORY}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit break-all font-mono text-xs text-[var(--fg-muted)] underline underline-offset-4"
        >
          HenryLau7/MICCAI-Subscribe
        </a>
        {/* The img reserves its 800x533 box before it loads, so the fill has to
            read as a surface waiting for content rather than as an empty hole —
            on venue Wi-Fi that wait is long, and this chart is third-party. */}
        <figure className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-subtle)]">
          {chartFailed ? (
            <p className="p-5 text-sm text-[var(--fg-muted)]">
              The chart couldn&rsquo;t load. You can still view the project on Star History below.
            </p>
          ) : (
            <a href={STAR_HISTORY} target="_blank" rel="noopener noreferrer" className="block">
              <picture>
                <source media="(prefers-color-scheme: dark)" srcSet={`${STAR_CHART}&theme=dark`} />
                <img
                  src={STAR_CHART}
                  alt="GitHub star history for MICCAI Subscribe"
                  width="800"
                  height="533"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setChartFailed(true)}
                  className="h-auto w-full"
                />
              </picture>
            </a>
          )}
          <figcaption className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--fg-muted)]">
            <a href={STAR_HISTORY} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline underline-offset-2">
              View on Star History <span aria-hidden="true">↗</span>
            </a>
          </figcaption>
        </figure>
      </section>

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
          <strong className="font-semibold text-[var(--fg)]">{program.meta.fetchedAt.slice(0, 10)}</strong>.
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
          This site does not collect your name, email, institution, or location. There is no backend and no
          account: bookmarks, followed authors, and preferences live only in this browser&rsquo;s local
          storage. The transfer link carries your saved IDs in the part of the URL after the <code>#</code>,
          which browsers never transmit in HTTP requests. Anyone you share that link with can import
          those selections. Downloading a <code>.ics</code> or a backup file writes it straight to your device.
          Using an Add to Google Calendar link sends that event&rsquo;s details to Google.
        </p>
        <p className="text-sm text-[var(--fg-muted)]">
          The chart on this page loads from Star History, which receives your IP address and standard
          request information, but no saved schedule data. External links take you to sites with their
          own privacy policies.
        </p>
      </section>

      <section aria-labelledby="developer-heading" className="flex flex-col gap-2">
        <h2 id="developer-heading" className="text-sm font-semibold text-[var(--fg)]">
          Developer
        </h2>
        <p className="text-sm text-[var(--fg-muted)]">
          Yuanye Liu ·{' '}
          <a
            href="https://www.yuanyeliu.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline underline-offset-2 focus-ring"
          >
            Homepage <span aria-hidden="true">↗</span>
          </a>
        </p>
      </section>
    </div>
  );
}
