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

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Responsive scale: on mobile keep compact (0.75) so it never dominates or covers people;
  // on desktop gracefully scale but cap at 1.25 so it never becomes massive.
  const computeScale = (vz: number) => {
    if (isMobile) return 0.75;
    return Math.min(1.25, Math.max(0.7, Math.pow(1 / Math.max(0.35, vz), 0.4)));
  };

  const getLeftOffset = () => (isMobile ? 10 : 36);
  const getTopOffsetInLane = () => (isMobile ? 10 : 20);

  // Directly sync vertical transform and inverse zoom scale with zero latency during drag/pan/zoom
  useOnViewportChange({
    onChange: ({ y: vy, zoom: vz }) => {
      const scale = computeScale(vz);
      const left = getLeftOffset();
      const topOffset = getTopOffsetInLane();
      activeLanes.forEach((lane) => {
        const el = labelRefs.current.get(lane.id);
        if (el) {
          const top = vy + (lane.y + topOffset) * vz;
          el.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`;
        }
      });
    },
  });

  const initialScale = computeScale(zoom);
  const initialLeft = getLeftOffset();
  const initialTopOffset = getTopOffsetInLane();

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
        const top = y + (lane.y + initialTopOffset) * zoom;
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
            className={isMobile ? 'mobile-generation-badge' : undefined}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
              pointerEvents: 'none',
              transform: `translate3d(${initialLeft}px, ${top}px, 0) scale(${initialScale})`,
              transformOrigin: 'top left',
              willChange: 'transform',
              opacity: isDark ? 0.95 : 0.98,
              transition: 'opacity 0.2s ease-in-out',
              ...(isMobile
                ? {
                    padding: '3px 8px',
                    borderRadius: 6,
                    backgroundColor: isDark ? 'rgba(16, 20, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                    border: isDark ? '1px solid rgba(214, 177, 92, 0.35)' : '1px solid rgba(197, 155, 39, 0.35)',
                    boxShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.65)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    maxWidth: 130,
                  }
                : {}),
            }}
          >
            {/* Royal Heritage Generation Title (Marcellus) */}
            <div
              style={{
                fontFamily: "'Marcellus', Georgia, serif",
                fontSize: isMobile ? '11px' : '15px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                lineHeight: 1.15,
                color: isDark ? '#D6B15C' : '#854d0e',
                textShadow: isDark
                  ? '0 2px 8px rgba(0, 0, 0, 0.95), 0 0 10px rgba(214, 177, 92, 0.25)'
                  : '0 1px 3px rgba(255, 255, 255, 0.95)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {lane.name}
            </div>

            {/* Timeline Period ONLY */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 1,
                fontFamily: "'Marcellus', Georgia, serif",
                fontSize: isMobile ? '9.5px' : '12.5px',
                fontWeight: 600,
                color: isDark ? '#cbd5e1' : '#475569',
                opacity: isDark ? 0.85 : 0.9,
                letterSpacing: '0.03em',
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
