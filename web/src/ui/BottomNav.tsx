import { NavLink } from 'react-router-dom';
import { IconCalendar, IconInfo, IconSatellite, IconSearch } from './icons';

const ITEMS: {
  to: string;
  label: string;
  Icon: (props: { size?: number; className?: string }) => React.ReactElement;
  end?: boolean;
}[] = [
  { to: '/', label: 'Explore', Icon: IconSearch, end: true },
  { to: '/schedule', label: 'Schedule', Icon: IconCalendar },
  { to: '/satellite', label: 'Satellite', Icon: IconSatellite },
  { to: '/about', label: 'About', Icon: IconInfo },
];

/**
 * Fixed bottom tab bar. Labels are always visible text, never icon-only.
 *
 * The active tab is marked twice over: the accent colour, and a filled pill
 * behind its icon. Colour alone would be the only cue for which tab you are
 * on, which is precisely the case where colour alone is not enough — the pill
 * is a shape difference that survives any colour vision, and aria-current
 * (set by NavLink) carries it for screen readers.
 *
 * The focus ring is inset: an outward ring on a control flush against the
 * screen edge gets clipped by the bar.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'focus-ring-inset flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium transition-colors',
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-[var(--accent-soft)]' : 'bg-transparent',
                    ].join(' ')}
                  >
                    <Icon size={20} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
