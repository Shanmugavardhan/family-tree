import { ApiResponse } from '../types/api';
import {
  FamilyLayout,
  LayoutOptions,
  PositionedNode,
  PositionedEdge,
  CohortLane,
} from '../types/layout';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { personApi } from './personApi';
import { relationshipApi } from './relationshipApi';

export const GENERATION_BANDS = [
  { id: 'gilded', name: 'Gilded Generation', order: -3, start: 1843, end: 1859, bg: '#1e1b2e', text: '#e2e8f0' },
  { id: 'missionary', name: 'Missionary Generation', order: -2, start: 1860, end: 1882, bg: '#1b2631', text: '#e2e8f0' },
  { id: 'lost', name: 'Lost Generation', order: -1, start: 1883, end: 1900, bg: '#1f2933', text: '#e2e8f0' },
  { id: 'greatest', name: 'Greatest Generation', order: 0, start: 1901, end: 1927, bg: '#14231d', text: '#e2e8f0' },
  { id: 'silent', name: 'Silent Generation', order: 1, start: 1928, end: 1945, bg: '#162521', text: '#e2e8f0' },
  { id: 'baby_boomers', name: 'Baby Boomers', order: 2, start: 1946, end: 1964, bg: '#162620', text: '#e2e8f0' },
  { id: 'gen_x', name: 'Generation X', order: 3, start: 1965, end: 1980, bg: '#111b2b', text: '#e2e8f0' },
  { id: 'millennials', name: 'Millennials (Gen Y)', order: 4, start: 1981, end: 1996, bg: '#27141d', text: '#e2e8f0' },
  { id: 'gen_z', name: 'Generation Z', order: 5, start: 1997, end: 2012, bg: '#291a10', text: '#e2e8f0' },
  { id: 'gen_alpha', name: 'Generation Alpha', order: 6, start: 2013, end: 2024, bg: '#13242b', text: '#e2e8f0' },
  { id: 'gen_beta', name: 'Generation Beta', order: 7, start: 2025, end: 2039, bg: '#1e1d2f', text: '#e2e8f0' },
];

const HOUSE_PROGENITORS: Record<string, string[]> = {
  konukuru: [
    '867842c1-b8a2-45ad-8d9c-89150e68eb16', // Murthy Chetty Konukuru
    '4a80001b-76bf-4e13-963b-89b2aafbb413', // Sarojamma Konukuru
  ],
  paradarami: [
    '1ae73a4b-b739-40d3-8b50-071bbf1b07eb', // Ramayya Chetty Paradarami
    'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b', // Achamma Paradarami
  ],
};

