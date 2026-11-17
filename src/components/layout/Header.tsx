import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  Users,
  UserPlus,
  Sun,
  Moon,
  Heart,
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
      {/* Left: Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          to="/tree"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.35)',
              flexShrink: 0,
            }}
          >
            🌳
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              Konukuru Family
            </h1>
            <p
              style={{
                fontSize: '0.725rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Multigenerational Tree
            </p>
          </div>
        </Link>
      </div>

      {/* Center: Navigation Items as Icons */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(241, 245, 249, 0.85)',
          padding: '4px 6px',
          borderRadius: 12,
          border: '1px solid var(--border-color)',
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
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive
                  ? '#2563eb'
                  : 'var(--text-muted)',
                backgroundColor: isActive
                  ? isDark
                    ? '#1e293b'
                    : '#ffffff'
                  : 'transparent',
                boxShadow: isActive
                  ? isDark
                    ? '0 1px 3px rgba(0, 0, 0, 0.4)'
                    : '0 1px 3px rgba(0, 0, 0, 0.08)'
                  : 'none',
                textDecoration: 'none',
                transition: 'all 0.15s ease-in-out',
                cursor: 'pointer',
              })}
            >
              <Icon size={18} />
              <span className="header-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Right: Theme Switcher & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Active Lineage Count Badge */}
        <div
          className="header-lineage-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            padding: '4px 10px',
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
            border: '1px solid var(--border-color)',
          }}
          title="Active family lineage members"
        >
          <Heart size={14} color="#e11d48" fill="#e11d48" />
          <span style={{ fontWeight: 600 }}>14 Members</span>
        </div>

        {/* Dark / Light Mode Switch Button */}
        <button
          onClick={toggleTheme}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid var(--border-color)',
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#fbbf24' : '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: isDark
              ? '0 1px 3px rgba(0, 0, 0, 0.3)'
              : '0 1px 3px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease-in-out',
          }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun size={19} color="#fbbf24" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.5))' }} />
          ) : (
            <Moon size={19} color="#475569" fill="#e2e8f0" />
          )}
        </button>
      </div>
    </header>
  );
};
