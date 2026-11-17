export interface FamilyGraphNode {
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
}

export type FamilyGraphEdgeType = 'parent_child' | 'spouse';

export interface FamilyGraphEdge {
  id: string;

  source: string;
  target: string;

  type: FamilyGraphEdgeType;
  parentType: string | null;
}

export interface FamilyGraphMetadata {
  totalNodes: number;
  totalEdges: number;
  classifiedCount: number;
  unclassifiedCount: number;
  generationCounts: Record<string, number>;
  generatedAt: string;
  includesArchived: boolean;
}

export interface FamilyGraph {
  nodes: FamilyGraphNode[];
  edges: FamilyGraphEdge[];
  metadata: FamilyGraphMetadata;
}

export interface BuildGraphOptions {
  includeArchived?: boolean;
  rejectInvalidReferences?: boolean;
}
