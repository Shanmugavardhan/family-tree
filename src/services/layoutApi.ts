import { request } from './apiClient';
import { ApiResponse } from '../types/api';
import { FamilyLayout, LayoutOptions, PositionedNode, CohortLane } from '../types/layout';
import { getLocalCustomPersons } from './personApi';
import { getLocalCustomRelationships } from './relationshipApi';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

// Historical generation bands (Order & Epochs)
export const GENERATION_BANDS = [
  { id: 'ancestral_gilded', name: 'Gilded Generation', start: 1843, end: 1859, order: -3 },
  { id: 'missionary', name: 'Missionary Generation', start: 1860, end: 1882, order: -2 },
  { id: 'lost', name: 'Lost Generation', start: 1883, end: 1900, order: -1 },
  { id: 'greatest', name: 'Greatest Generation', start: 1901, end: 1927, order: 0 },
  { id: 'silent', name: 'Silent Generation', start: 1928, end: 1945, order: 1 },
  { id: 'baby_boomers', name: 'Baby Boomers', start: 1946, end: 1964, order: 2 },
  { id: 'gen_x', name: 'Generation X', start: 1965, end: 1980, order: 3 },
  { id: 'millennials', name: 'Millennials (Gen Y)', start: 1981, end: 1996, order: 4 },
  { id: 'gen_z', name: 'Generation Z', start: 1997, end: 2012, order: 5 },
  { id: 'gen_alpha', name: 'Generation Alpha', start: 2013, end: 2024, order: 6 },
  { id: 'gen_beta', name: 'Generation Beta', start: 2025, end: 2039, order: 7 },
];

