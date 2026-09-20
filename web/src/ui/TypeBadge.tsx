import type { PresentationKind, SatelliteType } from '../data/types';

/** Every activity type this app shows, across both presentations and satellite events. */
export type ActivityType = PresentationKind | SatelliteType;

const TYPE_LABEL: Record<ActivityType, string> = {
  oral: 'Oral',
  spotlight: 'Spotlight',
  poster: 'Poster',
  workshop: 'Workshop',
  challenge: 'Challenge',
  tutorial: 'Tutorial',
};

/**
 * Colour groups, not six distinct hues. Six mutually-distinguishable AND
 * AA-legible hues were tried first: the exclusion zones needed to stay clear of the
 * existing accent/danger/warning hues leave only a ~150° arc of the wheel
 * to work with, which crowds four of the six into a green-to-teal cluster.
 * Measured under a standard protanopia/deuteranopia simulation, several of
 * those four pairs come out under 40 (out of ~441) apart in simulated RGB —
 * genuinely hard to tell apart for the most common forms of colour
 * blindness, the same category of user this grouping exists to help, not
 * merely a nominal six that only look distinct to unimpaired vision.
 *
 * Three functional groups avoid that: talks (oral, spotlight — presented
 * live, in a room, at a fixed time), posters (self-guided, found by board
 * number) and satellite events (workshops/challenges/tutorials — the two
 * bookend days, scheduled separately from the main program). Under the same
 * simulation this trio has zero pair under 40 apart, in either colour
 * scheme, against each other AND against the existing accent/danger/warning
 * tokens. The six-word text label is still shown on every badge regardless
 * of group — colour is a reinforcing scan cue, never the only distinguishing
 * means.
 */
type ColorGroup = 'talk' | 'poster' | 'satellite';

const GROUP: Record<ActivityType, ColorGroup> = {
  oral: 'talk',
  spotlight: 'talk',
  poster: 'poster',
  workshop: 'satellite',
  challenge: 'satellite',
  tutorial: 'satellite',
};

const GROUP_STYLE: Record<ColorGroup, string> = {
  talk: 'border-[var(--type-talk-border)] bg-[var(--type-talk-bg)] text-[var(--type-talk)]',
  poster: 'border-[var(--type-poster-border)] bg-[var(--type-poster-bg)] text-[var(--type-poster)]',
  satellite: 'border-[var(--type-satellite-border)] bg-[var(--type-satellite-bg)] text-[var(--type-satellite)]',
};

/**
 * The one place a presentation kind or satellite type gets its colour and
 * label — every component that shows a type badge imports this rather than
 * defining its own colour literals, so the same type reads identically
 * everywhere (PaperCard, PresentationRow, ScheduleItemRow, SessionDetail,
 * SatelliteCard, SatelliteDetail, search results).
 */
export function TypeBadge({ type, className = '' }: { type: ActivityType; className?: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        GROUP_STYLE[GROUP[type]],
        className,
      ].join(' ')}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
