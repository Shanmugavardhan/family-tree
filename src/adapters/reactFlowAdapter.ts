import { Node, Edge, MarkerType } from '@xyflow/react';
import { FamilyLayout, CohortLane } from '../types/layout';

export interface PersonNodeData extends Record<string, unknown> {
  id: string;
  personId: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  birthDate: string | null;
  birthYear: number | null;
  generationId: string | null;
  generationName: string | null;
  generationOrder: number | null;
  photoPath: string | null;
  gender?: string;
  isLiving: boolean;
  isArchived: boolean;
  isInferredGeneration?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isPathNode?: boolean;
  isDimmed?: boolean;
  onEdit?: (personId: string) => void;
}

export interface LaneBannerNodeData extends Record<string, unknown> {
  lane: CohortLane;
  width: number;
  isDimmed?: boolean;
}

export interface FamilyEdgeData extends Record<string, unknown> {
  edgeType: 'parent_child' | 'spouse';
  parentType?: string | null;
  isHighlighted?: boolean;
  isPathEdge?: boolean;
  isDimmed?: boolean;
}

export interface ConvertLayoutOptions {
  selectedNodeId?: string | null;
  highlightedNodeIds?: Set<string>;
  highlightedEdgeIds?: Set<string>;
  pathNodeIds?: Set<string>;
  pathEdgeIds?: Set<string>;
  focusMode?: boolean;
  onEditPerson?: (personId: string) => void;
}

export interface ReactFlowGraphData {
  nodes: Node<PersonNodeData | LaneBannerNodeData>[];
  edges: Edge<FamilyEdgeData>[];
  width: number;
  height: number;
}

/**
 * Pure adapter converting a domain FamilyLayout into React Flow compatible nodes and edges.
 *
 * Guarantees:
 * 1. Preserves exact mathematical coordinates from Layout Engine.
 * 2. Draggable is locked to false (prevents accidental chronological corruption).
 * 3. Separate visual treatment for parent_child vs spouse edges.
 * 4. Generates background cohort lane banners with chronological boundaries.
 * 5. Supports Focus Mode (dimming unrelated branches), Relationship Highlighting, and Pathfinding.
 */
