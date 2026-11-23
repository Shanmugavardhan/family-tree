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

    for (const rel of personRels) {
      const otherId = rel.person_id === person.id ? rel.related_person_id : rel.person_id;
      const foundNode = nodes.find((n) => n.id === otherId);
      if (foundNode) {
        relativeNode = foundNode;
        if (rel.relationship_type === 'parent') {
          if (rel.person_id === person.id) {
            isPersonChild = true;
          } else {
            isPersonParent = true;
          }
        } else if (rel.relationship_type === 'spouse') {
          isPersonSpouse = true;
        }
        break;
      }
    }

    // Also check if person's surname matches this lineage
    const normLineage = (lineage || '').trim().toLowerCase();
    const personSurname = (person.last_name || '').trim().toLowerCase();
    const matchesLineage = relativeNode || (personSurname && personSurname === normLineage);

    if (matchesLineage) {
      let x = relativeNode ? relativeNode.x : 500;
      let y = relativeNode ? relativeNode.y : 500;
      let genOrder = relativeNode?.generationOrder ?? 0;
      let genId = relativeNode?.generationId || 'unknown';
      let genName = relativeNode?.generationName || 'Generation';

      if (relativeNode) {
        if (isPersonChild) {
          genOrder = (relativeNode.generationOrder ?? 0) + 1;
          const matchingLane = baseLayout.lanes.find((l) => l.order === genOrder);
          y = matchingLane ? matchingLane.y + 30 : relativeNode.y + 220;
          if (matchingLane) {
            genId = matchingLane.id;
            genName = matchingLane.name;
          }
          // Position to the right of siblings in same lane
          const sameLaneNodes = nodes.filter((n) => Math.abs(n.y - y) < 80);
          if (sameLaneNodes.length > 0) {
            const maxX = Math.max(...sameLaneNodes.map((s) => s.x));
            x = maxX + (relativeNode.width || 190) + 40;
          } else {
            x = relativeNode.x;
          }
        } else if (isPersonSpouse) {
          x = relativeNode.x + 320;
          y = relativeNode.y;
        } else if (isPersonParent) {
          genOrder = (relativeNode.generationOrder ?? 0) - 1;
          const matchingLane = baseLayout.lanes.find((l) => l.order === genOrder);
          y = matchingLane ? matchingLane.y + 30 : relativeNode.y - 220;
          if (matchingLane) {
            genId = matchingLane.id;
            genName = matchingLane.name;
          }
          x = relativeNode.x;
        }
      }

      const birthYear = person.birth_date ? parseInt(person.birth_date.slice(0, 4), 10) : null;

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
        x,
        y,
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
        const otherId = rel.person_id === person.id ? rel.related_person_id : rel.person_id;
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

  // Adjust canvas width if any node extends beyond
  let maxX = baseLayout.width;
  for (const n of nodes) {
    if (n.x + n.width + 100 > maxX) {
      maxX = n.x + n.width + 100;
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
