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
  let borderWidth = '1.5px';
  let boxShadow = isDark ? '0 6px 16px rgba(0, 0, 0, 0.45)' : '0 4px 12px -2px rgba(0, 0, 0, 0.08)';

  if (isPathNode) {
    borderColor = '#f59e0b';
    borderWidth = '3px';
    boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.28), 0 10px 25px -4px rgba(245, 158, 11, 0.45)';
  } else if (isSelected) {
    borderColor = '#2563eb';
    borderWidth = '2.5px';
    boxShadow = '0 12px 28px -5px rgba(37, 99, 235, 0.38), 0 0 0 3px rgba(59, 130, 246, 0.25)';
  } else if (isHighlighted) {
    borderColor = '#38bdf8';
    borderWidth = '2.5px';
    boxShadow = '0 10px 24px -4px rgba(56, 189, 248, 0.35)';
  }

  return (
    <div
      style={{
        width: 320,
        height: 150,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderRadius: 14,
        border: `${borderWidth} solid ${borderColor}`,
        boxShadow,
        padding: '12px 16px',
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
          background: isPathNode ? '#f59e0b' : '#475569',
          border: '2px solid #ffffff',
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
          background: isPathNode ? '#f59e0b' : '#e11d48',
          border: '2px solid #ffffff',
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
          background: isPathNode ? '#f59e0b' : '#e11d48',
          border: '2px solid #ffffff',
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
          background: isPathNode ? '#f59e0b' : '#475569',
          border: '2px solid #ffffff',
          bottom: -5,
        }}
      />

      {/* Card Header: Cohort Badge (+10px -> 20px) and Living Status (+10px -> 21px) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: '20px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: isPathNode ? '#b45309' : genColor,
            backgroundColor: isPathNode ? '#fef3c7' : `${genColor}18`,
            padding: '3px 10px',
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {isPathNode ? <Navigation size={16} /> : <Sparkles size={16} />}
          {isPathNode ? 'Path Link' : nodeData.generationName || 'Unknown Cohort'}
        </span>

        {/* Living / Deceased Indicator (+10px -> 21px) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: nodeData.isLiving ? '#10b981' : '#94a3b8',
            }}
          />
          <span style={{ fontSize: '21px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
            {nodeData.isLiving ? 'Living' : 'Deceased'}
          </span>
        </div>
      </div>

      {/* Card Body: Photo Avatar + Full Name (+10px -> 24px) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: `${genColor}20`,
            color: genColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '22px',
            flexShrink: 0,
            overflow: 'hidden',
            border: `2px solid ${genColor}45`,
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
            initials || <User size={26} />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            title={fullName}
            style={{
              fontWeight: 700,
              fontSize: '24px',
              color: isDark ? '#f8fafc' : '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {fullName}
          </div>
          <div
            style={{
              fontSize: '22px',
              color: isDark ? '#94a3b8' : '#64748b',
              marginTop: 4,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
            height: 4,
            backgroundColor: isPathNode ? '#f59e0b' : '#2563eb',
          }}
        />
      )}
    </div>
  );
};
