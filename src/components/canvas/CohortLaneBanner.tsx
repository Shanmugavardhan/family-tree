import React from 'react';
import { LaneBannerNodeData } from '../../adapters/reactFlowAdapter';
import { Calendar, Users } from 'lucide-react';

export const CohortLaneBanner: React.FC<any> = ({ data }) => {
  const { lane, width } = data as LaneBannerNodeData;
  const bgColor = lane.backgroundColor || '#64748b';

  return (
    <div
      style={{
        width,
        height: lane.height,
        backgroundColor: `${bgColor}08`,
        borderTop: `1px solid ${bgColor}25`,
        borderBottom: `1px dashed ${bgColor}30`,
        position: 'relative',
        boxSizing: 'border-box',
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {/* Sticky-style left banner label */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 14px',
          borderRadius: 8,
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          border: `1px solid ${bgColor}35`,
          borderLeft: `4px solid ${bgColor}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#0f172a',
            }}
          >
            {lane.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            {lane.startYear && lane.endYear ? (
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: '#64748b',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Calendar size={11} color={bgColor} />
                {lane.startYear} – {lane.endYear}
              </span>
            ) : (
              <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontStyle: 'italic' }}>
                Unclassified timeline lane
              </span>
            )}
            <span
              style={{
                fontSize: '0.6875rem',
                backgroundColor: `${bgColor}18`,
                color: bgColor,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Users size={10} />
              {lane.nodeCount} {lane.nodeCount === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
