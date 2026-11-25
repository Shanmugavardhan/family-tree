import React from 'react';
import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
  useNodes,
} from '@xyflow/react';
import { FamilyEdgeData } from '../../adapters/reactFlowAdapter';
import { Heart, Navigation } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

function hashEdgeId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Builds a clean SVG path with rounded corners from a sequence of orthogonal points.
 */
function buildRoundedOrthogonalPath(rawPoints: Point[], radius = 12): string {
  // Deduplicate consecutive identical points
  const deduped: Point[] = [];
  for (const p of rawPoints) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      deduped.push(p);
    }
  }

  // Remove collinear middle points
  const pts: Point[] = [];
  for (let i = 0; i < deduped.length; i++) {
    if (i === 0 || i === deduped.length - 1) {
      pts.push(deduped[i]);
      continue;
    }
    const a = pts[pts.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!sameX && !sameY) {
      pts.push(b);
    }
  }

  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const r = Math.min(radius, len1 / 2, len2 / 2);

    if (r < 1) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const startX = curr.x - (v1x / len1) * r;
    const startY = curr.y - (v1y / len1) * r;
    const endX = curr.x + (v2x / len2) * r;
    const endY = curr.y + (v2y / len2) * r;

    d += ` L ${startX} ${startY} Q ${curr.x} ${curr.y} ${endX} ${endY}`;
  }

  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function computeObstacleAwareParentPath(params: {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  personBoxes: Array<{ left: number; right: number; top: number; bottom: number }>;
}): { path: string; labelX: number; labelY: number } | null {
  const { id, sourceX, sourceY, targetX, targetY, personBoxes } = params;
  if (targetY <= sourceY + 40) return null;

  // Identify person tiles that sit vertically between sourceY and targetY
  const intermediateBoxes = personBoxes.filter(
    (b) => b.top > sourceY + 15 && b.bottom < targetY - 15
  );

  if (intermediateBoxes.length === 0) {
    return null; // Adjacent generation: standard SmoothStep in corridor is already clear
  }

  const hash = hashEdgeId(id);
  const laneSlot = (hash % 5) - 2; // -2 .. +2
  const upperCorridorY = sourceY + 40 + laneSlot * 5;
  const lowerCorridorY = targetY - 40 + laneSlot * 5;

  const isXClear = (x: number) =>
    !intermediateBoxes.some((b) => x >= b.left && x <= b.right);

  // Build candidate X coordinates for the vertical drop through the intermediate lane
  const candidates: number[] = [targetX, sourceX];
  const sortedBoxes = [...intermediateBoxes].sort((a, b) => a.left - b.left);

  if (sortedBoxes.length > 0) {
    candidates.push(sortedBoxes[0].left - 24);
    candidates.push(sortedBoxes[sortedBoxes.length - 1].right + 24);
    for (let i = 0; i < sortedBoxes.length - 1; i++) {
      const gapLeft = sortedBoxes[i].right;
      const gapRight = sortedBoxes[i + 1].left;
      if (gapRight > gapLeft + 4) {
        candidates.push((gapLeft + gapRight) / 2);
      }
    }
    for (const b of sortedBoxes) {
      candidates.push(b.left - 14);
      candidates.push(b.right + 14);
    }
  }

  const clearCandidates = candidates.filter(isXClear);
  const idealX = (sourceX + targetX) / 2;

  let dropX = targetX;
  if (clearCandidates.length > 0) {
    clearCandidates.sort((a, b) => Math.abs(a - idealX) - Math.abs(b - idealX));
    const bestBase = clearCandidates[0];
    const jittered = bestBase + laneSlot * 4;
    dropX = isXClear(jittered) ? jittered : bestBase;
  }

  const pts: Point[] = [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: upperCorridorY },
    { x: dropX, y: upperCorridorY },
    { x: dropX, y: lowerCorridorY },
    { x: targetX, y: lowerCorridorY },
    { x: targetX, y: targetY },
  ];

  return {
    path: buildRoundedOrthogonalPath(pts, 14),
    labelX: dropX,
    labelY: (upperCorridorY + lowerCorridorY) / 2,
  };
}

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
  const nodes = useNodes();
  const edgeData = data as FamilyEdgeData;
  const isSpouse = edgeData?.edgeType === 'spouse';
  const isHighlighted = edgeData?.isHighlighted;
  const isPathEdge = edgeData?.isPathEdge;
  const parentType = edgeData?.parentType;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  const customRoute = React.useMemo(() => {
    if (isSpouse) return null;
    const personBoxes = nodes
      .filter((n) => n.type === 'personCard')
      .map((n) => ({
        left: n.position.x - 18,
        right: n.position.x + (n.measured?.width || 190) + 18,
        top: n.position.y - 10,
        bottom: n.position.y + (n.measured?.height || 180) + 10,
      }));
    return computeObstacleAwareParentPath({
      id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      personBoxes,
    });
  }, [isSpouse, nodes, id, sourceX, sourceY, targetX, targetY]);

  if (customRoute) {
    edgePath = customRoute.path;
    labelX = customRoute.labelX;
    labelY = customRoute.labelY;
  } else {
    const [smoothPath, sLabelX, sLabelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 16,
    });
    edgePath = smoothPath;
    labelX = sLabelX;
    labelY = sLabelY;
  }

  const strokeColor = isPathEdge
    ? '#f59e0b'
    : isHighlighted
    ? '#D6B15C'
    : isSpouse
    ? '#D18B91'
    : '#A94747';

  const strokeWidth = isPathEdge ? 3.5 : isHighlighted ? 3 : 2.2;
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
          pointerEvents: 'none',
          cursor: 'grab',
          transition: 'stroke 0.2s ease-in-out, opacity 0.2s ease-in-out',
        }}
      />

      {/* Render edge labels for pathfinder, spouse, or non-biological parent relations */}
      {(isPathEdge || isSpouse || (parentType && parentType !== 'biological')) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              cursor: 'grab',
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
                  pointerEvents: 'none',
                  cursor: 'grab',
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
                  pointerEvents: 'none',
                  cursor: 'grab',
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
                  pointerEvents: 'none',
                  cursor: 'grab',
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
