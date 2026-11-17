import React from 'react';
import { useViewport, useOnViewportChange } from '@xyflow/react';
import { CohortLane } from '../../types/layout';
import { useTheme } from '../../context/ThemeContext';

interface StickyGenerationLabelsProps {
  lanes: CohortLane[];
}

export const StickyGenerationLabels: React.FC<StickyGenerationLabelsProps> = ({ lanes }) => {
  const { isDark } = useTheme();
  const { y, zoom } = useViewport();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Directly sync vertical transform with zero latency during drag/pan
  useOnViewportChange({
    onChange: ({ y: vy, zoom: vz }) => {
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(0, ${vy}px, 0) scale(${vz})`;
      }
    },
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 480,
        pointerEvents: 'none',
        zIndex: 10,
        transform: `translate3d(0, ${y}px, 0) scale(${zoom})`,
        transformOrigin: '0 0',
        willChange: 'transform',
      }}
    >
      {lanes.map((lane) => (
        <div
          key={lane.id}
          style={{
            position: 'absolute',
            top: lane.y + 28,
            left: 36,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            pointerEvents: 'none',
            opacity: isDark ? 0.35 : 0.42, // Reduced opacity per Request 4
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          {/* Game of Thrones Style Noble Generation Title (No Box) */}
          <div
            style={{
              fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
              fontSize: '28px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              lineHeight: 1.15,
              color: isDark ? '#e5c158' : '#78350f',
              textShadow: isDark
                ? '0 2px 10px rgba(0, 0, 0, 0.95), 0 0 16px rgba(229, 193, 88, 0.35)'
                : '0 1px 4px rgba(255, 255, 255, 0.95), 0 1px 8px rgba(120, 53, 15, 0.2)',
            }}
          >
            {lane.name}
          </div>

          {/* Timeline Period ONLY (People count removed per Request 4) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 6,
              fontFamily: "'Cormorant Garamond', 'Cinzel', Georgia, serif",
              fontSize: '20px',
              fontWeight: 700,
              color: isDark ? '#cbd5e1' : '#57534e',
              letterSpacing: '0.06em',
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
          </div>
        </div>
      ))}
    </div>
  );
};
