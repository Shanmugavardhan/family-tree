/**
 * Kinship Auto-Inference & Lineage Member Analysis
 *
 * Implements:
 * 1. Duplicate member detection within the current house lineage (Requirement 1).
 * 2. Automated kinship deduction: Given one relation (Father, Mother, Child, or Spouse),
 *    infers remaining relations based on graph edges in the house lineage (Requirement 11).
 */

export interface KinshipNode {
  id: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string;
  birthDate?: string | null;
  birthYear?: number | null;
}

export interface KinshipEdge {
  id?: string;
  source: string;
  target: string;
  type: string; // 'parent' | 'spouse' | 'child'
}

export interface DuplicateMemberMatch {
  id: string;
  fullName: string;
  birthYear?: number | null;
  birthDate?: string | null;
  gender?: string;
}

/**
 * Check if a person with the given name already exists in the current house lineage.
 * Returns matching persons if found, or empty array if unique.
 */
export function findDuplicateLineageMembers(
  firstName: string,
  lastName: string,
  nodes: KinshipNode[],
  excludeId?: string
): DuplicateMemberMatch[] {
  const fQuery = firstName.trim().toLowerCase();
  const lQuery = lastName.trim().toLowerCase();

  if (!fQuery) return [];

  const matches: DuplicateMemberMatch[] = [];

  for (const node of nodes) {
    if (excludeId && (node.id === excludeId || (node as any).personId === excludeId)) {
      continue;
    }

    const nFirst = (node.firstName || '').trim().toLowerCase();
    const nLast = (node.lastName || '').trim().toLowerCase();

    // Match conditions:
    // 1. Both first and last names match exactly
    // 2. If user only gave first name, matches exact first name
    // 3. If user gave first and last name, matches first name and empty last name or vice versa
    const isBothMatch = fQuery.length > 0 && lQuery.length > 0 && nFirst === fQuery && nLast === lQuery;
    const isFirstMatch = fQuery.length > 1 && !lQuery && nFirst === fQuery;

    if (isBothMatch || isFirstMatch) {
      const fullName = [node.firstName, node.middleName, node.lastName].filter(Boolean).join(' ');
      matches.push({
        id: node.id,
        fullName,
        birthYear: node.birthYear,
        birthDate: node.birthDate,
        gender: node.gender,
      });
    }
  }

  return matches;
}

export interface KinshipInferenceResult {
  inferredFatherId?: string;
  inferredMotherId?: string;
  inferredSpouseId?: string;
  inferredChildId?: string;
  reason?: string;
}

/**
 * Kinship Auto-Inference Algorithm (Requirement 11)
 *
 * Infers complementary relationships based on one selected relation:
 * - Selecting Father -> Finds Father's spouse in this lineage; auto-fills Mother.
 * - Selecting Mother -> Finds Mother's spouse in this lineage; auto-fills Father.
 * - Selecting Child -> Finds Child's existing parents in this lineage; auto-fills Spouse.
 * - Selecting Spouse -> Finds Spouse's children in this lineage; auto-suggests Child.
 */
