import { NavLink } from 'react-router-dom';

const ITEMS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Explore', icon: '🔍', end: true },
  { to: '/schedule', label: 'Schedule', icon: '🗓️' },
  { to: '/satellite', label: 'Satellite', icon: '🛰️' },
  { to: '/about', label: 'About', icon: 'ℹ️' },
];

/** Fixed bottom tab bar. Labels are always visible text, never icon-only. */
export function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[var(--bg-elevated)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]',
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--fg-muted)]',
                ].join(' ')
              }
            >
              <span aria-hidden="true" className="text-base leading-none">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
