/**
 * The app's icon set: inline SVG, 24×24, drawn on a 24-unit grid with a
 * 1.6px stroke in `currentColor`.
 *
 * These replace the emoji the bottom bar used to carry. Emoji are rendered by
 * the platform, not by us: the same tab bar came out flat-blue-glyph on iOS,
 * outlined on Android and grey-on-grey on desktop Chrome, at sizes we could
 * not set and with no way to make the active tab's icon take the accent
 * colour. Being real paths, these take `currentColor` and one stroke weight
 * everywhere, so the active tab actually looks active.
 *
 * Inline rather than a sprite or an icon package: six paths cost less than a
 * dependency, and nothing here needs to be fetched on a venue connection.
 */
import type { ReactNode } from 'react';

interface IconProps {
  /** Rendered size in px. Defaults to 24. */
  size?: number;
  className?: string;
}

function Svg({ size = 24, className = '', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Explore / search. */
export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Svg>
  );
}

/** Schedule — a calendar with one day marked, which is what this tab shows. */
export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7.75 14.5h2.5v2.5h-2.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Satellite events — the two bookend days orbiting the main conference. */
export function IconSatellite(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-28 12 12)" />
    </Svg>
  );
}

/** About / info. */
export function IconInfo(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.75h.01" />
    </Svg>
  );
}

/** Empty search results — a magnifier with nothing under it. */
export function IconNoResults(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6M8.5 11h5" />
    </Svg>
  );
}

/** Empty schedule — an unmarked calendar, waiting to be filled. */
export function IconEmptyCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4" />
    </Svg>
  );
}

/** Empty filter result — a funnel that let nothing through. */
export function IconFilter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h16l-6.2 7.3v5.4L10.2 20v-7.7z" />
    </Svg>
  );
}
