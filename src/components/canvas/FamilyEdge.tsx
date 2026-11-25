import React from 'react';
import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
  useNodes,
  useEdges,
} from '@xyflow/react';
import { FamilyEdgeData } from '../../adapters/reactFlowAdapter';
import { Heart, Navigation } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

export interface ObstacleBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Builds a clean SVG path with rounded corners from a sequence of orthogonal points.
 */
function buildRoundedOrthogonalPath(rawPoints: Point[], radius = 12): string {
  const deduped: Point[] = [];
  for (const p of rawPoints) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      deduped.push(p);
    }
  }

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

/**
 * Merges connected spouse nodes in the same lane into unified obstacle boxes
 * so that vertical lines never pass through a spouse dashed line or heart icon.
 */
export function buildMergedSpouseObstacleBoxes(
  personNodes: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  spouseEdges: Array<{ source: string; target: string }>
): ObstacleBox[] {
  const nodeMap = new Map(personNodes.map((n) => [n.id, n]));
  const spouseAdj = new Map<string, Set<string>>();
  for (const e of spouseEdges) {
    if (!spouseAdj.has(e.source)) spouseAdj.set(e.source, new Set());
    if (!spouseAdj.has(e.target)) spouseAdj.set(e.target, new Set());
    spouseAdj.get(e.source)!.add(e.target);
    spouseAdj.get(e.target)!.add(e.source);
  }

  const visited = new Set<string>();
  const boxes: ObstacleBox[] = [];

  for (const n of personNodes) {
    if (visited.has(n.id)) continue;
    visited.add(n.id);
    const unit = [n];
    const queue = [n.id];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const neighbors = spouseAdj.get(currId);
      if (neighbors) {
        for (const nbId of neighbors) {
          if (!visited.has(nbId)) {
            const nb = nodeMap.get(nbId);
            if (nb && Math.abs(nb.y - n.y) < 40) {
              visited.add(nbId);
              unit.push(nb);
              queue.push(nbId);
            }
          }
        }
      }
    }

    boxes.push({
      left: Math.min(...unit.map((u) => u.x)) - 22,
      right: Math.max(...unit.map((u) => u.x + u.width)) + 22,
      top: Math.min(...unit.map((u) => u.y)) - 10,
      bottom: Math.max(...unit.map((u) => u.y + u.height)) + 10,
    });
  }

  return boxes;
}

/**
 * Computes an orthogonal parent-child path that:
 *  1) Shares a single couple trunk & sibling bus bar per parent couple (no overlapping sibling lines).
 *  2) Never crosses any intermediate person tile OR spouse dashed line/heart.
 *  3) Separates different couples' vertical/horizontal channels so lines never pass through each other.
 */