export function partitionLineageMembers(
  persons: Person[],
  relationships: Relationship[],
  targetLineage = 'konukuru'
) {
  const normTarget = (targetLineage || 'konukuru').trim().toLowerCase();
  const houseRootIds = new Set<string>(HOUSE_PROGENITORS[normTarget] || []);

  if (houseRootIds.size === 0) {
    for (const p of persons) {
      if ((p.last_name || '').trim().toLowerCase() === normTarget) {
        houseRootIds.add(p.id);
      }
    }
  }

  const coreBloodlineIds = new Set<string>(houseRootIds);

  // Expand upwards for progenitors
  let addedAncestors = true;
  while (addedAncestors) {
    addedAncestors = false;
    for (const rel of relationships) {
      if (rel.relationship_type === 'parent') {
        if (houseRootIds.has(rel.person_id) && !coreBloodlineIds.has(rel.related_person_id)) {
          coreBloodlineIds.add(rel.related_person_id);
          houseRootIds.add(rel.related_person_id);
          addedAncestors = true;
        }
      }
    }
  }

  // Expand downwards for biological linear descendants
  let addedDescendants = true;
  while (addedDescendants) {
    addedDescendants = false;
    for (const rel of relationships) {
      if (rel.relationship_type === 'parent') {
        if (coreBloodlineIds.has(rel.related_person_id) && !coreBloodlineIds.has(rel.person_id)) {
          coreBloodlineIds.add(rel.person_id);
          addedDescendants = true;
        }
      }
    }
  }

  // Main tree = core bloodline + direct spouses of core bloodline
  const mainTreePersonIds = new Set<string>(coreBloodlineIds);
  for (const rel of relationships) {
    if (rel.relationship_type === 'spouse') {
      if (coreBloodlineIds.has(rel.person_id) && !coreBloodlineIds.has(rel.related_person_id)) {
        mainTreePersonIds.add(rel.related_person_id);
      } else if (coreBloodlineIds.has(rel.related_person_id) && !coreBloodlineIds.has(rel.person_id)) {
        mainTreePersonIds.add(rel.person_id);
      }
    }
  }

  // Detect external parents (parents of main tree members who are NOT in main tree)
  const externalParentsMap = new Map<
    string,
    { father: any; mother: any; lineageName: string; lineageId: string }
  >();

  for (const memberId of mainTreePersonIds) {
    const parentRels = relationships.filter(
      (r) => r.relationship_type === 'parent' && r.person_id === memberId
    );
    const externalParentIds = parentRels
      .map((r) => r.related_person_id)
      .filter((pid) => !mainTreePersonIds.has(pid));

    if (externalParentIds.length > 0) {
      let father: any = null;
      let mother: any = null;
      let lineageLastName = '';

      for (const pid of externalParentIds) {
        const p = persons.find((x) => x.id === pid);
        if (!p) continue;
        if (p.gender === 'male' && !father) {
          father = {
            id: p.id,
            firstName: p.first_name,
            middleName: p.middle_name,
            lastName: p.last_name || '',
            gender: 'male',
            isLiving: p.is_living,
            birthYear: p.birth_date ? parseInt(p.birth_date.slice(0, 4), 10) : null,
            deathYear: p.death_date ? parseInt(p.death_date.slice(0, 4), 10) : null,
            birthPlace: p.birth_place,
            biography: p.biography,
            relation: 'Father',
          };
          if (p.last_name) lineageLastName = p.last_name;
        } else if (p.gender === 'female' && !mother) {
          mother = {
            id: p.id,
            firstName: p.first_name,
            middleName: p.middle_name,
            lastName: p.last_name || '',
            gender: 'female',
            isLiving: p.is_living,
            birthYear: p.birth_date ? parseInt(p.birth_date.slice(0, 4), 10) : null,
            deathYear: p.death_date ? parseInt(p.death_date.slice(0, 4), 10) : null,
            birthPlace: p.birth_place,
            biography: p.biography,
            relation: 'Mother',
          };
          if (p.last_name) lineageLastName = p.last_name;
        }
      }

      const lineageId = lineageLastName ? lineageLastName.toLowerCase() : 'external';
      const lineageName = lineageLastName ? `${lineageLastName} Family Tree` : 'External Ancestry';
      externalParentsMap.set(memberId, { father, mother, lineageName, lineageId });
    }
  }

  return { mainTreePersonIds, coreBloodlineIds, externalParentsMap };
}

