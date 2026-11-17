import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { PersonNodeData } from '../../adapters/reactFlowAdapter';
import { User, Sparkles, Navigation } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const PersonNode: React.FC<any> = ({ data, selected }) => {
  const { isDark } = useTheme();
  const nodeData = data as PersonNodeData;
  const isSelected = selected || nodeData.isSelected;
  const isPathNode = nodeData.isPathNode;
  const isHighlighted = nodeData.isHighlighted;
  const [imageFailed, setImageFailed] = React.useState(false);

  const fullName = [nodeData.firstName, nodeData.middleName, nodeData.lastName]
    .filter(Boolean)
    .join(' ');

  const initials = `${nodeData.firstName?.[0] || ''}${nodeData.lastName?.[0] || ''}`.toUpperCase() || 'P';

  // Cohort badge color (Westeros House color accents)
  const genColor = nodeData.generationId === 'gen_z'
    ? (isDark ? '#34d399' : '#047857')
    : nodeData.generationId === 'gen_x'
    ? (isDark ? '#60a5fa' : '#1d4ed8')
    : nodeData.generationId === 'baby_boomers'
    ? (isDark ? '#2dd4bf' : '#0f766e')
    : nodeData.generationId === 'millennials'
    ? (isDark ? '#c084fc' : '#6d28d9')
    : nodeData.generationId === 'silent'
    ? (isDark ? '#d4af37' : '#92400e')
    : (isDark ? '#cbd5e1' : '#78716c');

  // Determine card border & shadow based on Game of Thrones aesthetics
  let borderColor = isDark ? 'rgba(212, 175, 55, 0.4)' : 'rgba(197, 155, 39, 0.55)';
  let borderWidth = '1.5px';
  let boxShadow = isDark
    ? '0 8px 24px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(212, 175, 55, 0.2)'
    : '0 6px 18px rgba(120, 53, 15, 0.08), 0 0 1px 1px rgba(197, 155, 39, 0.2)';

  if (isPathNode) {
    borderColor = '#f59e0b';
    borderWidth = '3px';
    boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.35), 0 12px 30px rgba(245, 158, 11, 0.55)';
  } else if (isSelected) {
    borderColor = '#d4af37';
    borderWidth = '2.5px';
    boxShadow = '0 12px 32px rgba(212, 175, 55, 0.45), 0 0 0 3px rgba(212, 175, 55, 0.25)';
  } else if (isHighlighted) {
    borderColor = isDark ? '#93c5fd' : '#2563eb';
    borderWidth = '2.5px';
    boxShadow = '0 10px 24px rgba(37, 99, 235, 0.35)';
  }

  return (
    <div
      style={{
        width: 380,
        height: 180,
        backgroundColor: isDark ? '#111622' : '#fcf8ee',
        borderRadius: 14,
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        transition: 'all 0.15s ease-in-out',
        cursor: 'pointer',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Target handle for incoming parent-child connections */}
      <Handle
        type="target"
        position={Position.Top}
        id="child-top"
        style={{
          width: 10,
          height: 10,
          background: isPathNode ? '#f59e0b' : '#d4af37',
          border: '2px solid #111622',
          top: -5,
        }}
      />

      {/* Handles for horizontal spouse connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-left"
        style={{
          width: 10,
          height: 10,
          background: isPathNode ? '#f59e0b' : '#b91c1c',
          border: '2px solid #111622',
          left: -5,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        style={{
          width: 10,
          height: 10,
          background: isPathNode ? '#f59e0b' : '#b91c1c',
          border: '2px solid #111622',
          right: -5,
        }}
      />

      {/* Source handle for outgoing parent-child connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="parent-bottom"
        style={{
          width: 10,
          height: 10,
          background: isPathNode ? '#f59e0b' : '#d4af37',
          border: '2px solid #111622',
          bottom: -5,
        }}
      />

      {/* Card Header: Cohort Badge and Deceased-only indicator (Living indication removed) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
            fontSize: '20px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isPathNode ? '#b45309' : genColor,
            backgroundColor: isPathNode ? '#fef3c7' : `${genColor}18`,
            padding: '3px 10px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            border: `1px solid ${isPathNode ? '#f59e0b' : `${genColor}40`}`,
          }}
        >
          {isPathNode ? <Navigation size={16} /> : <Sparkles size={16} />}
          {isPathNode ? 'Path Link' : nodeData.generationName || 'House Cohort'}
        </span>

        {/* Deceased Indicator (Alive indication is strictly omitted per Requirement 7) */}
        {!nodeData.isLiving && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
                fontSize: '19px',
                color: isDark ? '#94a3b8' : '#78716c',
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              † Deceased
            </span>
          </div>
        )}
      </div>

      {/* Card Body: Medallion Avatar + Full Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            backgroundColor: isDark ? '#1a2230' : '#f0e6d2',
            color: isDark ? '#e5c158' : '#78350f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Cinzel', serif",
            fontWeight: 900,
            fontSize: '26px',
            flexShrink: 0,
            overflow: 'hidden',
            border: `2px solid ${isDark ? '#d4af37' : '#c59b27'}`,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {nodeData.photoPath && !imageFailed ? (
            <img
              src={`/api/persons/${nodeData.personId}/photo`}
              alt={fullName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImageFailed(true)}
            />
          ) : (
            initials || <User size={32} />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            title={fullName}
            style={{
              fontFamily: "'Cinzel', 'Trajan Pro', Georgia, serif",
              fontWeight: 800,
              fontSize: '26px',
              color: isDark ? '#f8fafc' : '#1c1917',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            {fullName}
          </div>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', 'Cinzel', Georgia, serif",
              fontSize: '23px',
              color: isDark ? '#cbd5e1' : '#57534e',
              marginTop: 4,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {nodeData.birthYear ? (
              <span>Born {nodeData.birthYear}</span>
            ) : (
              <span style={{ fontStyle: 'italic', color: isDark ? '#d4af37' : '#92400e' }}>
                Kinship of {nodeData.generationName || 'House'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom selection bar */}
      {(isSelected || isPathNode) && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            backgroundColor: isPathNode ? '#f59e0b' : '#d4af37',
            boxShadow: '0 -2px 8px rgba(212, 175, 55, 0.5)',
          }}
        />
      )}
    </div>
  );
};