export function augmentLayoutWithCustomPersons(
  baseLayout: FamilyLayout,
  lineage: string,
  options?: LayoutOptions
): FamilyLayout {
  const customPersons = getLocalCustomPersons();
  const customRels = getLocalCustomRelationships();

  const nodes = [...baseLayout.nodes];
  const edges = [...baseLayout.edges];
  const existingNodeIds = new Set(nodes.map((n) => n.id));
  const existingEdgeIds = new Set(edges.map((e) => e.id));
  const baseNodeIds = new Set(baseLayout.nodes.map((n) => n.id));

  if (customPersons.length > 0) {
    for (const person of customPersons) {
      if (existingNodeIds.has(person.id)) {
        // It's an existing node that was edited: update node attributes
        const existingNode = nodes.find((n) => n.id === person.id);
        if (existingNode) {
          if (person.first_name !== undefined) existingNode.firstName = person.first_name;
          if (person.last_name !== undefined) existingNode.lastName = person.last_name;
          existingNode.fullName = [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
          if (person.alias !== undefined) existingNode.alias = person.alias || undefined;
          if (person.gender !== undefined) existingNode.gender = person.gender;
          if (person.birth_date !== undefined) existingNode.birthDate = person.birth_date || undefined;
          if (person.death_date !== undefined) existingNode.deathDate = person.death_date || undefined;
          if (person.birth_place !== undefined) existingNode.birthPlace = person.birth_place || undefined;
          if (person.death_place !== undefined) existingNode.deathPlace = person.death_place || undefined;
          if (person.biography !== undefined) existingNode.biography = person.biography || undefined;
          if (person.is_living !== undefined) existingNode.isLiving = person.is_living;
          if (person.profile_photo !== undefined) {
            existingNode.photoUrl = person.profile_photo || undefined;
            existingNode.photoPath = person.profile_photo || null;
          }
          if (person.is_archived !== undefined) existingNode.isArchived = person.is_archived;

          // If birth date changed, update generation cohort
          if (person.birth_date) {
            const bYear = parseInt(person.birth_date.slice(0, 4), 10);
            if (!isNaN(bYear) && bYear > 1800 && bYear < 2100) {
              const matchedBand = GENERATION_BANDS.find(
                (b) => bYear >= b.start && bYear <= b.end
              );
              if (matchedBand) {
                existingNode.generationOrder = matchedBand.order;
                existingNode.generationId = matchedBand.id;
                existingNode.generationName = matchedBand.name;
              }
            }
          }
        }
        continue;
      }

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
      // 1. Check if person has a valid birth year (e.g. 2002 -> Generation Z, order 5)
      const birthYear = person.birth_date
        ? parseInt(person.birth_date.slice(0, 4), 10)
        : null;
      const validBirthYear =
        birthYear !== null && !isNaN(birthYear) && birthYear > 1800 && birthYear < 2100
          ? birthYear
          : null;

      let genOrder: number;
      let genId: string;
      let genName: string;

      const matchedBand =
        validBirthYear !== null
          ? GENERATION_BANDS.find((b) => validBirthYear >= b.start && validBirthYear <= b.end)
          : undefined;

      if (matchedBand) {
        // Explicit birth year takes absolute precedence over relative kinship index
        genOrder = matchedBand.order;
        genId = matchedBand.id;
        genName = matchedBand.name;
      } else {
        // Fallback: Infer generation order from kinship relation if birth year is unknown
        genOrder = relativeNode?.generationOrder ?? 0;
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
        genId = matchingLane?.id || relativeNode?.generationId || `gen-${genOrder}`;
        genName = matchingLane?.name || relativeNode?.generationName || `Generation ${genOrder}`;
      }

      const matchingLane = baseLayout.lanes.find((l) => l.order === genOrder);

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
      if (isPersonSpouse && relativeNode) {
        // Spouses must be placed side-by-side with partner
        targetX = relativeNode.x + (relativeNode.width || 190) + 130;
      } else if (existingInGen.length > 0) {
        // Place safely to the right of all existing members in this generation strip
        const maxXInLane = Math.max(...existingInGen.map((n) => n.x + (n.width || 190)));
        targetX = maxXInLane + 120;
      } else if (relativeNode) {
        targetX = relativeNode.x;
      }

      const newNode: PositionedNode = {
        id: person.id,
        personId: person.id,
        firstName: person.first_name,
        middleName: person.middle_name || null,
        lastName: person.last_name || null,
        alias: person.alias || undefined,
        biography: person.biography || undefined,
        birthPlace: person.birth_place || undefined,
        deathPlace: person.death_place || undefined,
        birthDate: person.birth_date || null,
        deathDate: person.death_date || undefined,
        birthYear: validBirthYear,
        generationId: genId,
        generationOrder: genOrder,
        generationName: genName,
        x: targetX,
        y: targetY,
        width: 190,
        height: 160,
        photoPath: person.profile_photo || null,
        photoUrl: person.profile_photo || undefined,
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

  // 3. DETERMINISTIC SPOUSE SIDE-BY-SIDE REARRANGEMENT & NON-OVERLAP PASS
  // Rule: Any spouse relationships MUST stay side-by-side only with no intermediate nodes.
  // The generational strip rearranges dynamically to accommodate the couple unit.
  const genGroups = new Map<number, PositionedNode[]>();
  for (const node of nodes) {
    const order = node.generationOrder ?? 0;
    if (!genGroups.has(order)) {
      genGroups.set(order, []);
    }
    genGroups.get(order)!.push(node);
  }

  const SPOUSE_GAP = 130; // 190px card + 130px gap = 320px standard couple spacing
  const MIN_UNIT_GAP = 150; // Minimum gap between distinct family units

  for (const [_order, laneNodes] of genGroups) {
    if (laneNodes.length <= 1) continue;

    // A. Unify Y coordinate to lane baseline
    const baseNodes = laneNodes.filter((n) => baseNodeIds.has(n.id));
    const baselineY = baseNodes.length > 0 ? baseNodes[0].y : laneNodes[0].y;
    for (const node of laneNodes) {
      node.y = baselineY;
    }

    // B. Group nodes into Couple Units and Single Units
    const visited = new Set<string>();
    interface LayoutUnit {
      type: 'couple' | 'single';
      members: PositionedNode[];
      anchorX: number;
    }
    const units: LayoutUnit[] = [];

    // Sort laneNodes by X first
    laneNodes.sort((a, b) => a.x - b.x);

    for (const node of laneNodes) {
      if (visited.has(node.id)) continue;

      const spEdge = edges.find(
        (e) => e.type === 'spouse' && (e.source === node.id || e.target === node.id)
      );

      let spouseNode: PositionedNode | undefined;
      if (spEdge) {
        const otherId = spEdge.source === node.id ? spEdge.target : spEdge.source;
        spouseNode = laneNodes.find((n) => n.id === otherId);
      }

      if (spouseNode && !visited.has(spouseNode.id)) {
        visited.add(node.id);
        visited.add(spouseNode.id);

        // Keep order: prioritize existing base member first, otherwise preserve relative X
        const pair = [node, spouseNode].sort((a, b) => {
          const aIsBase = baseNodeIds.has(a.id);
          const bIsBase = baseNodeIds.has(b.id);
          if (aIsBase && !bIsBase) return -1;
          if (!aIsBase && bIsBase) return 1;
          return a.x - b.x;
        });

        units.push({
          type: 'couple',
          members: pair,
          anchorX: pair[0].x,
        });
      } else {
        visited.add(node.id);
        units.push({
          type: 'single',
          members: [node],
          anchorX: node.x,
        });
      }
    }

    // Sort all units by their anchorX
    units.sort((a, b) => a.anchorX - b.anchorX);

    // C. Sequentially arrange units along the strip, guaranteeing spouses are strictly adjacent
    let currentX = units[0].anchorX;
    for (let uIdx = 0; uIdx < units.length; uIdx++) {
      const unit = units[uIdx];
      if (unit.anchorX > currentX) {
        currentX = unit.anchorX;
      }

      if (unit.type === 'couple') {
        unit.members[0].x = currentX;
        unit.members[1].x = currentX + (unit.members[0].width || 190) + SPOUSE_GAP;
        currentX = unit.members[1].x + (unit.members[1].width || 190) + MIN_UNIT_GAP;
      } else {
        unit.members[0].x = currentX;
        currentX = unit.members[0].x + (unit.members[0].width || 190) + MIN_UNIT_GAP;
      }
    }
  }
}

  // 4. Canonical orientation for all spouse edges:
  // source must ALWAYS be the leftmost spouse, target must be the rightmost spouse.
  // This guarantees that the spouse link line connects only between the adjacent edges
  // of the two medallions and never cuts across either person's tile.
  for (const edge of edges) {
    if (edge.type === 'spouse') {
      const srcNode = nodes.find((n) => n.id === edge.source);
      const tgtNode = nodes.find((n) => n.id === edge.target);
      if (srcNode && tgtNode && srcNode.x > tgtNode.x) {
        edge.source = tgtNode.id;
        edge.target = srcNode.id;
      }
    }
  }

  // 5. Adjust canvas width if any node extends beyond
  let maxX = baseLayout.width;
  for (const n of nodes) {
    if (n.x + (n.width || 190) + 120 > maxX) {
      maxX = n.x + (n.width || 190) + 120;
    }
  }

  // 6. Unified active generations: strictly populated cohorts only.
  // Empty generations (like Gilded, Missionary, Lost, Greatest, Silent, Alpha, Beta when unrepresented)
  // are permanently omitted from both desktop and mobile views.
  const populatedOrders = Array.from(
    new Set(
      nodes
        .map((n) => n.generationOrder)
        .filter((g): g is number => typeof g === 'number')
    )
  ).sort((a, b) => a - b);

  const finalLanes: CohortLane[] = [];
  let curY = 0;
  for (const order of populatedOrders) {
    const existingLane = baseLayout.lanes.find((l) => l.order === order);
    const bandDef = GENERATION_BANDS.find((b) => b.order === order);
    const laneHeight = existingLane?.height || 440;
    const lane: CohortLane = {
      id: existingLane?.id || bandDef?.id || `gen_order_${order}`,
      name: existingLane?.name || bandDef?.name || `Generation ${order}`,
      order,
      y: curY,
      height: laneHeight,
      nodeCount: nodes.filter((n) => n.generationOrder === order).length,
      startYear: existingLane?.startYear ?? bandDef?.start,
      endYear: existingLane?.endYear ?? bandDef?.end,
      backgroundColor: existingLane?.backgroundColor,
      textColor: existingLane?.textColor,
    };
    finalLanes.push(lane);
    curY += laneHeight;
  }

  // Handle unknown birth year lane if any nodes have null generationOrder
  const hasUnknownNodes = nodes.some((n) => n.generationOrder === null);
  if (hasUnknownNodes) {
    const existingUnknownLane = baseLayout.lanes.find((l) => l.order === null);
    const laneHeight = existingUnknownLane?.height || 440;
    finalLanes.push({
      id: 'unknown_birth_year',
      name: 'Birth Year Unknown',
      order: null,
      y: curY,
      height: laneHeight,
      nodeCount: nodes.filter((n) => n.generationOrder === null).length,
      backgroundColor: '#64748b',
      textColor: '#ffffff',
    });
    curY += laneHeight;
  }

  // Position nodes within their respective generational lane
  for (const node of nodes) {
    const targetLane = finalLanes.find((l) => l.order === node.generationOrder);
    if (targetLane) {
      node.y = targetLane.y + Math.round((targetLane.height - (node.height || 160)) / 2);
    }
  }

  let finalNodes = nodes;
  if (!options?.includeArchived) {
    finalNodes = finalNodes.filter((n) => !n.isArchived);
  }

  return {
    ...baseLayout,
    lanes: finalLanes,
    nodes: finalNodes,
    edges,
    width: maxX,
    height: finalLanes.length > 0 ? curY : baseLayout.height,
    metadata: {
      ...baseLayout.metadata,
      width: maxX,
      totalNodes: finalNodes.length,
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
        query.set('compactLanes', 'true');
        query.set('inferGenerations', (options?.inferGenerations ?? true).toString());
        if (options?.nodeWidth) query.set('nodeWidth', options.nodeWidth.toString());
        if (options?.nodeHeight) query.set('nodeHeight', options.nodeHeight.toString());
        if (options?.horizontalSpacing) query.set('horizontalSpacing', options.horizontalSpacing.toString());
        if (options?.lineage) query.set('lineage', options.lineage);

        const queryString = query.toString();
        const apiResult = await request<FamilyLayout>(`/layout${queryString ? `?${queryString}` : ''}`);
        if (apiResult.success && apiResult.data) {
          const augmented = augmentLayoutWithCustomPersons(apiResult.data, lineage, options);
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
      const staticUrl = `/data/layout-${lineage}-compact.json?v=${Date.now()}`;
      let staticRes = await fetch(staticUrl, { cache: 'no-cache' });
      if (!staticRes.ok) {
        staticRes = await fetch(`/data/layout-${lineage}.json?v=${Date.now()}`, { cache: 'no-cache' });
      }
      if (staticRes.ok) {
        const fallbackData = await staticRes.json();
        const augmented = augmentLayoutWithCustomPersons(fallbackData, lineage, options);
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
