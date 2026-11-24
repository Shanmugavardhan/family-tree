import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions, PositionedNode } from '../types/layout';
import { getLocalCustomPersons } from './personApi';
import { getLocalCustomRelationships } from './relationshipApi';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

export function augmentLayoutWithCustomPersons(
  baseLayout: FamilyLayout,
  lineage: string
): FamilyLayout {
  const customPersons = getLocalCustomPersons();
  const customRels = getLocalCustomRelationships();

  if (customPersons.length === 0) {
    return baseLayout;
  }

  const nodes = [...baseLayout.nodes];
  const edges = [...baseLayout.edges];
  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const existingEdgeIds = new Set(edges.map((e) => e.id));
  const baseNodeIds = new Set(baseLayout.nodes.map((n) => n.id));

  for (const person of customPersons) {
    if (existingNodeIds.has(person.id)) continue;

    // Check all relationships for this person
    const personRels = customRels.filter(
      (r) => r.person_id === person.id || r.related_person_id === person.id
    );

    let relativeNode: PositionedNode | undefined;
    let isPersonChild = false;
    let isPersonParent = false;
    let isPersonSpouse = false;

    // Prioritize parent relation (child of), then spouse, then parent of
    const parentRel = personRels.find(
      (r) => r.relationship_type === 'parent' && r.person_id === person.id
    );
    const spouseRel = personRels.find((r) => r.relationship_type === 'spouse');
    const childRel = personRels.find(
      (r) => r.relationship_type === 'parent' && r.related_person_id === person.id
    );

    const primaryRel = parentRel || spouseRel || childRel || personRels[0];

    if (primaryRel) {
      const otherId =
        primaryRel.person_id === person.id
          ? primaryRel.related_person_id
          : primaryRel.person_id;
      const foundNode = nodes.find((n) => n.id === otherId);
      if (foundNode) {
        relativeNode = foundNode;
        if (primaryRel.relationship_type === 'parent') {
          if (primaryRel.person_id === person.id) {
            isPersonChild = true;
          } else {
            isPersonParent = true;
          }
        } else if (primaryRel.relationship_type === 'spouse') {
          isPersonSpouse = true;
        }
      }
    }

    // Also check if person's surname matches this lineage
    const normLineage = (lineage || '').trim().toLowerCase();
    const personSurname = (person.last_name || '').trim().toLowerCase();
    const matchesLineage =
      relativeNode || (personSurname && personSurname === normLineage);

    if (matchesLineage) {
      let genOrder = relativeNode?.generationOrder ?? 0;
      if (relativeNode) {
        if (isPersonChild) {
          genOrder = (relativeNode.generationOrder ?? 0) + 1;
        } else if (isPersonParent) {
          genOrder = (relativeNode.generationOrder ?? 0) - 1;
        } else if (isPersonSpouse) {
          genOrder = relativeNode.generationOrder ?? 0;
        }
      }

      const matchingLane = baseLayout.lanes.find((l) => l.order === genOrder);
      const genId = matchingLane?.id || relativeNode?.generationId || `gen-${genOrder}`;
      const genName = matchingLane?.name || relativeNode?.generationName || `Generation ${genOrder}`;

      // 1. Determine exact lane baseline Y
      const existingInGen = nodes.filter((n) => n.generationOrder === genOrder);
      let targetY: number;
      if (existingInGen.length > 0) {
        targetY = existingInGen[0].y;
      } else if (matchingLane) {
        targetY = matchingLane.y + Math.round((matchingLane.height - 160) / 2);
      } else if (relativeNode) {
        targetY = isPersonChild ? relativeNode.y + 440 : isPersonParent ? relativeNode.y - 440 : relativeNode.y;
      } else {
        targetY = 2780;
      }

      // 2. Determine initial candidate X
      let targetX = 700;
      if (existingInGen.length > 0) {
        // Place safely to the right of all existing members in this generation strip
        const maxXInLane = Math.max(...existingInGen.map((n) => n.x + (n.width || 190)));
        targetX = maxXInLane + 120;
      } else if (relativeNode) {
        targetX = relativeNode.x;
      }

      const birthYear = person.birth_date
        ? parseInt(person.birth_date.slice(0, 4), 10)
        : null;

      const newNode: PositionedNode = {
        id: person.id,
        personId: person.id,
        firstName: person.first_name,
        middleName: person.middle_name || null,
        lastName: person.last_name || null,
        birthDate: person.birth_date || null,
        birthYear: isNaN(birthYear as any) ? null : birthYear,
        generationId: genId,
        generationOrder: genOrder,
        generationName: genName,
        x: targetX,
        y: targetY,
        width: 190,
        height: 160,
        photoPath: person.profile_photo || null,
        gender: person.gender,
        isLiving: person.is_living,
        isArchived: person.is_archived,
        isInferredGeneration: false,
        hasExternalLineage: false,
        externalLineage: null,
      };

      nodes.push(newNode);
      existingNodeIds.add(newNode.id);

      // Add edges connecting to existing nodes
      for (const rel of personRels) {
        const otherId =
          rel.person_id === person.id ? rel.related_person_id : rel.person_id;
        if (existingNodeIds.has(otherId)) {
          const edgeId = `edge-${rel.relationship_type}-${person.id}-${otherId}`;
          if (!existingEdgeIds.has(edgeId)) {
            if (rel.relationship_type === 'parent') {
              edges.push({
                id: edgeId,
                source: rel.related_person_id, // parent
                target: rel.person_id, // child
                type: 'parent_child',
                parentType: 'biological',
              });
            } else if (rel.relationship_type === 'spouse') {
              edges.push({
                id: edgeId,
                source: rel.person_id,
                target: rel.related_person_id,
                type: 'spouse',
              });
            }
            existingEdgeIds.add(edgeId);
          }
        }
      }
    }
  }

  // 3. DETERMINISTIC GLOBAL COLLISION RESOLUTION PASS
  // Guarantees zero overlapping tiles in any generational strip
  const genGroups = new Map<number, PositionedNode[]>();
  for (const node of nodes) {
    const order = node.generationOrder ?? 0;
    if (!genGroups.has(order)) {
      genGroups.set(order, []);
    }
    genGroups.get(order)!.push(node);
  }

  for (const [_order, laneNodes] of genGroups) {
    if (laneNodes.length <= 1) continue;

    // Unify Y coordinate to lane baseline
    const baseNodes = laneNodes.filter((n) => baseNodeIds.has(n.id));
    const baselineY = baseNodes.length > 0 ? baseNodes[0].y : laneNodes[0].y;
    for (const node of laneNodes) {
      node.y = baselineY;
    }

    // Sort left to right; if coordinates are close, base nodes precede custom nodes
    laneNodes.sort((a, b) => {
      if (Math.abs(a.x - b.x) < 30) {
        const aIsBase = baseNodeIds.has(a.id);
        const bIsBase = baseNodeIds.has(b.id);
        if (aIsBase && !bIsBase) return -1;
        if (!aIsBase && bIsBase) return 1;
      }
      return a.x - b.x;
    });

    // Sequential non-overlap sweep: minimum 80px gap between cards
    const MIN_GAP = 80;
    for (let i = 0; i < laneNodes.length - 1; i++) {
      const current = laneNodes[i];
      const next = laneNodes[i + 1];
      const currentWidth = current.width || 190;
      const minRequiredX = current.x + currentWidth + MIN_GAP;

      if (next.x < minRequiredX) {
        next.x = minRequiredX;
      }
    }
  }

  // 4. Adjust canvas width if any node extends beyond
  let maxX = baseLayout.width;
  for (const n of nodes) {
    if (n.x + (n.width || 190) + 120 > maxX) {
      maxX = n.x + (n.width || 190) + 120;
    }
  }

  return {
    ...baseLayout,
    nodes,
    edges,
    width: maxX,
    metadata: {
      ...baseLayout.metadata,
      width: maxX,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
  };
}

export const layoutApi = {
  getLayout: async (options?: LayoutOptions): Promise<ApiResponse<FamilyLayout>> => {
    const lineage = options?.lineage || 'konukuru';

    // 1. If running locally with local backend server, try backend API first
    if (isLocal) {
      try {
        const query = new URLSearchParams();
        if (options?.includeArchived) query.set('includeArchived', 'true');
        if (options?.compactLanes) query.set('compactLanes', 'true');
        query.set('inferGenerations', (options?.inferGenerations ?? true).toString());
        if (options?.nodeWidth) query.set('nodeWidth', options.nodeWidth.toString());
        if (options?.nodeHeight) query.set('nodeHeight', options.nodeHeight.toString());
        if (options?.horizontalSpacing) query.set('horizontalSpacing', options.horizontalSpacing.toString());
        if (options?.lineage) query.set('lineage', options.lineage);

        const queryString = query.toString();
        const apiResult = await request<FamilyLayout>(`/layout${queryString ? `?${queryString}` : ''}`);
        if (apiResult.success && apiResult.data) {
          const augmented = augmentLayoutWithCustomPersons(apiResult.data, lineage);
          return {
            success: true,
            data: augmented,
            error: null,
          };
        }
      } catch {
        // Fallback to static layout
      }
    }

    // 2. In production / static hosting CDN (or local fallback): load pre-rendered static layout directly
    try {
      const staticUrl = `/data/layout-${lineage}.json?v=${Date.now()}`;
      const staticRes = await fetch(staticUrl, { cache: 'no-cache' });
      if (staticRes.ok) {
        const fallbackData = await staticRes.json();
        const augmented = augmentLayoutWithCustomPersons(fallbackData, lineage);
        return {
          success: true,
          data: augmented,
          error: null,
        };
      }
    } catch {
      // ignore fallback error
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'LAYOUT_FETCH_FAILED',
        message: 'Failed to load family tree layout',
      },
    };
  },
};
