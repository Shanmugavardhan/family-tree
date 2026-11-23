import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Search,
  KeyRound,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLineage } from '../../context/LineageContext';
import { personApi } from '../../services/personApi';
import { Person } from '../../types/person';

interface HeaderProps {
  isCanvasPage?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isCanvasPage = false }) => {
  const { isDark } = useTheme();
  const { activeLineage, unlockWithCode, isFirstTimeLocked } = useLineage();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Person[]>([]);

  // Requirement 4: Header Family Code state
  const [headerCodeInput, setHeaderCodeInput] = useState('');
  const [headerCodeStatus, setHeaderCodeStatus] = useState<string | null>(null);

  const handleHeaderCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerCodeInput.trim()) return;
    const res = unlockWithCode(headerCodeInput);
    if (res.success) {
      setHeaderCodeStatus('Unlocked!');
      setHeaderCodeInput('');
      setTimeout(() => setHeaderCodeStatus(null), 2500);
    } else {
      setHeaderCodeStatus(res.error || 'Invalid code');
      setTimeout(() => setHeaderCodeStatus(null), 3000);
    }
  };

  // Auto-close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [location.pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch person list for mobile hamburger search
  useEffect(() => {
    let active = true;
    personApi.getAll({ includeArchived: false }).then((res) => {
      if (active && res.success && res.data) {
        setAllPersons(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = query.toLowerCase();
    const matches = allPersons.filter((p) => {
      const full = `${p.first_name} ${p.middle_name || ''} ${p.last_name || ''}`.toLowerCase();
      return full.includes(lower);
    });
    setSearchResults(matches);
  };

  const handleSelectSearchResult = (p: Person) => {
    setIsMobileMenuOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/?personId=${p.id}`);
  };

  return (
    <>
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
                backgroundColor: isDark ? 'rgba(11, 15, 25, 0.65)' : 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.07)',
                boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.35)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
              }
            : undefined
        }
      >
        {/* Left: Brand Identity (House of Konukuru) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
            }}
          >
            <div
              className="header-brand-logo"
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
                className="header-brand-title"
                style={{
                  fontFamily: "'Marcellus', Georgia, serif",
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: isDark ? '#D6B15C' : '#854d0e',
                  lineHeight: 1.15,
                  letterSpacing: '0.03em',
                  textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.8)' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {isFirstTimeLocked ? 'The Family Tree' : activeLineage.name}
              </h1>
              <p
                className="header-brand-subtitle"
                style={{
                  fontFamily: "'Marcellus', Georgia, serif",
                  fontSize: '0.875rem',
                  color: isDark ? '#9BA3AF' : '#78716c',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  fontStyle: 'italic',
                  whiteSpace: 'nowrap',
                }}
              >
                {isFirstTimeLocked ? 'Private Family Archives' : (activeLineage.description || 'Ancestral Lineage Archives')}
              </p>
            </div>
          </Link>
        </div>

        {/* Search Slot: Injected for Desktop View */}
        <div id="header-search-slot" className="header-search-container" style={{ display: 'flex', alignItems: 'center' }} />

        {/* Right: Desktop Actions & Member Count (Desktop View Only - Hidden on Mobile via CSS) */}
        <div className="header-actions-desktop" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Canvas Actions Slot (Pathfinder, Focus Mode, Timeline, Zoom) */}
          <div id="header-canvas-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }} />

          {/* Requirement 4: Header Family Code text box */}
          <form
            onSubmit={handleHeaderCodeSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(18, 24, 34, 0.85)' : '#ffffff',
                border: isDark ? '1px solid rgba(212, 175, 55, 0.4)' : '1px solid rgba(197, 155, 39, 0.4)',
                borderRadius: 18,
                padding: '3px 6px 3px 10px',
                gap: 6,
                boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 6px rgba(0, 0, 0, 0.05)',
                transition: 'border-color 0.15s ease',
              }}
            >
              <KeyRound size={13} color={isDark ? '#D6B15C' : '#854d0e'} />
              <input
                type="password"
                placeholder="Family Code..."
                value={headerCodeInput}
                onChange={(e) => setHeaderCodeInput(e.target.value.toUpperCase())}
                style={{
                  width: 102,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.785rem',
                  fontWeight: 650,
                  letterSpacing: '0.04em',
                  color: isDark ? '#F1E9D7' : '#1D2633',
                }}
              />
              <button
                type="submit"
                title="Unlock lineage with Family Code"
                style={{
                  border: 'none',
                  background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
                  color: '#10141d',
                  borderRadius: 12,
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                Go
              </button>
            </div>

            {/* Status tooltip/toast */}
            {headerCodeStatus && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  backgroundColor: headerCodeStatus === 'Unlocked!' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 650,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  zIndex: 60,
                }}
              >
                {headerCodeStatus}
              </div>
            )}
          </form>

          {/* Active Lineage Count Badge (Requirement 8: swords removed) */}
          <div
            className="header-lineage-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: "'Marcellus', Georgia, serif",
              fontSize: '0.785rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: isDark ? '#e5c158' : '#78350f',
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(197, 155, 39, 0.12)',
              border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(197, 155, 39, 0.3)',
            }}
            title="Active family members recorded in tree"
          >
            <span>{isFirstTimeLocked ? 'Private Access' : `${activeLineage.memberCount} Members`}</span>
          </div>
        </div>

        {/* Mobile View: Hamburger Menu Button (Requirement 4) */}
        <div className="header-mobile-controls" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="header-hamburger-btn"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            title={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: isDark ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid rgba(197, 155, 39, 0.45)',
              backgroundColor: isDark ? 'rgba(21, 25, 34, 0.9)' : '#ffffff',
              color: isDark ? '#D6B15C' : '#854d0e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.06)',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay & Menu (Requirement 4: Remaining header nav items in hamburger menu hidden) */}
      {isMobileMenuOpen && (
        <div
          className="header-mobile-drawer-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 13, 20, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            className="header-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(330px, 86vw)',
              height: '100%',
              backgroundColor: isDark ? '#151922' : '#ffffff',
              borderLeft: isDark ? '1px solid rgba(214, 177, 92, 0.35)' : '1px solid rgba(197, 155, 39, 0.35)',
              boxShadow: isDark ? '-8px 0 30px rgba(0, 0, 0, 0.85)' : '-8px 0 25px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              padding: '18px 16px',
              boxSizing: 'border-box',
              overflowY: 'auto',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Drawer Header: Title & Close Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: isDark ? '1px solid #242B35' : '1px solid #f1e9d7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
                <div>
                  <div
                    style={{
                      fontFamily: "'Marcellus', Georgia, serif",
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: isDark ? '#D6B15C' : '#854d0e',
                      lineHeight: 1.1,
                    }}
                  >
                    {activeLineage.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Marcellus', Georgia, serif",
                      fontSize: '0.785rem',
                      fontStyle: 'italic',
                      color: isDark ? '#9BA3AF' : '#78716c',
                    }}
                  >
                    Menu & Navigation
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: isDark ? '#9BA3AF' : '#64748b',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Requirement 4: Mobile Family Code Box */}
            <form
              onSubmit={(e) => {
                handleHeaderCodeSubmit(e);
                setIsMobileMenuOpen(false);
              }}
              style={{ marginBottom: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(18, 24, 34, 0.9)' : '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: isDark ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid rgba(197, 155, 39, 0.35)',
                  gap: 8,
                }}
              >
                <KeyRound size={16} color={isDark ? '#d4af37' : '#92400e'} />
                <input
                  type="text"
                  placeholder="Enter Family Code..."
                  value={headerCodeInput}
                  onChange={(e) => setHeaderCodeInput(e.target.value.toUpperCase())}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 650,
                    letterSpacing: '0.04em',
                    color: isDark ? '#f8fafc' : '#1c1917',
                    backgroundColor: 'transparent',
                  }}
                />
                <button
                  type="submit"
                  style={{
                    border: 'none',
                    background: 'linear-gradient(135deg, #d4af37 0%, #b8972e 100%)',
                    color: '#10141d',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Unlock
                </button>
              </div>
            </form>

            {/* Mobile Search Box */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isDark ? 'rgba(18, 24, 34, 0.9)' : '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(197, 155, 39, 0.3)',
                }}
              >
                <Search size={16} color={isDark ? '#d4af37' : '#92400e'} />
                <input
                  type="text"
                  placeholder="Find family member..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  style={{
                    border: 'none',
                    outline: 'none',
                    width: '100%',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.85rem',
                    color: isDark ? '#f8fafc' : '#1c1917',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>

              {/* Mobile Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    backgroundColor: isDark ? '#111622' : '#ffffff',
                    borderRadius: 10,
                    border: isDark ? '1px solid #2a3342' : '1px solid #e2d7c3',
                    maxHeight: 180,
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  {searchResults.map((person) => {
                    const name = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
                    return (
                      <div
                        key={person.id}
                        onClick={() => handleSelectSearchResult(person)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '0.825rem',
                          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: isDark ? '#F1E9D7' : '#1e293b',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{name}</span>
                        <span style={{ fontSize: '0.75rem', color: isDark ? '#D6B15C' : '#854d0e', fontStyle: 'italic' }}>
                          View
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Utilities: Lineage Badge */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 16,
                borderTop: isDark ? '1px solid #242B35' : '1px solid #f1e9d7',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Lineage Badge (swords removed) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Marcellus', Georgia, serif",
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: isDark ? '#e5c158' : '#78350f',
                  padding: '8px 12px',
                  borderRadius: 10,
                  backgroundColor: isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(197, 155, 39, 0.12)',
                  border: isDark ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid rgba(197, 155, 39, 0.3)',
                }}
              >
                <span>{activeLineage.memberCount} Active Members in Lineage</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
