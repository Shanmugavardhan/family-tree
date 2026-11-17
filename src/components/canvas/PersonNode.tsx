import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { PersonNodeData } from '../../adapters/reactFlowAdapter';
import { User, Sparkles } from 'lucide-react';

export const PersonNode: React.FC<any> = ({ data, selected }) => {
  const nodeData = data as PersonNodeData;
  const isSelected = selected || nodeData.isSelected;
  const isHighlighted = nodeData.isHighlighted;

  const fullName = [nodeData.firstName, nodeData.middleName, nodeData.lastName]
    .filter(Boolean)
    .join(' ');

  const initials = `${nodeData.firstName?.[0] || ''}${nodeData.lastName?.[0] || ''}`.toUpperCase() || 'P';

  // Generation colors fallback
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

  return (
    <div
      style={{
        width: 220,
        height: 100,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        border: isSelected
          ? '2px solid #2563eb'
          : isHighlighted
          ? '2px solid #38bdf8'
          : '1px solid #e2e8f0',
        boxShadow: isSelected
          ? '0 10px 25px -5px rgba(37, 99, 235, 0.35), 0 0 0 2px rgba(59, 130, 246, 0.2)'
          : isHighlighted
          ? '0 8px 20px -4px rgba(56, 189, 248, 0.3)'
          : '0 2px 6px -1px rgba(0, 0, 0, 0.08)',
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
          background: '#475569',
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
          background: '#e11d48',
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
          background: '#e11d48',
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
          background: '#475569',
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
            color: genColor,
            backgroundColor: `${genColor}15`,
            padding: '2px 6px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            whiteSpace: 'nowrap',
          }}
        >
          <Sparkles size={10} />
          {nodeData.generationName || 'Unknown Cohort'}
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
          {nodeData.photoPath ? (
            <img
              src={`/api/persons/${nodeData.personId}/photo`}
              alt={fullName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // Fallback to initials if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
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
              color: '#0f172a',
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
              color: '#64748b',
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
              <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Year Unknown</span>
            )}
          </div>
        </div>
      </div>

      {/* Selected Indicator Bottom Bar */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: '#2563eb',
          }}
        />
      )}
    </div>
  );
};
