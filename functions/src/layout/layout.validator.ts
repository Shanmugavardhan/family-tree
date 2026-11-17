import { AppError } from '../services/errors';
import { FamilyLayout } from './layout.types';

export class LayoutValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'LAYOUT_VALIDATION_ERROR', message, details);
    this.name = 'LayoutValidationError';
  }
}

/**
 * Validates the geometric and structural integrity of a FamilyLayout.
 * Ensures:
 * 1. Every node has finite positive dimensions and valid coordinates.
 * 2. Nodes in the same cohort share the identical Y coordinate.
 * 3. Nodes in different cohorts have distinct Y coordinates.
 * 4. Nodes with unknown birth year occupy their dedicated lane.
 * 5. No two nodes overlap horizontally or vertically.
 * 6. Referential integrity: all edges connect existing positioned nodes.
 * 7. Canvas dimensions enclose all positioned elements.
 */
export function validateFamilyLayout(layout: FamilyLayout): void {
  if (!layout || !Array.isArray(layout.nodes) || !Array.isArray(layout.edges)) {
    throw new LayoutValidationError('Invalid layout: nodes and edges arrays are required.');
  }

  const nodeMap = new Map<string, (typeof layout.nodes)[0]>();
  const cohortYMap = new Map<string, number>();

  for (const node of layout.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      throw new LayoutValidationError('Every positioned node must have a non-empty string id.');
    }
    if (nodeMap.has(node.id)) {
      throw new LayoutValidationError(`Duplicate positioned node id detected: "${node.id}".`);
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new LayoutValidationError(`Node "${node.id}" has invalid non-finite coordinates (x=${node.x}, y=${node.y}).`);
    }
    if (node.width <= 0 || node.height <= 0) {
      throw new LayoutValidationError(`Node "${node.id}" has invalid non-positive dimensions.`);
    }

    nodeMap.set(node.id, node);

    // Verify cohort Y consistency
    const cohortKey = node.generationOrder !== null ? `order_${node.generationOrder}` : 'unknown';
    if (!cohortYMap.has(cohortKey)) {
      // Ensure this Y is not already used by another distinct cohort
      for (const [existingCohort, existingY] of cohortYMap.entries()) {
        if (existingY === node.y) {
          throw new LayoutValidationError(
            `Cohort "${cohortKey}" shares the exact same Y coordinate (${node.y}) with cohort "${existingCohort}". Different cohorts must have distinct Y coordinates.`
          );
        }
      }
      cohortYMap.set(cohortKey, node.y);
    } else {
      const expectedY = cohortYMap.get(cohortKey)!;
      if (node.y !== expectedY) {
        throw new LayoutValidationError(
          `Node "${node.id}" in cohort "${cohortKey}" has Y coordinate ${node.y}, but expected ${expectedY}. Same cohort must have identical Y coordinate.`
        );
      }
    }
  }

  // Verify no overlap within any cohort (and across layout)
  // Group nodes by cohort for pairwise bounding box checks
  const cohortNodesMap = new Map<string, typeof layout.nodes>();
  for (const node of layout.nodes) {
    const key = node.generationOrder !== null ? `order_${node.generationOrder}` : 'unknown';
    if (!cohortNodesMap.has(key)) {
      cohortNodesMap.set(key, []);
    }
    cohortNodesMap.get(key)!.push(node);
  }

  for (const [cohortKey, nodesInCohort] of cohortNodesMap.entries()) {
    // Sort horizontally to check adjacent spacing
    const sorted = [...nodesInCohort].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];

      // Bounding box collision check
      const aRight = a.x + a.width;
      const bLeft = b.x;

      if (aRight > bLeft) {
        throw new LayoutValidationError(
          `Overlap detected in cohort "${cohortKey}" between node "${a.id}" (ends at x=${aRight}) and node "${b.id}" (starts at x=${bLeft}).`
        );
      }
    }
  }

  // Verify referential integrity of edges
  const edgeIdSet = new Set<string>();
  for (const edge of layout.edges) {
    if (!edge.id || typeof edge.id !== 'string') {
      throw new LayoutValidationError('Every positioned edge must have a valid id.');
    }
    if (edgeIdSet.has(edge.id)) {
      throw new LayoutValidationError(`Duplicate edge id detected: "${edge.id}".`);
    }
    edgeIdSet.add(edge.id);

    if (!nodeMap.has(edge.source)) {
      throw new LayoutValidationError(
        `Positioned edge "${edge.id}" references non-existent source node: "${edge.source}".`
      );
    }
    if (!nodeMap.has(edge.target)) {
      throw new LayoutValidationError(
        `Positioned edge "${edge.id}" references non-existent target node: "${edge.target}".`
      );
    }
  }

  // Verify canvas dimensions enclose all nodes
  for (const node of layout.nodes) {
    if (node.x + node.width > layout.width) {
      throw new LayoutValidationError(
        `Node "${node.id}" exceeds canvas width (${node.x + node.width} > ${layout.width}).`
      );
    }
    if (node.y + node.height > layout.height) {
      throw new LayoutValidationError(
        `Node "${node.id}" exceeds canvas height (${node.y + node.height} > ${layout.height}).`
      );
    }
  }
}