export function computeObstacleAwareParentPath(params: {
  coupleKey: string;
  coupleSlotOffset?: number;
  sourceX: number;
  sourceY: number;
  sourceClearY?: number;
  targetX: number;
  targetY: number;
  personBoxes: ObstacleBox[];
}): { path: string; labelX: number; labelY: number } | null {
  const { coupleKey, coupleSlotOffset, sourceX, sourceY, sourceClearY, targetX, targetY, personBoxes } = params;
  if (targetY <= sourceY + 20) return null;

  const effectiveClearY = Math.max(sourceY, sourceClearY ?? sourceY);

  // Identify person/couple units sitting vertically between effectiveClearY and targetY
  const intermediateBoxes = personBoxes.filter(
    (b) => b.top > effectiveClearY + 10 && b.bottom < targetY - 15
  );

  // All children of the same couple share the exact same coupleSlot -> 1 unified sibling bus bar!
  // When coupleSlotOffset is provided, every distinct couple in the same lane gets a unique Y slot.
  const coupleSlot = coupleSlotOffset !== undefined ? coupleSlotOffset : (hashKey(coupleKey) % 5) - 2;
  const SLOT_STEP_Y = 14;
  const upperCorridorY = effectiveClearY + 38 + coupleSlot * SLOT_STEP_Y;

  const isXClear = (x: number) =>
    !intermediateBoxes.some((b) => x >= b.left && x <= b.right);

  // Minimal turns Case 1: Directly aligned vertically & clear of intermediate obstacles -> 0 turns!
  if (Math.abs(targetX - sourceX) <= 4 && isXClear(targetX)) {
    return {
      path: `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`,
      labelX: sourceX,
      labelY: (sourceY + targetY) / 2,
    };
  }

  // Minimal turns Case 2: Adjacent generation OR targetX is completely clear of intermediate tiles -> 2 turns only!
  if (intermediateBoxes.length === 0 || isXClear(targetX)) {
    const busY =
      intermediateBoxes.length === 0
        ? Math.round((effectiveClearY + targetY) / 2) + coupleSlot * SLOT_STEP_Y
        : upperCorridorY;
    const pts: Point[] = [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: busY },
      { x: targetX, y: busY },
      { x: targetX, y: targetY },
    ];
    return {
      path: buildRoundedOrthogonalPath(pts, 14),
      labelX: (sourceX + targetX) / 2,
      labelY: busY,
    };
  }

  // Case 3: Multi-generation span where targetX is blocked by an intermediate person/spouse unit -> route around obstacle
  const lowerCorridorY = targetY - 42 + coupleSlot * SLOT_STEP_Y;

  const candidates: number[] = [sourceX];
  const sortedBoxes = [...intermediateBoxes].sort((a, b) => a.left - b.left);

  if (sortedBoxes.length > 0) {
    candidates.push(sortedBoxes[0].left - 26);
    candidates.push(sortedBoxes[sortedBoxes.length - 1].right + 26);
    for (let i = 0; i < sortedBoxes.length - 1; i++) {
      const gapLeft = sortedBoxes[i].right;
      const gapRight = sortedBoxes[i + 1].left;
      if (gapRight > gapLeft + 6) {
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
    const spread = bestBase + coupleSlot * 5;
    dropX = isXClear(spread) ? spread : bestBase;
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
  source,
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
  const edges = useEdges();
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

    const personNodes = nodes
      .filter((n) => n.type === 'personCard')
      .map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width || 190,
        height: n.measured?.height || 180,
      }));

    const spouseEdges = edges
      .filter((e) => (e.data as FamilyEdgeData)?.edgeType === 'spouse')
      .map((e) => ({ source: e.source, target: e.target }));

    // If source has a spouse in the same lane, anchor the single couple trunk at the heart midpoint!
    const srcNode = personNodes.find((n) => n.id === source);
    let effectiveSourceX = sourceX;
    let effectiveSourceY = sourceY;
    let coupleKey = source;

    if (srcNode) {
      const spouseEdge = spouseEdges.find(
        (e) => e.source === source || e.target === source
      );
      if (spouseEdge) {
        const spouseId =
          spouseEdge.source === source ? spouseEdge.target : spouseEdge.source;
        const spNode = personNodes.find((n) => n.id === spouseId);
        if (spNode && Math.abs(spNode.y - srcNode.y) < 40) {
          const srcCenter = srcNode.x + srcNode.width / 2;
          const spCenter = spNode.x + spNode.width / 2;
          effectiveSourceX = (srcCenter + spCenter) / 2;
          // Start cleanly from the bottom of the heart badge in the gap between spouses
          effectiveSourceY = srcNode.y + 59;
          coupleKey = [source, spouseId].sort().join('<->');
        }
      }
    }

    const personBoxes = buildMergedSpouseObstacleBoxes(personNodes, spouseEdges);

    // Assign a deterministic, collision-free vertical slot for every couple in the same source lane
    let coupleSlotOffset = 0;
    if (srcNode) {
      const coupleMap = new Map<string, number>();
      const parentEdges = edges.filter(
        (e) => (e.data as FamilyEdgeData)?.edgeType === 'parent_child'
      );
      for (const pe of parentEdges) {
        const peSrc = personNodes.find((n) => n.id === pe.source);
        if (!peSrc || Math.abs(peSrc.y - srcNode.y) >= 40) continue;
        const peSpouseEdge = spouseEdges.find(
          (se) => se.source === pe.source || se.target === pe.source
        );
        let cKey = pe.source;
        let cX = peSrc.x + peSrc.width / 2;
        if (peSpouseEdge) {
          const spId =
            peSpouseEdge.source === pe.source ? peSpouseEdge.target : peSpouseEdge.source;
          const peSp = personNodes.find((n) => n.id === spId);
          if (peSp && Math.abs(peSp.y - peSrc.y) < 40) {
            cKey = [pe.source, spId].sort().join('<->');
            cX = (peSrc.x + peSrc.width / 2 + peSp.x + peSp.width / 2) / 2;
          }
        }
        if (!coupleMap.has(cKey)) {
          coupleMap.set(cKey, cX);
        }
      }
      const sortedCouples = Array.from(coupleMap.entries()).sort((a, b) =>
        a[1] !== b[1] ? a[1] - b[1] : a[0].localeCompare(b[0])
      );
      const myIdx = sortedCouples.findIndex(([k]) => k === coupleKey);
      if (myIdx >= 0 && sortedCouples.length > 1) {
        coupleSlotOffset = myIdx - (sortedCouples.length - 1) / 2;
      }
    }

    return computeObstacleAwareParentPath({
      coupleKey,
      coupleSlotOffset,
      sourceX: effectiveSourceX,
      sourceY: effectiveSourceY,
      sourceClearY: srcNode ? srcNode.y + srcNode.height + 12 : sourceY,
      targetX,
      targetY,
      personBoxes,
    });
  }, [isSpouse, nodes, edges, source, sourceX, sourceY, targetX, targetY]);

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
