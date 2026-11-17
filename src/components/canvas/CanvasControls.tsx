import React from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Map,
  Archive,
  Layers,
  ArrowLeft,
  ArrowRight,
  Eye,
  Navigation,
} from 'lucide-react';
import { CohortLane, PositionedNode } from '../../types/layout';
import { useTheme } from '../../context/ThemeContext';

interface CanvasControlsProps {
  nodes: PositionedNode[];
  lanes: CohortLane[];
  includeArchived: boolean;
  onToggleIncludeArchived: (val: boolean) => void;
  compactLanes: boolean;
  onToggleCompactLanes: (val: boolean) => void;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
  onSelectPerson: (personId: string) => void;

  // Milestone 3.5 Interaction & Navigation controls
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  focusMode: boolean;
  onToggleFocusMode: (val: boolean) => void;
  onOpenPathfinder: () => void;
  activePathSummary?: string | null;
  onClearActivePath?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
  nodes,
  lanes,
  includeArchived,
  onToggleIncludeArchived,
  compactLanes,
  onToggleCompactLanes,
  showMiniMap,
  onToggleMiniMap,
  onSelectPerson,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  focusMode,
  onToggleFocusMode,
  onOpenPathfinder,
  activePathSummary,
  onClearActivePath,
}) => {
  const { isDark } = useTheme();
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<PositionedNode[]>([]);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

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
    setCenter(n.x + n.width / 2, n.y + n.height / 2, { duration: 800, zoom: 1.1 });
  };

  const handleJumpToLane = (lane: CohortLane) => {
    const nodesInLane = nodes.filter((n) =>
      lane.order !== null ? n.generationOrder === lane.order : n.generationOrder === null
    );
    const targetX = nodesInLane.length > 0
      ? nodesInLane[0].x + nodesInLane[0].width / 2
      : 300;
    const targetY = lane.y + lane.height / 2;

    setCenter(targetX, targetY, { duration: 800, zoom: 0.9 });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 76,
        left: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {/* Top Bar: Search, Navigation History, View Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {/* Left Side: Navigation History & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          {/* History Back & Forward */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: 10,
              boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              padding: '2px',
            }}
          >
            <button
              onClick={onGoBack}
              disabled={!canGoBack}
              title="Previous Person (Back)"
              style={{
                padding: '6px 8px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                cursor: canGoBack ? 'pointer' : 'not-allowed',
                color: canGoBack ? (isDark ? '#f8fafc' : '#0f172a') : (isDark ? '#475569' : '#cbd5e1'),
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
            <button
              onClick={onGoForward}
              disabled={!canGoForward}
              title="Next Person (Forward)"
              style={{
                padding: '6px 8px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                cursor: canGoForward ? 'pointer' : 'not-allowed',
                color: canGoForward ? (isDark ? '#f8fafc' : '#0f172a') : (isDark ? '#475569' : '#cbd5e1'),
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Search Input with dropdown */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                padding: '8px 14px',
                borderRadius: 10,
                boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                width: 230,
              }}
            >
              <Search size={16} color={isDark ? '#94a3b8' : '#64748b'} />
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
                  fontSize: '0.875rem',
                  color: isDark ? '#f8fafc' : '#0f172a',
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
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  borderRadius: 10,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  maxHeight: 220,
                  overflowY: 'auto',
                  zIndex: 50,
                }}
              >
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => handleSelectSearchResult(result)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? '#334155' : '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isDark ? '#1e293b' : '#ffffff')}
                  >
                    <span style={{ fontWeight: 600, color: isDark ? '#f8fafc' : '#0f172a' }}>
                      {result.firstName} {result.lastName}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                      {result.generationName || 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generation Jump Dropdown */}
          <select
            onChange={(e) => {
              const laneId = e.target.value;
              const lane = lanes.find((l) => l.id === laneId);
              if (lane) handleJumpToLane(lane);
            }}
            defaultValue=""
            style={{
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              padding: '8px 12px',
              borderRadius: 10,
              boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: isDark ? '#f8fafc' : '#334155',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="" disabled>Jump to generation...</option>
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.nodeCount})
              </option>
            ))}
          </select>
        </div>

        {/* Right Side: Tools & View Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            padding: '6px 10px',
            borderRadius: 12,
            boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            pointerEvents: 'auto',
          }}
        >
          {/* Relationship Pathfinder Button */}
          <button
            onClick={onOpenPathfinder}
            title="Relationship Pathfinder (How are two people related?)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 8,
              border: isDark ? '1px solid #78350f' : '1px solid #fde68a',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activePathSummary
                ? '#f59e0b'
                : isDark
                ? '#451a03'
                : '#fffbeb',
              color: activePathSummary
                ? '#ffffff'
                : isDark
                ? '#fbbf24'
                : '#b45309',
            }}
          >
            <Navigation size={14} />
            <span>Pathfinder</span>
          </button>

          {/* Focus Mode Button */}
          <button
            onClick={() => onToggleFocusMode(!focusMode)}
            title={focusMode ? 'Disable Focus Mode' : 'Enable Focus Mode (isolate selected family branch)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 8,
              border: focusMode ? '1px solid #3b82f6' : 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: focusMode
                ? isDark
                  ? 'rgba(59, 130, 246, 0.25)'
                  : '#eff6ff'
                : isDark
                ? '#0f172a'
                : '#f8fafc',
              color: focusMode
                ? '#3b82f6'
                : isDark
                ? '#94a3b8'
                : '#64748b',
            }}
          >
            <Eye size={14} />
            <span>{focusMode ? 'Focus On' : 'Focus Mode'}</span>
          </button>

          <div style={{ width: 1, height: 20, backgroundColor: isDark ? '#334155' : '#e2e8f0', margin: '0 2px' }} />

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
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: compactLanes ? '#eff6ff' : '#f8fafc',
              color: compactLanes ? '#2563eb' : '#64748b',
            }}
          >
            <Layers size={14} />
            <span>{compactLanes ? 'Compact' : 'Full Timeline'}</span>
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
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: includeArchived ? '#fef3c7' : '#f8fafc',
              color: includeArchived ? '#b45309' : '#64748b',
            }}
          >
            <Archive size={14} />
            <span>{includeArchived ? 'Archived Visible' : 'Active'}</span>
          </button>

          <div style={{ width: 1, height: 20, backgroundColor: '#e2e8f0', margin: '0 2px' }} />

          {/* Zoom & Fit View Buttons */}
          <button
            onClick={() => zoomIn()}
            title="Zoom In"
            style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#475569' }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => zoomOut()}
            title="Zoom Out"
            style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#475569' }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => fitView({ padding: 0.15, duration: 600 })}
            title="Fit to View"
            style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#475569' }}
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => fitView({ duration: 600 })}
            title="Reset View"
            style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: isDark ? '#cbd5e1' : '#475569' }}
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onToggleMiniMap}
            title={showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
            style={{
              padding: 6,
              borderRadius: 6,
              border: 'none',
              background: showMiniMap ? (isDark ? 'rgba(59, 130, 246, 0.25)' : '#eff6ff') : 'transparent',
              cursor: 'pointer',
              color: showMiniMap ? '#3b82f6' : (isDark ? '#cbd5e1' : '#475569'),
            }}
          >
            <Map size={16} />
          </button>
        </div>
      </div>

      {/* Active Path Banner if pathfinder result active */}
      {activePathSummary && (
        <div
          style={{
            alignSelf: 'center',
            backgroundColor: isDark ? '#451a03' : '#fffbeb',
            border: `1.5px solid ${isDark ? '#78350f' : '#fde68a'}`,
            padding: '6px 16px',
            borderRadius: 20,
            boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.5)' : '0 4px 12px rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'auto',
          }}
        >
          <Navigation size={14} color="#b45309" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#78350f' }}>
            Active Path: {activePathSummary}
          </span>
          <button
            onClick={onClearActivePath}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#b45309',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '0 4px',
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
