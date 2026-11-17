import React from 'react';
import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { FamilyEdgeData } from '../../adapters/reactFlowAdapter';
import { Heart } from 'lucide-react';

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

  const strokeColor = isHighlighted
    ? '#2563eb'
    : isSpouse
    ? '#e11d48'
    : '#475569';

  const strokeWidth = isHighlighted ? 3 : isSpouse ? 2.5 : 2;
  const strokeDasharray = isSpouse ? '5,5' : undefined;

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

      {/* Render edge labels for spouse connections or non-biological parent relations */}
      {(isSpouse || (parentType && parentType !== 'biological')) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
          >
            {isSpouse ? (
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
