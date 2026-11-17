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
} from 'lucide-react';
import { CohortLane, PositionedNode } from '../../types/layout';

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
}) => {
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
    // Center canvas smoothly on the selected node
    setCenter(n.x + n.width / 2, n.y + n.height / 2, { duration: 800, zoom: 1.1 });
  };

  const handleJumpToLane = (lane: CohortLane) => {
    // Find average X or first node in lane
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
        top: 16,
        left: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      {/* Left: Quick Search & Generation Jump */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
        {/* Search Input with dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#ffffff',
              padding: '8px 14px',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0',
              width: 240,
            }}
          >
            <Search size={16} color="#64748b" />
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
                color: '#0f172a',
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
                backgroundColor: '#ffffff',
                borderRadius: 10,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                border: '1px solid #e2e8f0',
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
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {result.firstName} {result.lastName}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
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
            backgroundColor: '#ffffff',
            padding: '8px 12px',
            borderRadius: 10,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e2e8f0',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#334155',
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

      {/* Right: View & Filter Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#ffffff',
          padding: '6px 10px',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          pointerEvents: 'auto',
        }}
      >
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
          <span>{compactLanes ? 'Compact Lanes' : 'Full Timeline'}</span>
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
          <span>{includeArchived ? 'Archived Visible' : 'Active Only'}</span>
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: '#e2e8f0', margin: '0 4px' }} />

        {/* Zoom & Fit View Buttons */}
        <button
          onClick={() => zoomIn()}
          title="Zoom In"
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => zoomOut()}
          title="Zoom Out"
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => fitView({ padding: 0.15, duration: 600 })}
          title="Fit to View"
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#475569',
          }}
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={() => fitView({ duration: 600 })}
          title="Reset View"
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#475569',
          }}
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
            background: showMiniMap ? '#eff6ff' : 'transparent',
            cursor: 'pointer',
            color: showMiniMap ? '#2563eb' : '#475569',
          }}
        >
          <Map size={16} />
        </button>
      </div>
    </div>
  );
};