export function inferKinshipRelations(params: {
  triggerField: 'father' | 'mother' | 'spouse' | 'child';
  triggerValue: string; // The ID selected by user
  currentFatherId?: string;
  currentMotherId?: string;
  currentSpouseId?: string;
  currentChildId?: string;
  subjectGender?: string;
  nodes: KinshipNode[];
  edges: KinshipEdge[];
}): KinshipInferenceResult {
  const {
    triggerField,
    triggerValue,
    currentFatherId,
    currentMotherId,
    currentSpouseId,
    currentChildId,
    subjectGender,
    nodes,
    edges,
  } = params;

  if (!triggerValue) {
    return {};
  }

  const nodeMap = new Map<string, KinshipNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if ((n as any).personId) {
      nodeMap.set((n as any).personId, n);
    }
  }

  // 1. Trigger is FATHER:
  // Find father's spouse from spouse edges. If found and female, auto-fill Mother.
  if (triggerField === 'father') {
    const spouseEdges = edges.filter(
      (e) =>
        e.type === 'spouse' &&
        (e.source === triggerValue || e.target === triggerValue)
    );

    for (const edge of spouseEdges) {
      const spouseId = edge.source === triggerValue ? edge.target : edge.source;
      const spouseNode = nodeMap.get(spouseId);
      if (spouseNode && (!currentMotherId || currentMotherId === '')) {
        const spouseName = [spouseNode.firstName, spouseNode.middleName, spouseNode.lastName]
          .filter(Boolean)
          .join(' ');
        return {
          inferredMotherId: spouseNode.id,
          reason: `✨ Auto-filled Mother (${spouseName}) based on Father's spouse in this lineage.`,
        };
      }
    }
  }

  // 2. Trigger is MOTHER:
  // Find mother's spouse from spouse edges. If found and male, auto-fill Father.
  if (triggerField === 'mother') {
    const spouseEdges = edges.filter(
      (e) =>
        e.type === 'spouse' &&
        (e.source === triggerValue || e.target === triggerValue)
    );

    for (const edge of spouseEdges) {
      const spouseId = edge.source === triggerValue ? edge.target : edge.source;
      const spouseNode = nodeMap.get(spouseId);
      if (spouseNode && (!currentFatherId || currentFatherId === '')) {
        const spouseName = [spouseNode.firstName, spouseNode.middleName, spouseNode.lastName]
          .filter(Boolean)
          .join(' ');
        return {
          inferredFatherId: spouseNode.id,
          reason: `✨ Auto-filled Father (${spouseName}) based on Mother's spouse in this lineage.`,
        };
      }
    }
  }

  // 3. Trigger is CHILD (Son / Daughter):
  // Find child's existing parents. If current person is creating/editing a mother or father,
  // link the child's other parent as spouse!
  if (triggerField === 'child') {
    // Parent edges: source = parent, target = child
    const parentEdges = edges.filter(
      (e) => e.type === 'parent' && e.target === triggerValue
    );

    if (parentEdges.length > 0 && (!currentSpouseId || currentSpouseId === '')) {
      for (const pEdge of parentEdges) {
        const parentNode = nodeMap.get(pEdge.source);
        if (!parentNode) continue;

        // If subject is male and child has a female parent -> spouse is mother
        if (subjectGender === 'male' && parentNode.gender === 'female') {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          return {
            inferredSpouseId: parentNode.id,
            reason: `✨ Auto-filled Spouse (${parentName}) based on Child's biological mother in this lineage.`,
          };
        }

        // If subject is female and child has a male parent -> spouse is father
        if (subjectGender === 'female' && parentNode.gender === 'male') {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          return {
            inferredSpouseId: parentNode.id,
            reason: `✨ Auto-filled Spouse (${parentName}) based on Child's biological father in this lineage.`,
          };
        }

        // If gender not set yet, but child has one parent
        if (parentEdges.length === 1) {
          const parentName = [parentNode.firstName, parentNode.lastName].filter(Boolean).join(' ');
          return {
            inferredSpouseId: parentNode.id,
            reason: `✨ Auto-suggested Spouse (${parentName}) who is also a parent of this child.`,
          };
        }
      }
    }
  }

  // 4. Trigger is SPOUSE:
  // Find children of this spouse. If current child is empty and spouse has children, suggest one.
  if (triggerField === 'spouse') {
    const childEdges = edges.filter(
      (e) => e.type === 'parent' && e.source === triggerValue
    );

    if (childEdges.length > 0 && (!currentChildId || currentChildId === '')) {
      const firstChildNode = nodeMap.get(childEdges[0].target);
      if (firstChildNode) {
        const childName = [firstChildNode.firstName, firstChildNode.lastName].filter(Boolean).join(' ');
        return {
          inferredChildId: firstChildNode.id,
          reason: `✨ Auto-suggested Child (${childName}) connected to this spouse in this lineage.`,
        };
      }
    }
  }

  return {};
}
