import React from 'react';
import { useViewport } from '@xyflow/react';
import { CohortLane } from '../../types/layout';
import { useTheme } from '../../context/ThemeContext';

interface StickyGenerationLabelsProps {
  lanes: CohortLane[];
}

export const StickyGenerationLabels: React.FC<StickyGenerationLabelsProps> = ({ lanes }) => {
  const { isDark } = useTheme();
  const { y, zoom } = useViewport();

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 480,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {lanes.map((lane) => {
        const screenY = lane.y * zoom + y;
        const screenHeight = lane.height * zoom;

        // Skip rendering if lane is scrolled completely out of viewport
        if (screenY + screenHeight < -100 || screenY > (typeof window !== 'undefined' ? window.innerHeight + 100 : 2000)) {
          return null;
        }

        return (
          <div
            key={lane.id}
            style={{
              position: 'absolute',
              top: screenY + Math.max(16, 26 * zoom),
              left: 36,
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
              transition: 'top 0.05s ease-out',
            }}
          >
            {/* Game of Thrones Style Noble Generation Title (No Box) */}
            <div
              style={{
                fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
                fontSize: `${Math.max(20, Math.min(32, 28 * zoom))}px`,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                lineHeight: 1.15,
                color: isDark ? '#e5c158' : '#78350f',
                textShadow: isDark
                  ? '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 16px rgba(229, 193, 88, 0.35)'
                  : '0 1px 4px rgba(255, 255, 255, 0.95), 0 1px 8px rgba(120, 53, 15, 0.2)',
              }}
            >
              {lane.name}
            </div>

            {/* Timeline Period & Member Count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 6,
                fontFamily: "'Cormorant Garamond', 'Cinzel', Georgia, serif",
                fontSize: `${Math.max(15, Math.min(24, 21 * zoom))}px`,
                fontWeight: 700,
                color: isDark ? '#cbd5e1' : '#57534e',
                letterSpacing: '0.04em',
                textShadow: isDark ? '0 1px 6px rgba(0, 0, 0, 0.9)' : 'none',
              }}
            >
              {lane.startYear && lane.endYear ? (
                <span>
                  {lane.startYear} – {lane.endYear}
                </span>
              ) : (
                <span style={{ fontStyle: 'italic', opacity: 0.85 }}>Historical Epoch</span>
              )}
              <span style={{ opacity: 0.6 }}>•</span>
              <span style={{ color: isDark ? '#e5c158' : '#92400e' }}>
                {lane.nodeCount} {lane.nodeCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
