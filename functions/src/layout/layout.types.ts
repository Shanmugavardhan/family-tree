import { FamilyGraphEdgeType } from '../graph/graph.types';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generationId: string | null;
  generationOrder: number | null;

  // Additional metadata carried over for consumers & Milestone 3.4 canvas
  personId?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  generationName?: string | null;
  photoPath?: string | null;
  isLiving?: boolean;
  isArchived?: boolean;
  isInferredGeneration?: boolean;
}

export interface PositionedEdge {
  id: string;
  source: string;
  target: string;
  type: FamilyGraphEdgeType;
  parentType?: string | null;
}

export interface CohortLane {
  id: string;
  name: string;
  order: number | null;
  y: number;
  height: number;
  nodeCount: number;
  startYear?: number;
  endYear?: number;
  backgroundColor?: string;
  textColor?: string;
}

export interface FamilyLayoutMetadata {
  totalNodes: number;
  totalEdges: number;
  totalLanes: number;
  width: number;
  height: number;
  calculatedAt: string;
}

export interface FamilyLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  lanes: CohortLane[];
  width: number;
  height: number;
  metadata: FamilyLayoutMetadata;
}

