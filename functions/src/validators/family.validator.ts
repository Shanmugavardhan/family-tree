import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { PersonSchema } from './person.validator';
import { RelationshipSchema } from './relationship.validator';

export class FamilyValidationError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'FamilyValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Checks for ancestry cycles in the graph formed by parent relationships.
 * Directed edge: child -> parent (person_id -> related_person_id)
 */
export function detectAncestryCycles(
  personIds: Set<string>,
  relationships: Relationship[]
): { hasCycle: boolean; cyclePath?: string[] } {
  // Build adjacency list: child -> list of parents
  const parentGraph = new Map<string, string[]>();
  for (const id of personIds) {
    parentGraph.set(id, []);
  }

  for (const rel of relationships) {
    if (rel.relationship_type === 'parent') {
      const parents = parentGraph.get(rel.person_id) || [];
      parents.push(rel.related_person_id);
      parentGraph.set(rel.person_id, parents);
    }
  }

  // 0 = unvisited, 1 = visiting (in call stack), 2 = visited
  const visited = new Map<string, number>();
  for (const id of personIds) {
    visited.set(id, 0);
  }

  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.set(node, 1);
    path.push(node);

    const parents = parentGraph.get(node) || [];
    for (const parent of parents) {
      const state = visited.get(parent) || 0;
      if (state === 1) {
        // Found back-edge to ancestor in current stack -> Cycle!
        path.push(parent);
        return true;
      }
      if (state === 0) {
        if (dfs(parent)) {
          return true;
        }
      }
    }

    path.pop();
    visited.set(node, 2);
    return false;
  }

  for (const id of personIds) {
    if (visited.get(id) === 0) {
      if (dfs(id)) {
        return { hasCycle: true, cyclePath: [...path] };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Validates the entire dataset of persons and relationships against all Phase 2 business rules.
 */
export function validateFamilyData(persons: Person[], relationships: Relationship[]): void {
  // 1. Validate individual schemas with Zod
  const personIds = new Set<string>();
  for (const person of persons) {
    const parseResult = PersonSchema.safeParse(person);
    if (!parseResult.success) {
      throw new FamilyValidationError(
        'INVALID_PERSON_DATA',
        `Person "${person.id}" has invalid data: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        parseResult.error.issues
      );
    }
    if (personIds.has(person.id)) {
      throw new FamilyValidationError('DUPLICATE_PERSON_ID', `Duplicate person ID detected: "${person.id}"`);
    }
    personIds.add(person.id);
  }

  const relationshipIds = new Set<string>();
  const parentPairs = new Set<string>(); // "child:parent"
  const spousePairs = new Set<string>(); // canonical sorted "p1:p2"
  const childParentCount = new Map<string, number>();

  for (const rel of relationships) {
    // Schema check
    const parseResult = RelationshipSchema.safeParse(rel);
    if (!parseResult.success) {
      throw new FamilyValidationError(
        'INVALID_RELATIONSHIP_DATA',
        `Relationship "${rel.id}" has invalid data: ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
        parseResult.error.issues
      );
    }

    // Unique relationship ID
    if (relationshipIds.has(rel.id)) {
      throw new FamilyValidationError('DUPLICATE_RELATIONSHIP_ID', `Duplicate relationship ID detected: "${rel.id}"`);
    }
    relationshipIds.add(rel.id);

    // Referential integrity
    if (!personIds.has(rel.person_id)) {
      throw new FamilyValidationError(
        'UNKNOWN_PERSON_REFERENCE',
        `Relationship "${rel.id}" references nonexistent person_id: "${rel.person_id}"`
      );
    }
    if (!personIds.has(rel.related_person_id)) {
      throw new FamilyValidationError(
        'UNKNOWN_PERSON_REFERENCE',
        `Relationship "${rel.id}" references nonexistent related_person_id: "${rel.related_person_id}"`
      );
    }

    // No self-relations
    if (rel.person_id === rel.related_person_id) {
      throw new FamilyValidationError('SELF_RELATION_NOT_ALLOWED', `A person cannot be their own relative in "${rel.id}"`);
    }

    // Parent relationship rules
    if (rel.relationship_type === 'parent') {
      const pairKey = `${rel.person_id}:${rel.related_person_id}`;
      if (parentPairs.has(pairKey)) {
        throw new FamilyValidationError(
          'DUPLICATE_PARENT_RELATIONSHIP',
          `Duplicate parent relationship: Person "${rel.person_id}" already has parent "${rel.related_person_id}"`
        );
      }
      parentPairs.add(pairKey);

      // Max parents rule (maximum 2 biological/recorded parents)
      const currentParents = (childParentCount.get(rel.person_id) || 0) + 1;
      if (currentParents > 2) {
        throw new FamilyValidationError(
          'MAX_PARENTS_EXCEEDED',
          `Person "${rel.person_id}" cannot have more than 2 parents in the initial model.`
        );
      }
      childParentCount.set(rel.person_id, currentParents);
    }

    // Spouse relationship rules (symmetric duplicate prevention)
    if (rel.relationship_type === 'spouse') {
      const [p1, p2] = [rel.person_id, rel.related_person_id].sort();
      const spouseKey = `${p1}:${p2}`;
      if (spousePairs.has(spouseKey)) {
        throw new FamilyValidationError(
          'DUPLICATE_SPOUSE_RELATIONSHIP',
          `Duplicate spouse relationship between "${rel.person_id}" and "${rel.related_person_id}"`
        );
      }
      spousePairs.add(spouseKey);
    }
  }

  // 3. Ancestry Cycle Detection
  const cycleResult = detectAncestryCycles(personIds, relationships);
  if (cycleResult.hasCycle) {
    throw new FamilyValidationError(
      'ANCESTRY_CYCLE_DETECTED',
      `Ancestry cycle detected in family tree: ${cycleResult.cyclePath?.join(' -> ')}`,
      { cycle: cycleResult.cyclePath }
    );
  }
}