export function convertLayoutToReactFlow(
  layout: FamilyLayout,
  options?: ConvertLayoutOptions
): ReactFlowGraphData {
  if (!layout) {
    return { nodes: [], edges: [], width: 1200, height: 800 };
  }

  const selectedNodeId = options?.selectedNodeId || null;
  const highlightedNodeIds = options?.highlightedNodeIds || new Set<string>();
  const highlightedEdgeIds = options?.highlightedEdgeIds || new Set<string>();
  const pathNodeIds = options?.pathNodeIds || new Set<string>();
  const pathEdgeIds = options?.pathEdgeIds || new Set<string>();
  const focusMode = options?.focusMode || false;

  const hasFocalSelection =
    selectedNodeId !== null || pathNodeIds.size > 0 || highlightedNodeIds.size > 0;

  const bannerLeft = -1000000;
  const bannerWidth = 2000000; // Truly infinite horizontal generation straps

  // 1. Generate background cohort lane banner nodes (expansive period texture strips, zero gap)
  const laneNodes: Node<LaneBannerNodeData>[] = layout.lanes.map((lane) => ({
    id: `lane-banner-${lane.id}`,
    type: 'laneBanner',
    position: { x: bannerLeft, y: lane.y },
    style: {
      width: bannerWidth,
      height: lane.height,
      zIndex: -1,
      pointerEvents: 'none',
      opacity: focusMode && hasFocalSelection ? 0.35 : 1,
      transition: 'opacity 0.2s ease-in-out',
    },
    data: {
      lane,
      width: bannerWidth,
      isDimmed: focusMode && hasFocalSelection,
    },
    draggable: false,
    selectable: false,
    deletable: false,
    focusable: false,
  }));

  // 2. Generate person card nodes (strictly locked draggable=false)
  const personNodes: Node<PersonNodeData>[] = layout.nodes.map((n) => {
    const isSelected = selectedNodeId === n.id;
    const isPathNode = pathNodeIds.has(n.id);
    const isHighlighted = highlightedNodeIds.has(n.id);

    const isInFocalSet = isSelected || isPathNode || isHighlighted;
    const isDimmed = focusMode && hasFocalSelection && !isInFocalSet;

    return {
      id: n.id,
      type: 'personCard',
      position: { x: n.x, y: n.y },
      style: {
        width: n.width,
        height: n.height,
        opacity: isDimmed ? 0.2 : 1,
        transition: 'opacity 0.2s ease-in-out',
        pointerEvents: isDimmed ? 'none' : 'auto',
      },
      data: {
        id: n.id,
        personId: n.personId || n.id,
        firstName: n.firstName || '',
        middleName: n.middleName ?? null,
        lastName: n.lastName ?? null,
        birthDate: n.birthDate ?? null,
        birthYear: n.birthYear ?? null,
        generationId: n.generationId ?? null,
        generationName: n.generationName ?? null,
        generationOrder: n.generationOrder ?? null,
        photoPath: n.photoPath ?? null,
        gender: (n as any).gender || 'unknown',
        isLiving: n.isLiving ?? true,
        isArchived: n.isArchived ?? false,
        isInferredGeneration: (n as any).isInferredGeneration ?? false,
        isSelected,
        isHighlighted,
        isPathNode,
        isDimmed,
        onEdit: options?.onEditPerson,
      },
      draggable: false, // Locked to preserve chronological layout integrity
      selectable: true,
    };
  });

  // 3. Generate distinct edges
  const flowEdges: Edge<FamilyEdgeData>[] = layout.edges.map((e) => {
    const isPathEdge = pathEdgeIds.has(e.id);
    const isHighlighted =
      highlightedEdgeIds.has(e.id) ||
      (selectedNodeId !== null && (e.source === selectedNodeId || e.target === selectedNodeId));

    const isConnectedToFocal = isPathEdge || isHighlighted;
    const isDimmed = focusMode && hasFocalSelection && !isConnectedToFocal;

    const strokeColor = isPathEdge
      ? '#f59e0b'
      : isHighlighted
      ? '#D6B15C'
      : e.type === 'spouse'
      ? '#D18B91'
      : '#A94747';

    if (e.type === 'parent_child') {
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'parent-bottom',
        targetHandle: 'child-top',
        type: 'familyEdge',
        animated: isHighlighted || isPathEdge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: strokeColor,
        },
        style: {
          stroke: strokeColor,
          strokeWidth: isPathEdge ? 3.5 : isHighlighted ? 2.5 : 1.5,
          opacity: isDimmed ? 0.1 : 1,
          transition: 'opacity 0.2s ease-in-out, stroke 0.2s ease-in-out',
        },
        data: {
          edgeType: 'parent_child',
          parentType: e.parentType || 'biological',
          isHighlighted,
          isPathEdge,
          isDimmed,
        },
        zIndex: isPathEdge ? 30 : isHighlighted ? 20 : 1,
      };
    } else {
      // Spouse edge: horizontal connection
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'spouse-right',
        targetHandle: 'spouse-left',
        type: 'familyEdge',
        animated: isHighlighted || isPathEdge,
        style: {
          stroke: strokeColor,
          strokeWidth: isPathEdge ? 3.5 : isHighlighted ? 2.5 : 1.5,
          opacity: isDimmed ? 0.1 : 1,
          transition: 'opacity 0.2s ease-in-out, stroke 0.2s ease-in-out',
        },
        data: {
          edgeType: 'spouse',
          parentType: null,
          isHighlighted,
          isPathEdge,
          isDimmed,
        },
        zIndex: isPathEdge ? 30 : isHighlighted ? 20 : 2,
      };
    }
  });

  // Combine background lane banners first so person nodes sit above them
  const allNodes: Node<PersonNodeData | LaneBannerNodeData>[] = [...laneNodes, ...personNodes];

  return {
    nodes: allNodes,
    edges: flowEdges,
    width: bannerWidth,
    height: layout.height,
  };
}
