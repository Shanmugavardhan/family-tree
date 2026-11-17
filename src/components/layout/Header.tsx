import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  Users,
  UserPlus,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  isCanvasPage?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isCanvasPage = false }) => {
  const { toggleTheme, isDark } = useTheme();

  const navItems = [
    {
      to: '/',
      end: true,
      label: 'Dashboard',
      icon: LayoutDashboard,
      title: 'Family Dashboard & Overview',
    },
    {
      to: '/tree',
      end: false,
      label: 'Family Tree',
      icon: GitFork,
      title: 'Chronological Interactive Tree Canvas',
    },
    {
      to: '/people',
      end: true,
      label: 'Directory',
      icon: Users,
      title: 'Family Directory & Kinship Profiles',
    },
    {
      to: '/people/new',
      end: false,
      label: 'Add Member',
      icon: UserPlus,
      title: 'Add New Family Member',
    },
  ];

  return (
    <header
      className={`header ${isCanvasPage ? 'canvas-header' : ''}`}
      style={
        isCanvasPage
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: isDark ? 'rgba(11, 15, 25, 0.55)' : 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.07)',
              boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
            }
          : undefined
      }
    >
      {/* Left: Brand Identity (House of Konukuru - Game of Thrones nobility styling) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link
          to="/tree"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: isDark
                ? 'linear-gradient(135deg, #d4af37 0%, #997a15 100%)'
                : 'linear-gradient(135deg, #c59b27 0%, #78350f 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              boxShadow: isDark
                ? '0 2px 12px rgba(212, 175, 55, 0.45)'
                : '0 2px 10px rgba(120, 53, 15, 0.25)',
              flexShrink: 0,
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            🛡️
          </div>
          <div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '1.35rem',
                fontWeight: 700,
                color: isDark ? '#D6B15C' : '#854d0e',
                lineHeight: 1.15,
                letterSpacing: '0.04em',
                textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
              }}
            >
              House of Konukuru
            </h1>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: '0.9rem',
                color: isDark ? '#9BA3AF' : '#78716c',
                fontWeight: 600,
                letterSpacing: '0.02em',
                fontStyle: 'italic',
              }}
            >
              Chronicles of the Lineage
            </p>
          </div>
        </Link>
      </div>

      {/* Search Slot: Injected directly into the Header (Requirement 5) */}
      <div id="header-search-slot" style={{ display: 'flex', alignItems: 'center' }} />

      {/* Center: Navigation Items */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: isDark ? 'rgba(22, 28, 38, 0.75)' : 'rgba(244, 237, 224, 0.85)',
          padding: '4px 6px',
          borderRadius: 12,
          border: isDark ? '1px solid rgba(212, 175, 55, 0.25)' : '1px solid rgba(197, 155, 39, 0.35)',
        }}
        aria-label="Main Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.title}
              className={({ isActive }) => `header-nav-item ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 12px',
                borderRadius: 8,
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: '0.01em',
                color: isActive
                  ? isDark ? '#D6B15C' : '#854d0e'
                  : isDark ? '#9BA3AF' : '#78716c',
                backgroundColor: isActive
                  ? isDark ? 'rgba(214, 177, 92, 0.16)' : '#ffffff'
                  : 'transparent',
                boxShadow: isActive
                  ? isDark ? '0 1px 4px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(212, 175, 55, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.08)'
                  : 'none',
                textDecoration: 'none',
                transition: 'all 0.15s ease-in-out',
                cursor: 'pointer',
              })}
            >
              <Icon size={16} />
              <span className="header-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Right: Canvas Actions Slot (Requirement 8) + Theme Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Canvas Actions Slot (Pathfinder, Focus Mode, Timeline, Zoom) */}
        <div id="header-canvas-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }} />

        {/* Active Lineage Count Badge */}
        <div
          className="header-lineage-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: "'Cinzel', Georgia, serif",
            fontSize: '0.785rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: isDark ? '#e5c158' : '#78350f',
            padding: '5px 12px',
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(197, 155, 39, 0.12)',
            border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(197, 155, 39, 0.3)',
          }}
          title="Active House members recorded in lineage"
        >
          <span>⚔️</span>
          <span>14 Members</span>
        </div>

        {/* Dark / Light Mode Switch Button */}
        <button
          onClick={toggleTheme}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(197, 155, 39, 0.3)',
            backgroundColor: isDark ? '#161c26' : '#ffffff',
            color: isDark ? '#fbbf24' : '#78350f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isDark
              ? '0 1px 4px rgba(0, 0, 0, 0.4)'
              : '0 1px 3px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease-in-out',
          }}
          title={isDark ? 'Switch to Light Realm' : 'Switch to Dark Realm'}
          aria-label={isDark ? 'Switch to Light Realm' : 'Switch to Dark Realm'}
        >
          {isDark ? (
            <Sun size={18} color="#fbbf24" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))' }} />
          ) : (
            <Moon size={18} color="#78350f" fill="#fef3c7" />
          )}
        </button>
      </div>
    </header>
  );
};
