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

  // Cohort badge color
  const genColor = nodeData.generationId === 'gen_z'
    ? '#059669'
    : nodeData.generationId === 'gen_x'
    ? '#2563eb'
    : nodeData.generationId === 'baby_boomers'
    ? '#0d9488'
    : nodeData.generationId === 'millennials'
    ? '#7c3aed'
    : nodeData.generationId === 'silent'
    ? '#475569'
    : '#64748b';

  // Determine card border & shadow based on selection / pathfinding state
  let borderColor = isDark ? '#334155' : '#e2e8f0';
  let borderWidth = '1px';
  let boxShadow = isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 2px 6px -1px rgba(0, 0, 0, 0.08)';

  if (isPathNode) {
    borderColor = '#f59e0b';
    borderWidth = '2.5px';
    boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.25), 0 8px 20px -4px rgba(245, 158, 11, 0.35)';
  } else if (isSelected) {
    borderColor = '#2563eb';
    borderWidth = '2px';
    boxShadow = '0 10px 25px -5px rgba(37, 99, 235, 0.35), 0 0 0 2px rgba(59, 130, 246, 0.2)';
  } else if (isHighlighted) {
    borderColor = '#38bdf8';
    borderWidth = '2px';
    boxShadow = '0 8px 20px -4px rgba(56, 189, 248, 0.3)';
  }

  return (
    <div
      style={{
        width: 220,
        height: 100,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderRadius: 12,
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow,
        padding: '10px 12px',
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
          width: 8,
          height: 8,
          background: isPathNode ? '#f59e0b' : '#475569',
          border: '2px solid #ffffff',
          top: -4,
        }}
      />

      {/* Handles for horizontal spouse connections */}
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-left"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#f59e0b' : '#e11d48',
          border: '2px solid #ffffff',
          left: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#f59e0b' : '#e11d48',
          border: '2px solid #ffffff',
          right: -4,
        }}
      />

      {/* Source handle for outgoing parent-child connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="parent-bottom"
        style={{
          width: 8,
          height: 8,
          background: isPathNode ? '#f59e0b' : '#475569',
          border: '2px solid #ffffff',
          bottom: -4,
        }}
      />

      {/* Card Header: Cohort Badge and Living Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: isPathNode ? '#b45309' : genColor,
            backgroundColor: isPathNode ? '#fef3c7' : `${genColor}15`,
            padding: '2px 6px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}
        >
          {isPathNode ? <Navigation size={10} /> : <Sparkles size={10} />}
          {isPathNode ? 'Path Link' : nodeData.generationName || 'Unknown Cohort'}
        </span>

        {/* Living / Deceased Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: nodeData.isLiving ? '#10b981' : '#94a3b8',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
            {nodeData.isLiving ? 'Living' : 'Deceased'}
          </span>
        </div>
      </div>

      {/* Card Body: Photo Avatar + Full Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: `${genColor}20`,
            color: genColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.875rem',
            flexShrink: 0,
            overflow: 'hidden',
            border: `1.5px solid ${genColor}40`,
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
            initials || <User size={18} />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            title={fullName}
            style={{
              fontWeight: 700,
              fontSize: '0.875rem',
              color: isDark ? '#f8fafc' : '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
            }}
          >
            {fullName}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: isDark ? '#94a3b8' : '#64748b',
              marginTop: 2,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {nodeData.birthYear ? (
              <span>Born {nodeData.birthYear}</span>
            ) : (
              <span style={{ fontStyle: 'italic', color: isDark ? '#64748b' : '#94a3b8' }}>Year Unknown</span>
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
            height: 3,
            backgroundColor: isPathNode ? '#f59e0b' : '#2563eb',
          }}
        />
      )}
    </div>
  );
};
