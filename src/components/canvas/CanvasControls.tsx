import React from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Archive,
  Eye,
  Navigation,
  Compass,
} from 'lucide-react';
import { PositionedNode } from '../../types/layout';
import { useTheme } from '../../context/ThemeContext';
import { HEADER_AWARE_FIT_PADDING } from './canvasConstants';

interface CanvasControlsProps {
  nodes: PositionedNode[];
  includeArchived: boolean;
  onToggleIncludeArchived: (val: boolean) => void;
  onSelectPerson: (personId: string) => void;
  focusMode: boolean;
  onToggleFocusMode: (val: boolean) => void;
  onOpenPathfinder: () => void;
  activePathSummary?: string | null;
  onClearActivePath?: () => void;
  onZoomActivity?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  nodes,
  includeArchived,
  onToggleIncludeArchived,
  onSelectPerson,
  focusMode,
  onToggleFocusMode,
  onOpenPathfinder,
  activePathSummary,
  onClearActivePath,
  onZoomActivity,
}) => {
  const { isDark } = useTheme();
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<PositionedNode[]>([]);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!val.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const lower = val.toLowerCase();
    const matches = nodes.filter((n) => {
      const full = `${n.firstName || ''} ${n.lastName || ''}`.toLowerCase();
      return full.includes(lower);
    });
    setSearchResults(matches);
    setIsSearchOpen(true);
  };

  const handleSelectSearchResult = (n: PositionedNode) => {
    onSelectPerson(n.id);
    setSearchTerm(`${n.firstName || ''} ${n.lastName || ''}`.trim());
    setIsSearchOpen(false);
    setCenter(n.x + n.width / 2, n.y + n.height / 2, { duration: 800, zoom: 1.35 });
  };

  const handleZoomInClick = () => {
    onZoomActivity?.();
    zoomIn({ duration: 400 });
  };

  const handleZoomOutClick = () => {
    onZoomActivity?.();
    zoomOut({ duration: 400 });
  };

  const handleFitView = () => {
    onZoomActivity?.();
    const personNodeRefs = nodes.map((n) => ({ id: n.id }));
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
    const fitPadding = isMobileScreen
      ? { top: 76, bottom: 24, left: 16, right: 16 }
      : HEADER_AWARE_FIT_PADDING;
    fitView({
      nodes: personNodeRefs.length > 0 ? personNodeRefs : undefined,
      padding: fitPadding,
      duration: 600,
      maxZoom: 1.35,
      minZoom: isMobileScreen ? 0.2 : undefined,
    });
  };

  const searchSlotEl = typeof document !== 'undefined' ? document.getElementById('header-search-slot') : null;
  const actionsSlotEl = typeof document !== 'undefined' ? document.getElementById('header-canvas-actions') : null;

  return (
    <>
      {/* 1. Injected Header Search Box (Requirement 5) */}
      {isMounted && searchSlotEl && createPortal(
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: isDark ? 'rgba(18, 24, 34, 0.9)' : '#ffffff',
              padding: '6px 14px',
              borderRadius: 10,
              boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.05)',
              border: isDark ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid rgba(197, 155, 39, 0.35)',
              width: 210,
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <Search size={15} color={isDark ? '#d4af37' : '#92400e'} />
            <input
              type="text"
              placeholder="Find family member..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchTerm.trim() && searchResults.length > 0) setIsSearchOpen(true);
              }}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 600,
                color: isDark ? '#f8fafc' : '#1c1917',
                backgroundColor: 'transparent',
              }}
            />
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                backgroundColor: isDark ? '#111622' : '#fcf8ee',
                borderRadius: 10,
                boxShadow: isDark
                  ? '0 12px 30px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(212, 175, 55, 0.3)'
                  : '0 8px 24px rgba(120, 53, 15, 0.15), 0 0 1px 1px rgba(197, 155, 39, 0.3)',
                border: isDark ? '1px solid #2a3342' : '1px solid #e2d7c3',
                maxHeight: 240,
                overflowY: 'auto',
                zIndex: 100,
              }}
            >
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleSelectSearchResult(result)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(197, 155, 39, 0.1)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span
                    style={{
                      fontFamily: "'Marcellus', Georgia, serif",
                      fontWeight: 700,
                      color: isDark ? '#f8fafc' : '#1c1917',
                      fontSize: '0.825rem',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {result.firstName} {result.lastName}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Marcellus', Georgia, serif",
                      fontSize: '0.785rem',
                      color: isDark ? '#d4af37' : '#92400e',
                      fontStyle: 'italic',
                    }}
                  >
                    {result.generationName || 'Lineage'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>,
        searchSlotEl
      )}

      {/* 2. Injected Desktop Header Action Buttons */}
      {isMounted && actionsSlotEl && createPortal(
        <div className="desktop-header-canvas-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Relationship Pathfinder Button */}
          <button
            onClick={onOpenPathfinder}
            title="Trace Kinship & Relationship Path"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: isDark ? '1px solid rgba(212, 175, 55, 0.45)' : '1px solid rgba(180, 83, 9, 0.4)',
              fontFamily: "'Marcellus', Georgia, serif",
              fontSize: '0.785rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              backgroundColor: isDark ? 'rgba(212, 175, 55, 0.16)' : '#fffbeb',
              color: isDark ? '#e5c158' : '#b45309',
              boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            <Compass size={15} color={isDark ? '#e5c158' : '#b45309'} />
            <span>Pathfinder</span>
          </button>

          {/* Toggle Focus Mode */}
          <button
            onClick={() => onToggleFocusMode(!focusMode)}
            title={focusMode ? 'Disable Focus Mode' : 'Dim unrelated branches and highlight direct lineage'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 8,
              border: focusMode
                ? '1px solid #3b82f6'
                : isDark
                ? '1px solid rgba(255, 255, 255, 0.12)'
                : '1px solid rgba(0, 0, 0, 0.12)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: focusMode
                ? isDark ? 'rgba(59, 130, 246, 0.25)' : '#eff6ff'
                : isDark ? '#151922' : '#f8fafc',
              color: focusMode ? (isDark ? '#60a5fa' : '#2563eb') : isDark ? '#9BA3AF' : '#64748b',
            }}
          >
            <Eye size={14} />
            <span>{focusMode ? 'Focus On' : 'Focus'}</span>
          </button>

          {/* Toggle Include Archived */}
          <button
            onClick={() => onToggleIncludeArchived(!includeArchived)}
            title={includeArchived ? 'Hide archived records' : 'Show archived records'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 8,
              border: isDark ? '1px solid #343D49' : '1px solid rgba(0, 0, 0, 0.12)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: includeArchived
                ? isDark ? 'rgba(214, 177, 92, 0.2)' : '#fef3c7'
                : isDark ? '#151922' : '#f8fafc',
              color: includeArchived ? '#D6B15C' : isDark ? '#9BA3AF' : '#64748b',
            }}
          >
            <Archive size={14} />
            <span>{includeArchived ? 'Archived' : 'Active'}</span>
          </button>

          <div style={{ width: 1, height: 18, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0', margin: '0 2px' }} />

          {/* Zoom Buttons (triggers zoom activity for MiniMap) */}
          <button
            onClick={handleZoomInClick}
            title="Zoom In"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOutClick}
            title="Zoom Out"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleFitView}
            title="Fit to View"
            style={{
              padding: '6px 8px',
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>,
        actionsSlotEl
      )}

      {/* 3. Mobile Vertical Floating Navigation Bar (Fit to view, Zoom in, Zoom out ONLY) */}
      <div
        className="mobile-canvas-zoom-bar"
        style={{
          position: 'fixed',
          right: 14,
          bottom: 74,
          zIndex: 45,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          backgroundColor: isDark ? 'rgba(21, 25, 34, 0.94)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: 12,
          padding: 4,
          border: isDark ? '1px solid rgba(214, 177, 92, 0.35)' : '1px solid rgba(197, 155, 39, 0.35)',
          boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.65)' : '0 4px 12px rgba(0, 0, 0, 0.12)',
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={handleFitView}
          className="mobile-canvas-floating-btn"
          title="Fit Tree to View"
          aria-label="Fit to View"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            color: isDark ? '#D6B15C' : '#854d0e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Maximize2 size={17} />
        </button>
        <button
          onClick={handleZoomInClick}
          className="mobile-canvas-floating-btn"
          title="Zoom In"
          aria-label="Zoom In"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            color: isDark ? '#cbd5e1' : '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ZoomIn size={17} />
        </button>
        <button
          onClick={handleZoomOutClick}
          className="mobile-canvas-floating-btn"
          title="Zoom Out"
          aria-label="Zoom Out"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            color: isDark ? '#cbd5e1' : '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ZoomOut size={17} />
        </button>
      </div>

      {/* 4. Mobile Horizontal Floating Action Bar (Pathfinder, Focus, Timeline, Archive) */}
      <div
        className="mobile-canvas-actions-bar"
        style={{
          position: 'fixed',
          left: 14,
          bottom: 16,
          zIndex: 45,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: isDark ? 'rgba(21, 25, 34, 0.95)' : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 14,
          padding: '5px 8px',
          border: isDark ? '1px solid rgba(214, 177, 92, 0.45)' : '1px solid rgba(197, 155, 39, 0.45)',
          boxShadow: isDark
            ? '0 6px 20px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(214, 177, 92, 0.2)'
            : '0 6px 18px rgba(120, 53, 15, 0.15), 0 0 0 1px rgba(197, 155, 39, 0.2)',
          pointerEvents: 'auto',
        }}
      >
        {/* 1. Pathfinder */}
        <button
          onClick={onOpenPathfinder}
          className="mobile-canvas-floating-btn"
          title="Pathfinder (Trace Kinship Path)"
          aria-label="Pathfinder"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: activePathSummary
              ? '1.5px solid #f59e0b'
              : isDark
              ? '1px solid rgba(214, 177, 92, 0.35)'
              : '1px solid rgba(180, 83, 9, 0.35)',
            backgroundColor: activePathSummary
              ? isDark ? 'rgba(245, 158, 11, 0.25)' : '#fef3c7'
              : isDark ? 'rgba(214, 177, 92, 0.16)' : '#fffbeb',
            color: isDark ? '#e5c158' : '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            boxShadow: activePathSummary ? '0 0 10px rgba(245, 158, 11, 0.5)' : 'none',
          }}
        >
          <Compass size={18} />
          {activePathSummary && (
            <span
              style={{
                position: 'absolute',
                top: 3,
                right: 3,
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 6px #f59e0b',
              }}
            />
          )}
        </button>

        {/* 2. Focus Mode */}
        <button
          onClick={() => onToggleFocusMode(!focusMode)}
          className="mobile-canvas-floating-btn"
          title={focusMode ? 'Focus Mode: Active' : 'Focus Mode: Off'}
          aria-label="Focus Mode"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: focusMode
              ? '1.5px solid #3b82f6'
              : isDark
              ? '1px solid rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(0, 0, 0, 0.12)',
            backgroundColor: focusMode
              ? isDark ? 'rgba(59, 130, 246, 0.3)' : '#eff6ff'
              : isDark ? '#151922' : '#f8fafc',
            color: focusMode ? (isDark ? '#60a5fa' : '#2563eb') : isDark ? '#9BA3AF' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: focusMode ? '0 0 10px rgba(59, 130, 246, 0.45)' : 'none',
          }}
        >
          <Eye size={18} />
        </button>

        {/* 3. Archive */}
        <button
          onClick={() => onToggleIncludeArchived(!includeArchived)}
          className="mobile-canvas-floating-btn"
          title={includeArchived ? 'Archive: Showing All' : 'Archive: Hidden'}
          aria-label="Archive"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: includeArchived
              ? '1.5px solid #D6B15C'
              : isDark
              ? '1px solid rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(0, 0, 0, 0.12)',
            backgroundColor: includeArchived
              ? isDark ? 'rgba(214, 177, 92, 0.25)' : '#fef3c7'
              : isDark ? '#151922' : '#f8fafc',
            color: includeArchived ? '#D6B15C' : isDark ? '#9BA3AF' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: includeArchived ? '0 0 10px rgba(214, 177, 92, 0.4)' : 'none',
          }}
        >
          <Archive size={18} />
        </button>
      </div>

      {/* 3. Sleek Floating Active Path Banner (Only when pathfinder result is active) */}
      {activePathSummary && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: isDark ? 'rgba(22, 28, 38, 0.95)' : '#fffbeb',
            border: isDark ? '1.5px solid #d4af37' : '1.5px solid #f59e0b',
            padding: '7px 22px',
            borderRadius: 30,
            boxShadow: isDark
              ? '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(212, 175, 55, 0.35)'
              : '0 6px 18px rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            pointerEvents: 'auto',
            zIndex: 40,
            backdropFilter: 'blur(12px)',
          }}
        >
          <Navigation size={15} color={isDark ? '#e5c158' : '#b45309'} />
          <span
            style={{
              fontFamily: "'Marcellus', Georgia, serif",
              fontSize: '0.85rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: isDark ? '#e5c158' : '#92400e',
            }}
          >
            Kinship Lineage: {activePathSummary}
          </span>
          <button
            onClick={onClearActivePath}
            style={{
              border: 'none',
              background: 'transparent',
              fontFamily: "'Marcellus', Georgia, serif",
              fontSize: '0.785rem',
              fontWeight: 800,
              color: isDark ? '#f8fafc' : '#b45309',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0 4px',
            }}
          >
            Clear
          </button>
        </div>
      )}
    </>
  );
};
