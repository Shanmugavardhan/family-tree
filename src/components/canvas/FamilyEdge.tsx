import React from 'react';
import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { FamilyEdgeData } from '../../adapters/reactFlowAdapter';
import { Heart, Navigation } from 'lucide-react';

export const FamilyEdge: React.FC<any> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const edgeData = data as FamilyEdgeData;
  const isSpouse = edgeData?.edgeType === 'spouse';
  const isHighlighted = edgeData?.isHighlighted;
  const isPathEdge = edgeData?.isPathEdge;
  const parentType = edgeData?.parentType;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const strokeColor = isPathEdge
    ? '#f59e0b'
    : isHighlighted
    ? '#2563eb'
    : isSpouse
    ? '#b91c1c'
    : '#8b1e22';

  const strokeWidth = isPathEdge ? 3.5 : isHighlighted ? 3 : isSpouse ? 2.5 : 2.5;
  const strokeDasharray = isSpouse && !isPathEdge ? '5,5' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={isSpouse ? undefined : markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          transition: 'all 0.15s ease-in-out',
        }}
      />

      {/* Render edge labels for pathfinder, spouse, or non-biological parent relations */}
      {(isPathEdge || isSpouse || (parentType && parentType !== 'biological')) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: isPathEdge ? 35 : 10,
            }}
          >
            {isPathEdge ? (
              <div
                title="Relationship Path Step"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  border: '2px solid #f59e0b',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <Navigation size={11} fill="#f59e0b" />
              </div>
            ) : isSpouse ? (
              <div
                title="Spouse Connection"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e11d48',
                  boxShadow: '0 2px 4px rgba(225, 29, 72, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e11d48',
                  fontSize: 10,
                }}
              >
                <Heart size={12} fill="#e11d48" />
              </div>
            ) : (
              <div
                title={`${parentType} relationship`}
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                {parentType}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