export function arrangeSideBySideInLanes(
  nodes: PositionedNode[],
  edges: PositionedEdge[],
  lanes: CohortLane[],
  baseWidth: number,
  coreBloodlineIds?: Set<string>
): number {
  const SP_GAP = 56;
  const UNIT_GAP = 72;
  const LEFT_MARGIN = 120;
  let maxX = baseWidth;

  const spouseAdj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.type === 'spouse') {
      if (!spouseAdj.has(e.source)) spouseAdj.set(e.source, new Set());
      if (!spouseAdj.has(e.target)) spouseAdj.set(e.target, new Set());
      spouseAdj.get(e.source)!.add(e.target);
      spouseAdj.get(e.target)!.add(e.source);
    }
  }

  const parentToChildren = new Map<string, string[]>();
  const childToParents = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'parent_child') {
      if (!parentToChildren.has(e.source)) parentToChildren.set(e.source, []);
      parentToChildren.get(e.source)!.push(e.target);
      if (!childToParents.has(e.target)) childToParents.set(e.target, []);
      childToParents.get(e.target)!.push(e.source);
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const sortedLanes = [...lanes].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const getCoupleCenterX = (node: PositionedNode): number => {
    const spSet = spouseAdj.get(node.id);
    if (spSet) {
      for (const spId of spSet) {
        const spNode = nodeById.get(spId);
        if (spNode && spNode.generationOrder === node.generationOrder) {
          const c1 = node.x + (node.width || 190) / 2;
          const c2 = spNode.x + (spNode.width || 190) / 2;
          return (c1 + c2) / 2;
        }
      }
    }
    return node.x + (node.width || 190) / 2;
  };

  const getBirthSortKey = (node: PositionedNode): number => {
    if (node.birthDate) {
      const fullMatch = node.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (fullMatch) {
        return parseInt(fullMatch[1] + fullMatch[2] + fullMatch[3], 10);
      }
      const yearMatch = node.birthDate.match(/^(\d{4})/);
      if (yearMatch) {
        return parseInt(yearMatch[1], 10) * 10000;
      }
    }
    if (typeof node.birthYear === 'number' && !isNaN(node.birthYear)) {
      return node.birthYear * 10000;
    }
    return 99999999;
  };

  // Bottom-up subtree width calculation: each parent unit reserves at least the horizontal span
  // required by all of its descendant units so adjacent family branches never crowd or collide.
  const subtreeWidthByNodeId = new Map<string, number>();
  const getUnitKey = (unitNodes: PositionedNode[]) =>
    unitNodes
      .map((n) => n.id)
      .sort()
      .join('|');

  const unitMapByOrder = new Map<number, PositionedNode[][]>();
  const nodeToUnitKey = new Map<string, string>();
  for (const lane of sortedLanes) {
    if (lane.order === null) continue;
    const laneNodes = nodes.filter((n) => n.generationOrder === lane.order);
    const laneVisited = new Set<string>();
    const laneUnits: PositionedNode[][] = [];
    for (const node of laneNodes) {
      if (laneVisited.has(node.id)) continue;
      const unitMembers: PositionedNode[] = [node];
      laneVisited.add(node.id);
      const queue = [node.id];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const spSet = spouseAdj.get(currId);
        if (spSet) {
          for (const spId of spSet) {
            if (!laneVisited.has(spId)) {
              const spNode = nodeById.get(spId);
              if (spNode && spNode.generationOrder === lane.order) {
                laneVisited.add(spId);
                unitMembers.push(spNode);
                queue.push(spId);
              }
            }
          }
        }
      }
      laneUnits.push(unitMembers);
      const uKey = getUnitKey(unitMembers);
      for (const m of unitMembers) nodeToUnitKey.set(m.id, uKey);
    }
    unitMapByOrder.set(lane.order, laneUnits);
  }

  for (let lIdx = sortedLanes.length - 1; lIdx >= 0; lIdx--) {
    const lane = sortedLanes[lIdx];
    if (lane.order === null) continue;
    const laneUnits = unitMapByOrder.get(lane.order) || [];
    for (const unitMembers of laneUnits) {
      const ownWidth =
        unitMembers.reduce((sum, n) => sum + (n.width || 190), 0) +
        Math.max(0, unitMembers.length - 1) * SP_GAP;

      // Collect unique child units in lower lanes
      const childUnitKeys = new Set<string>();
      const childUnitWidths: number[] = [];
      for (const m of unitMembers) {
        const cIds = parentToChildren.get(m.id) || [];
        for (const cId of cIds) {
          const cNode = nodeById.get(cId);
          if (!cNode || cNode.generationOrder === null || lane.order === null || cNode.generationOrder <= lane.order) continue;
          const cuKey = nodeToUnitKey.get(cId);
          if (cuKey && !childUnitKeys.has(cuKey)) {
            childUnitKeys.add(cuKey);
            childUnitWidths.push(subtreeWidthByNodeId.get(cId) ?? (cNode.width || 190));
          }
        }
      }

      const childrenSpan =
        childUnitWidths.reduce((s, w) => s + w, 0) +
        Math.max(0, childUnitWidths.length - 1) * UNIT_GAP;
      const totalSubtreeWidth = Math.max(ownWidth, childrenSpan);
      for (const m of unitMembers) {
        subtreeWidthByNodeId.set(m.id, totalSubtreeWidth);
      }
    }
  }

  const positionLaneUnits = (lane: CohortLane, useParentCenters: boolean) => {
    const laneNodes = nodes.filter((n) => n.generationOrder === lane.order);
    if (laneNodes.length === 0) return;

    const visited = new Set<string>();
    const units: { nodes: PositionedNode[]; desiredX: number; birthKey: number; hasParents: boolean }[] = [];

    for (const node of laneNodes) {
      if (visited.has(node.id)) continue;
      const unitMembers: PositionedNode[] = [node];
      visited.add(node.id);

      const queue = [node.id];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const spSet = spouseAdj.get(currId);
        if (spSet) {
          for (const spId of spSet) {
            if (!visited.has(spId)) {
              const spNode = nodeById.get(spId);
              if (spNode && spNode.generationOrder === lane.order) {
                visited.add(spId);
                unitMembers.push(spNode);
                queue.push(spId);
              }
            }
          }
        }
      }

      // Inside a couple unit: earliest birth comes leftmost (tie-breaker: male left)
      unitMembers.sort((a, b) => {
        const bkA = getBirthSortKey(a);
        const bkB = getBirthSortKey(b);
        if (bkA !== bkB) return bkA - bkB;
        const aIsMale = a.gender === 'male';
        const bIsMale = b.gender === 'male';
        if (aIsMale !== bIsMale) return aIsMale ? -1 : 1;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });

      const parentCenterXs: number[] = [];
      if (useParentCenters) {
        for (const m of unitMembers) {
          const pIds = childToParents.get(m.id) || [];
          for (const pid of pIds) {
            const pn = nodeById.get(pid);
            if (pn) parentCenterXs.push(getCoupleCenterX(pn));
          }
        }
      }

      const desiredX =
        parentCenterXs.length > 0
          ? parentCenterXs.reduce((sum, x) => sum + x, 0) / parentCenterXs.length
          : unitMembers[0].x + (unitMembers[0].width || 190) / 2;

      const bloodlineMembers =
        coreBloodlineIds && coreBloodlineIds.size > 0
          ? unitMembers.filter((m) => coreBloodlineIds.has(m.id))
          : unitMembers;
      const ageBasis = bloodlineMembers.length > 0 ? bloodlineMembers : unitMembers;
      const unitBirthKey = Math.min(...ageBasis.map(getBirthSortKey));

      units.push({
        nodes: unitMembers,
        desiredX,
        birthKey: unitBirthKey,
        hasParents: parentCenterXs.length > 0,
      });
    }

    // Direct-family (sibling-group) age ordering:
    // Keep sibling groups ordered by their parent couple's horizontal position (desiredX),
    // and sort by direct-lineage age ONLY within the same direct family (same parents).
    units.sort((a, b) => {
      if (a.hasParents && b.hasParents && Math.abs(a.desiredX - b.desiredX) > 10) {
        return a.desiredX - b.desiredX;
      }
      if (a.birthKey !== b.birthKey) return a.birthKey - b.birthKey;
      if (a.desiredX !== b.desiredX) return a.desiredX - b.desiredX;
      return (a.nodes[0]?.firstName || '').localeCompare(b.nodes[0]?.firstName || '');
    });

    // Group sibling units sharing the same parent couple (desiredX) and center each sibling group under its parents
    let cursorX = LEFT_MARGIN;
    let i = 0;
    while (i < units.length) {
      const groupStart = i;
      const groupDesiredX = units[i].desiredX;
      while (
        i < units.length &&
        units[i].hasParents &&
        Math.abs(units[i].desiredX - groupDesiredX) <= 10
      ) {
        i++;
      }
      if (i === groupStart) i++;

      const groupUnits = units.slice(groupStart, i);
      const ownWidths = groupUnits.map(
        (u) =>
          u.nodes.reduce((sum, n) => sum + (n.width || 190), 0) +
          Math.max(0, u.nodes.length - 1) * SP_GAP
      );
      const slotWidths = groupUnits.map(
        (u, idx) =>
          Math.max(
            ownWidths[idx],
            subtreeWidthByNodeId.get(u.nodes[0]?.id || '') ?? ownWidths[idx]
          )
      );
      const totalGroupWidth =
        slotWidths.reduce((s, w) => s + w, 0) +
        Math.max(0, groupUnits.length - 1) * UNIT_GAP;

      const idealGroupStart = groupUnits[0].hasParents
        ? Math.round(groupDesiredX - totalGroupWidth / 2)
        : cursorX;
      let groupX = Math.max(cursorX, idealGroupStart);

      for (let gIdx = 0; gIdx < groupUnits.length; gIdx++) {
        const unitOffset = Math.round((slotWidths[gIdx] - ownWidths[gIdx]) / 2);
        let currX = groupX + unitOffset;
        for (const n of groupUnits[gIdx].nodes) {
          n.x = Math.round(currX);
          currX += (n.width || 190) + SP_GAP;
        }
        groupX += slotWidths[gIdx] + UNIT_GAP;
      }

      cursorX = groupX;
      const lastGroupNode = groupUnits[groupUnits.length - 1]?.nodes[groupUnits[groupUnits.length - 1].nodes.length - 1];
      const actualRight = lastGroupNode ? lastGroupNode.x + (lastGroupNode.width || 190) : cursorX;
      if (actualRight + 120 > maxX) maxX = Math.round(actualRight + 120);
    }
  };

  // Pass 1: age-ordered, parent-centered placement per lane
  for (const lane of sortedLanes) {
    positionLaneUnits(lane, true);
  }

  // Pass 2: Center root/elder lanes & widest lane around canvasCenterX
  const canvasCenterX = maxX / 2;
  let widestLaneOrder: number | null = null;
  let widestWidth = -1;
  for (const lane of sortedLanes) {
    if (lane.order === null) continue;
    const laneNodes = nodes.filter((n) => n.generationOrder === lane.order);
    if (laneNodes.length === 0) continue;
    const minLeft = Math.min(...laneNodes.map((n) => n.x));
    const maxRight = Math.max(...laneNodes.map((n) => n.x + (n.width || 190)));
    if (maxRight - minLeft > widestWidth) {
      widestWidth = maxRight - minLeft;
      widestLaneOrder = lane.order;
    }
  }

  for (const lane of sortedLanes) {
    if (lane.order === null) continue;
    const laneNodes = nodes.filter((n) => n.generationOrder === lane.order);
    if (laneNodes.length === 0) continue;

    const hasAnyParent = laneNodes.some((n) => (childToParents.get(n.id) || []).length > 0);
    if (!hasAnyParent || lane.order === widestLaneOrder) {
      const sortedLaneNodes = [...laneNodes].sort((a, b) => a.x - b.x);
      const firstNode = sortedLaneNodes[0];
      const lastNode = sortedLaneNodes[sortedLaneNodes.length - 1];
      const minLeft = firstNode.x;
      const maxRight = lastNode.x + (lastNode.width || 190);
      // Account for subtree-slot padding on the leftmost/rightmost units of a root lane
      // so centering the root lane never pushes its wider child branches past LEFT_MARGIN.
      const firstSubtreeW = !hasAnyParent ? (subtreeWidthByNodeId.get(firstNode.id) ?? (firstNode.width || 190)) : 0;
      const firstUnitNodes = sortedLaneNodes.filter((n) => nodeToUnitKey.get(n.id) === nodeToUnitKey.get(firstNode.id));
      const firstOwnW = firstUnitNodes.reduce((s, n) => s + (n.width || 190), 0) + Math.max(0, firstUnitNodes.length - 1) * SP_GAP;
      const leftPad = !hasAnyParent ? Math.max(0, Math.round((firstSubtreeW - firstOwnW) / 2)) : 0;

      const lastSubtreeW = !hasAnyParent ? (subtreeWidthByNodeId.get(lastNode.id) ?? (lastNode.width || 190)) : 0;
      const lastUnitNodes = sortedLaneNodes.filter((n) => nodeToUnitKey.get(n.id) === nodeToUnitKey.get(lastNode.id));
      const lastOwnW = lastUnitNodes.reduce((s, n) => s + (n.width || 190), 0) + Math.max(0, lastUnitNodes.length - 1) * SP_GAP;
      const rightPad = !hasAnyParent ? Math.max(0, Math.round((lastSubtreeW - lastOwnW) / 2)) : 0;

      const effectiveMinLeft = minLeft - leftPad;
      const effectiveMaxRight = maxRight + rightPad;
      const laneWidth = effectiveMaxRight - effectiveMinLeft;
      const desiredLeft = Math.max(LEFT_MARGIN, Math.round(canvasCenterX - laneWidth / 2));
      const shiftX = desiredLeft - effectiveMinLeft;
      if (shiftX !== 0) {
        for (const n of laneNodes) n.x += shiftX;
      }
    }
  }

  // Pass 3: Re-align all child lanes directly centered beneath their centered parent couples
  for (const lane of sortedLanes) {
    if (lane.order === null) continue;
    const laneNodes = nodes.filter((n) => n.generationOrder === lane.order);
    if (laneNodes.length === 0) continue;
    const hasAnyParent = laneNodes.some((n) => (childToParents.get(n.id) || []).length > 0);
    if (hasAnyParent) {
      positionLaneUnits(lane, true);
    }
  }

  // Canonical left-to-right orientation for spouse edges
  for (const edge of edges) {
    if (edge.type === 'spouse') {
      const srcNode = nodeById.get(edge.source);
      const tgtNode = nodeById.get(edge.target);
      if (srcNode && tgtNode && srcNode.x > tgtNode.x) {
        edge.source = tgtNode.id;
        edge.target = srcNode.id;
      }
    }
  }

  return maxX;
}

