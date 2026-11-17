import { AppError } from '../services/errors';
import { FamilyGraph } from './graph.types';

export class GraphValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'GRAPH_VALIDATION_ERROR', message, details);
    this.name = 'GraphValidationError';
  }
}

/**
 * Validates the structural integrity of a FamilyGraph.
 * Ensures referential integrity, unique identifiers, and absence of semantic duplicate edges.
 */
export function validateFamilyGraph(graph: FamilyGraph): void {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new GraphValidationError('Invalid graph structure: nodes and edges arrays are required.');
  }

  const nodeMap = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new GraphValidationError('Every graph node must have a non-empty string id.');
    }
    if (nodeMap.has(node.id)) {
      throw new GraphValidationError(`Duplicate node id detected: "${node.id}".`);
    }
    nodeMap.add(node.id);
  }

  const edgeIdSet = new Set<string>();
  const parentChildSet = new Set<string>();
  const spouseSet = new Set<string>();

  for (const edge of graph.edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      throw new GraphValidationError('Every graph edge must have a non-empty string id.');
    }
    if (edgeIdSet.has(edge.id)) {
      throw new GraphValidationError(`Duplicate edge id detected: "${edge.id}".`);
    }
    edgeIdSet.add(edge.id);

    // Verify source and target exist
    if (!nodeMap.has(edge.source)) {
      throw new GraphValidationError(
        `Edge "${edge.id}" references non-existent source node: "${edge.source}".`
      );
    }
    if (!nodeMap.has(edge.target)) {
      throw new GraphValidationError(
        `Edge "${edge.id}" references non-existent target node: "${edge.target}".`
      );
    }

    if (edge.source === edge.target) {
      throw new GraphValidationError(`Self-referencing edge detected: "${edge.id}".`);
    }

    if (edge.type === 'parent_child') {
      const key = `${edge.source}->${edge.target}`;
      if (parentChildSet.has(key)) {
        throw new GraphValidationError(`Duplicate parent_child edge detected: ${key}.`);
      }
      parentChildSet.add(key);
    } else if (edge.type === 'spouse') {
      // Normalize spouse key symmetrically
      const pair = [edge.source, edge.target].sort().join('<->');
      if (spouseSet.has(pair)) {
        throw new GraphValidationError(`Duplicate spouse edge detected between: ${pair}.`);
      }
      spouseSet.add(pair);
    } else {
      throw new GraphValidationError(`Unknown edge type: "${edge.type}".`);
    }
  }

  // Validate metadata counts
  if (graph.metadata) {
    if (graph.metadata.totalNodes !== graph.nodes.length) {
      throw new GraphValidationError(
        `Metadata totalNodes (${graph.metadata.totalNodes}) does not match nodes count (${graph.nodes.length}).`
      );
    }
    if (graph.metadata.totalEdges !== graph.edges.length) {
      throw new GraphValidationError(
        `Metadata totalEdges (${graph.metadata.totalEdges}) does not match edges count (${graph.edges.length}).`
      );
    }
  }
}
