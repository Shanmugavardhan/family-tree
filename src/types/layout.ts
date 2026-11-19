import { FamilyGraphEdgeType } from './graph';

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  generationId: string | null;
  generationOrder: number | null;

  personId?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  birthYear?: number | null;
  generationName?: string | null;
  photoPath?: string | null;
  gender?: string;
  isLiving?: boolean;
  isArchived?: boolean;
  isInferredGeneration?: boolean;
  hasExternalLineage?: boolean;
  externalLineage?: any;
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

export interface LayoutOptions {
  includeArchived?: boolean;
  compactLanes?: boolean;
  inferGenerations?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
}

