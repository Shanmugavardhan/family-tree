import React from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Layers,
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
  compactLanes: boolean;
  onToggleCompactLanes: (val: boolean) => void;
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
  compactLanes,
  onToggleCompactLanes,
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
                fontFamily: "'Cormorant Garamond', Georgia, serif",
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
                      fontFamily: "'Cinzel', serif",
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
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
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

      {/* 2. Injected Header Action Buttons (Requirement 8: Pathfinder, Focus, Timeline, Zoom) */}
      {isMounted && actionsSlotEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
              fontFamily: "'Cinzel', Georgia, serif",
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

          {/* Toggle Compact Lanes */}
          <button
            onClick={() => onToggleCompactLanes(!compactLanes)}
            title={compactLanes ? 'Showing only represented cohorts' : 'Showing all timeline cohorts'}
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
              backgroundColor: compactLanes
                ? isDark ? 'rgba(214, 177, 92, 0.2)' : '#fef3c7'
                : isDark ? '#151922' : '#f8fafc',
              color: compactLanes ? (isDark ? '#D6B15C' : '#92400e') : isDark ? '#9BA3AF' : '#64748b',
            }}
          >
            <Layers size={14} />
            <span>{compactLanes ? 'Compact' : 'Timeline'}</span>
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
            onClick={() => {
              onZoomActivity?.();
              const personNodeRefs = nodes.map((n) => ({ id: n.id }));
              fitView({
                nodes: personNodeRefs.length > 0 ? personNodeRefs : undefined,
                padding: HEADER_AWARE_FIT_PADDING,
                duration: 600,
                maxZoom: 1.35,
              });
            }}
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
              fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
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
              fontFamily: "'Cinzel', serif",
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
