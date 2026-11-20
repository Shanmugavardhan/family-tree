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

  const activeLanes = lanes.filter(
    (lane) => lane.id !== 'unknown_birth_year' && lane.order !== null
  );

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
      {activeLanes.map((lane) => (
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
          {/* Royal Heritage Generation Title (Cormorant Garamond 700) */}
          <div
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: '32px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1.15,
              color: isDark ? '#D6B15C' : '#854d0e',
              textShadow: isDark
                ? '0 2px 12px rgba(0, 0, 0, 0.95), 0 0 16px rgba(214, 177, 92, 0.25)'
                : '0 1px 4px rgba(255, 255, 255, 0.95)',
            }}
          >
            {lane.name}
          </div>

          {/* Timeline Period ONLY (Cormorant Garamond / DM Sans) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 4,
              fontFamily: "'Cormorant Garamond', 'DM Sans', Georgia, serif",
              fontSize: '22px',
              fontWeight: 600,
              color: isDark ? '#9BA3AF' : '#57534e',
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
          </div>
        </div>
      ))}
    </div>
  );
};