/**
 * Pure deterministic layout builder from live DB Person and Relationship records.
 * Always produces the full generational timeline (no compact mode, no local storage).
 */
export function buildFamilyLayoutFromRecords(
  allPersons: Person[],
  allRels: Relationship[],
  lineage = 'konukuru',
  options?: LayoutOptions
): FamilyLayout {
  const includeArchived = options?.includeArchived ?? false;
  const nodeWidth = options?.nodeWidth ?? 190;
  const nodeHeight = options?.nodeHeight ?? 160;
  const laneHeight = 440;

  const includedPersons = includeArchived
    ? allPersons
    : allPersons.filter((p) => !p.is_archived);

  const { mainTreePersonIds, coreBloodlineIds, externalParentsMap } = partitionLineageMembers(
    includedPersons,
    allRels,
    lineage
  );

  const targetPersons =
    mainTreePersonIds.size > 0
      ? includedPersons.filter((p) => mainTreePersonIds.has(p.id))
      : includedPersons;

  const targetIdSet = new Set(targetPersons.map((p) => p.id));

  // Initial generation classification from birth year
  const genOrderMap = new Map<string, number | null>();
  const inferredSet = new Set<string>();

  for (const p of targetPersons) {
    let order: number | null = null;
    if (p.birth_date) {
      const bYear = parseInt(p.birth_date.slice(0, 4), 10);
      if (!isNaN(bYear) && bYear > 1800 && bYear < 2100) {
        const band = GENERATION_BANDS.find((b) => bYear >= b.start && bYear <= b.end);
        if (band) order = band.order;
      }
    }
    genOrderMap.set(p.id, order);
  }

  // Kinship generation inference for members missing birth dates
  if (options?.inferGenerations !== false) {
    let changed = true;
    let passes = 0;
    while (changed && passes < 6) {
      changed = false;
      passes++;
      for (const p of targetPersons) {
        if (genOrderMap.get(p.id) !== null) continue;

        let inferred: number | null = null;
        for (const rel of allRels) {
          if (rel.relationship_type === 'spouse') {
            const partnerId =
              rel.person_id === p.id
                ? rel.related_person_id
                : rel.related_person_id === p.id
                ? rel.person_id
                : null;
            if (partnerId && targetIdSet.has(partnerId)) {
              const pOrder = genOrderMap.get(partnerId);
              if (pOrder !== null && pOrder !== undefined) {
                inferred = pOrder;
                break;
              }
            }
          }
        }
        if (inferred === null) {
          for (const rel of allRels) {
            if (rel.relationship_type === 'parent' && rel.person_id === p.id) {
              const parentOrder = genOrderMap.get(rel.related_person_id);
              if (parentOrder !== null && parentOrder !== undefined) {
                inferred = Math.min(7, parentOrder + 1);
                break;
              }
            }
          }
        }
        if (inferred === null) {
          for (const rel of allRels) {
            if (rel.relationship_type === 'parent' && rel.related_person_id === p.id) {
              const childOrder = genOrderMap.get(rel.person_id);
              if (childOrder !== null && childOrder !== undefined) {
                inferred = Math.max(-3, childOrder - 1);
                break;
              }
            }
          }
        }

        if (inferred !== null) {
          genOrderMap.set(p.id, inferred);
          inferredSet.add(p.id);
          changed = true;
        }
      }
    }
  }

  // Build nodes
  const nodes: PositionedNode[] = targetPersons.map((p, idx) => {
    const order = genOrderMap.get(p.id) ?? null;
    const band = order !== null ? GENERATION_BANDS.find((b) => b.order === order) : null;
    const bYear = p.birth_date ? parseInt(p.birth_date.slice(0, 4), 10) : null;
    const extLineage = externalParentsMap.get(p.id) || null;

    return {
      id: p.id,
      personId: p.id,
      firstName: p.first_name,
      middleName: p.middle_name || null,
      lastName: p.last_name || null,
      fullName: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '),
      alias: p.alias || undefined,
      biography: p.biography || undefined,
      birthPlace: p.birth_place || undefined,
      deathPlace: p.death_place || undefined,
      birthDate: p.birth_date || null,
      deathDate: p.death_date || undefined,
      birthYear: bYear && !isNaN(bYear) ? bYear : null,
      generationId: band?.id || null,
      generationOrder: order,
      generationName: band?.name || null,
      x: 120 + idx * 240,
      y: 0,
      width: nodeWidth,
      height: nodeHeight,
      photoPath: p.profile_photo || null,
      photoUrl: p.profile_photo || undefined,
      gender: p.gender,
      isLiving: p.is_living,
      isArchived: p.is_archived,
      isInferredGeneration: inferredSet.has(p.id),
      hasExternalLineage: Boolean(extLineage),
      externalLineage: extLineage,
    };
  });

  // Build deduplicated edges:
  // 1) Spouse edges (canonical pair)
  // 2) Parent-child edges: if both parents of a child are spouses of each other,
  //    emit ONE unified parent-child edge per (couple, child) so no duplicate lines appear.
  const edges: PositionedEdge[] = [];
  const edgeKeys = new Set<string>();
  const spousePairsSet = new Set<string>();

  for (const rel of allRels) {
    if (!targetIdSet.has(rel.person_id) || !targetIdSet.has(rel.related_person_id)) {
      continue;
    }
    if (rel.relationship_type === 'spouse') {
      const pair = [rel.person_id, rel.related_person_id].sort();
      const key = `spouse:${pair[0]}<->${pair[1]}`;
      spousePairsSet.add(`${pair[0]}<->${pair[1]}`);
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({
          id: `edge-spouse-${pair[0]}-${pair[1]}`,
          source: rel.person_id,
          target: rel.related_person_id,
          type: 'spouse',
        });
      }
    }
  }

  // Group parents per child
  const parentsByChild = new Map<string, Array<{ parentId: string; parentType: string }>>();
  for (const rel of allRels) {
    if (
      rel.relationship_type === 'parent' &&
      targetIdSet.has(rel.person_id) &&
      targetIdSet.has(rel.related_person_id)
    ) {
      if (!parentsByChild.has(rel.person_id)) {
        parentsByChild.set(rel.person_id, []);
      }
      const list = parentsByChild.get(rel.person_id)!;
      if (!list.some((x) => x.parentId === rel.related_person_id)) {
        list.push({
          parentId: rel.related_person_id,
          parentType: rel.parent_type || 'biological',
        });
      }
    }
  }

  const personMap = new Map(targetPersons.map((p) => [p.id, p]));
  for (const [childId, parentList] of parentsByChild.entries()) {
    // Keep only one edge per married couple (prefer male/father deterministically)
    const emittedParents: Array<{ parentId: string; parentType: string }> = [];
    const sortedParents = [...parentList].sort((a, b) => {
      const ga = personMap.get(a.parentId)?.gender === 'male' ? 0 : 1;
      const gb = personMap.get(b.parentId)?.gender === 'male' ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return a.parentId.localeCompare(b.parentId);
    });

    for (const pInfo of sortedParents) {
      const hasSpouseAlreadyEmitted = emittedParents.some((em) => {
        const pair = [em.parentId, pInfo.parentId].sort();
        return spousePairsSet.has(`${pair[0]}<->${pair[1]}`);
      });
      if (!hasSpouseAlreadyEmitted) {
        emittedParents.push(pInfo);
        edges.push({
          id: `edge-parent-${pInfo.parentId}-${childId}`,
          source: pInfo.parentId,
          target: childId,
          type: 'parent_child',
          parentType: pInfo.parentType,
        });
      }
    }
  }

  // Build full generational timeline lanes (all 11 cohorts)
  const lanes: CohortLane[] = GENERATION_BANDS.map((b, i) => ({
    id: b.id,
    name: b.name,
    order: b.order,
    y: i * laneHeight,
    height: laneHeight,
    nodeCount: nodes.filter((n) => n.generationOrder === b.order).length,
    startYear: b.start,
    endYear: b.end,
    backgroundColor: b.bg,
    textColor: b.text,
  }));

  if (nodes.some((n) => n.generationOrder === null)) {
    lanes.push({
      id: 'unknown_birth_year',
      name: 'Birth Year Unknown',
      order: null,
      y: lanes.length * laneHeight,
      height: laneHeight,
      nodeCount: nodes.filter((n) => n.generationOrder === null).length,
      backgroundColor: '#64748b',
      textColor: '#ffffff',
    });
  }

  // Position nodes vertically in their lane and horizontally in spouse units
  for (const node of nodes) {
    const lane = lanes.find((l) => l.order === node.generationOrder);
    if (lane) {
      node.y = lane.y + Math.round((lane.height - nodeHeight) / 2);
    }
  }

  const totalWidth = arrangeSideBySideInLanes(nodes, edges, lanes, 1600, coreBloodlineIds);
  const totalHeight = lanes.length * laneHeight;

  return {
    lanes,
    nodes,
    edges,
    width: totalWidth,
    height: totalHeight,
    metadata: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalLanes: lanes.length,
      width: totalWidth,
      height: totalHeight,
      calculatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Augments an existing FamilyLayout with live records from DB (no localStorage).
 * Preserves full generational timeline lanes without compacting empty cohorts.
 */
export function augmentLayoutWithCustomPersons(
  baseLayout: FamilyLayout,
  _lineage = 'konukuru',
  options?: LayoutOptions
): FamilyLayout {
  const lanes = baseLayout.lanes.map((l) => ({ ...l }));
  const nodes = baseLayout.nodes.map((n) => ({ ...n }));
  const edges = baseLayout.edges.map((e) => ({ ...e }));

  for (const lane of lanes) {
    lane.nodeCount = nodes.filter((n) => n.generationOrder === lane.order).length;
  }

  let curY = 0;
  for (const lane of lanes) {
    lane.y = curY;
    lane.height = lane.height || 440;
    curY += lane.height;
  }

  for (const node of nodes) {
    const targetLane = lanes.find((l) => l.order === node.generationOrder);
    if (targetLane) {
      node.y = targetLane.y + Math.round((targetLane.height - (node.height || 160)) / 2);
    }
  }

  const maxX = arrangeSideBySideInLanes(nodes, edges, lanes, baseLayout.width);

  const finalNodes = options?.includeArchived
    ? nodes
    : nodes.filter((n) => !n.isArchived);

  return {
    ...baseLayout,
    lanes,
    nodes: finalNodes,
    edges,
    width: maxX,
    height: lanes.length > 0 ? curY : baseLayout.height,
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

    try {
      const [personsRes, relsRes] = await Promise.all([
        personApi.getAll({ includeArchived: true }),
        relationshipApi.getAll(),
      ]);

      if (!personsRes.success || !personsRes.data) {
        return {
          success: false,
          data: null,
          error: personsRes.error || {
            code: 'LAYOUT_FETCH_FAILED',
            message: 'Failed to load family members from database',
          },
        };
      }

      const layout = buildFamilyLayoutFromRecords(
        personsRes.data,
        relsRes.data || [],
        lineage,
        options
      );

      return {
        success: true,
        data: layout,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: 'LAYOUT_FETCH_FAILED',
          message: err?.message || 'Failed to load family tree layout from database',
        },
      };
    }
  },
};
