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
  const labelRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const activeLanes = lanes.filter(
    (lane) => lane.id !== 'unknown_birth_year' && lane.order !== null
  );

  // Requirement 1: Generation names increase in size along with zoom out, and decrease in size with zoom in
  const computeScale = (vz: number) =>
    Math.min(1.85, Math.max(0.65, Math.pow(1 / Math.max(0.18, vz), 0.58)));

  // Directly sync vertical transform and inverse zoom scale with zero latency during drag/pan/zoom
  useOnViewportChange({
    onChange: ({ y: vy, zoom: vz }) => {
      const scale = computeScale(vz);
      activeLanes.forEach((lane) => {
        const el = labelRefs.current.get(lane.id);
        if (el) {
          const top = vy + (lane.y + 24) * vz;
          el.style.transform = `translate3d(36px, ${top}px, 0) scale(${scale})`;
        }
      });
    },
  });

  const initialScale = computeScale(zoom);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      {activeLanes.map((lane) => {
        const top = y + (lane.y + 24) * zoom;
        return (
          <div
            key={lane.id}
            ref={(el) => {
              if (el) {
                labelRefs.current.set(lane.id, el);
              } else {
                labelRefs.current.delete(lane.id);
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
              pointerEvents: 'none',
              transform: `translate3d(36px, ${top}px, 0) scale(${initialScale})`,
              transformOrigin: 'top left',
              willChange: 'transform',
              opacity: isDark ? 0.9 : 0.95,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            {/* Royal Heritage Generation Title (Marcellus) - Size matches Person Names (15.5px) */}
            <div
              style={{
                fontFamily: "'Marcellus', Georgia, serif",
                fontSize: '15.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                lineHeight: 1.2,
                color: isDark ? '#D6B15C' : '#854d0e',
                textShadow: isDark
                  ? '0 2px 8px rgba(0, 0, 0, 0.95), 0 0 12px rgba(214, 177, 92, 0.3)'
                  : '0 1px 4px rgba(255, 255, 255, 0.95)',
                whiteSpace: 'nowrap',
              }}
            >
              {lane.name}
            </div>

            {/* Timeline Period ONLY (Marcellus / Inter) - Decreased transparency / Higher opacity (0.85) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 2,
                fontFamily: "'Marcellus', Georgia, serif",
                fontSize: '13px',
                fontWeight: 600,
                color: isDark ? '#cbd5e1' : '#475569',
                opacity: isDark ? 0.85 : 0.9,
                letterSpacing: '0.04em',
                textShadow: isDark ? '0 1px 6px rgba(0, 0, 0, 0.95)' : 'none',
                whiteSpace: 'nowrap',
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
        );
      })}
    </div>
  );
};
