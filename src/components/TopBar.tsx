// ============================================================
// TopBar — App header with TT wordmark, theme selector, nav
// ============================================================

import { NavLink } from 'react-router-dom';
import TTWordmark from './TTWordmark';
import type { Theme } from '../types';

interface TopBarProps {
  themes: Theme[];
  activeThemeId: string | null;
  onThemeChange: (themeId: string) => void;
  onCreateTheme: () => void;
}

export default function TopBar({ themes, activeThemeId, onThemeChange, onCreateTheme }: TopBarProps) {
  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <NavLink to="/" style={styles.logoLink}>
          <TTWordmark height={17} />
        </NavLink>
        <div style={styles.divider} />
        <div style={styles.themeSelector}>
          <label style={styles.label} htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            style={styles.select}
            value={activeThemeId ?? ''}
            onChange={(e) => {
              if (e.target.value === '__create__') {
                onCreateTheme();
              } else {
                onThemeChange(e.target.value);
              }
            }}
          >
            {themes.length === 0 && (
              <option value="">No themes yet</option>
            )}
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__create__">+ Create theme</option>
          </select>
        </div>
      </div>

      <nav style={styles.nav}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/library"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Causal Loop Dynamics
        </NavLink>
        <NavLink
          to="/multi-futures"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Stress Zone
        </NavLink>
        <NavLink
          to="/system-map"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          System Map
        </NavLink>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}
        >
          Settings
        </NavLink>
      </nav>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
    background: 'rgba(23, 23, 23, 0.72)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    boxShadow: '0 1px 22px rgba(111, 212, 160, 0.08), 0 8px 32px rgba(0,0,0,0.35)',
    flexShrink: 0,
    zIndex: 100,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
  },
  divider: {
    width: 1,
    height: 24,
    background: 'var(--n300)',
  },
  themeSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.13em',
    textTransform: 'uppercase' as const,
    color: 'var(--n700)',
  },
  select: {
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--n1100)',
    background: 'var(--n200)',
    border: '1px solid var(--n300)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 28px 4px 10px',
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%237C868E' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  },
  nav: {
    display: 'flex',
    gap: 4,
  },
  navLink: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--n700)',
    textDecoration: 'none',
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s, background 0.15s',
  },
  navLinkActive: {
    color: 'var(--accent)',
    background: 'var(--g100)',
  },
};