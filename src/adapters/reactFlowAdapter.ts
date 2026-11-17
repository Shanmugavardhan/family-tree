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
  isLiving: boolean;
  isArchived: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
}

export interface LaneBannerNodeData extends Record<string, unknown> {
  lane: CohortLane;
  width: number;
}

export interface FamilyEdgeData extends Record<string, unknown> {
  edgeType: 'parent_child' | 'spouse';
  parentType?: string | null;
  isHighlighted?: boolean;
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
 */
export function convertLayoutToReactFlow(
  layout: FamilyLayout,
  options?: {
    selectedNodeId?: string | null;
    highlightedNodeIds?: Set<string>;
    highlightedEdgeIds?: Set<string>;
  }
): ReactFlowGraphData {
  if (!layout) {
    return { nodes: [], edges: [], width: 1200, height: 800 };
  }

  const selectedNodeId = options?.selectedNodeId || null;
  const highlightedNodeIds = options?.highlightedNodeIds || new Set<string>();
  const highlightedEdgeIds = options?.highlightedEdgeIds || new Set<string>();

  const canvasWidth = Math.max(layout.width, 1400);

  // 1. Generate background cohort lane banner nodes
  const laneNodes: Node<LaneBannerNodeData>[] = layout.lanes.map((lane) => ({
    id: `lane-banner-${lane.id}`,
    type: 'laneBanner',
    position: { x: 0, y: lane.y },
    style: {
      width: canvasWidth,
      height: lane.height,
      zIndex: -1,
      pointerEvents: 'none',
    },
    data: {
      lane,
      width: canvasWidth,
    },
    draggable: false,
    selectable: false,
    deletable: false,
    focusable: false,
  }));

  // 2. Generate person card nodes (strictly locked draggable=false)
  const personNodes: Node<PersonNodeData>[] = layout.nodes.map((n) => {
    const isSelected = selectedNodeId === n.id;
    const isHighlighted = highlightedNodeIds.has(n.id);

    return {
      id: n.id,
      type: 'personCard',
      position: { x: n.x, y: n.y },
      style: {
        width: n.width,
        height: n.height,
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
        isLiving: n.isLiving ?? true,
        isArchived: n.isArchived ?? false,
        isSelected,
        isHighlighted,
      },
      draggable: false, // Locked to preserve chronological layout integrity
      selectable: true,
    };
  });

  // 3. Generate distinct edges
  const flowEdges: Edge<FamilyEdgeData>[] = layout.edges.map((e) => {
    const isHighlighted =
      highlightedEdgeIds.has(e.id) ||
      (selectedNodeId !== null && (e.source === selectedNodeId || e.target === selectedNodeId));

    if (e.type === 'parent_child') {
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'parent-bottom',
        targetHandle: 'child-top',
        type: 'familyEdge',
        animated: isHighlighted,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isHighlighted ? '#3b82f6' : '#475569',
        },
        data: {
          edgeType: 'parent_child',
          parentType: e.parentType || 'biological',
          isHighlighted,
        },
        zIndex: isHighlighted ? 20 : 1,
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
        animated: false,
        data: {
          edgeType: 'spouse',
          parentType: null,
          isHighlighted,
        },
        zIndex: isHighlighted ? 20 : 2,
      };
    }
  });

  // Combine background lane banners first so person nodes sit above them
  const allNodes: Node<PersonNodeData | LaneBannerNodeData>[] = [...laneNodes, ...personNodes];

  return {
    nodes: allNodes,
    edges: flowEdges,
    width: canvasWidth,
    height: layout.height,
  };
}
