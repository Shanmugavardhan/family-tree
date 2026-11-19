import { FamilyRepository } from '../repositories/family.repository';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { GenerationService } from '../generations/generation.service';
import {
  FamilyGraph,
  FamilyGraphNode,
  FamilyGraphEdge,
  BuildGraphOptions,
} from './graph.types';
import { validateFamilyGraph, GraphValidationError } from './graph.validator';

export class GraphService {
  private repository: FamilyRepository;
  private generationService: GenerationService;

  constructor(
    repository?: FamilyRepository,
    generationService?: GenerationService
  ) {
    this.repository = repository || new LocalJsonFamilyRepository();
    this.generationService = generationService || new GenerationService();
  }

  /**
   * Transforms the family database into a validated chronological visualization graph.
   *
   * Crucial Architectural Guarantees:
   * 1. Does not mutate underlying persons.json or relationships.json data.
   * 2. Birth cohort determines generation assignments independently of kinship hierarchy.
   * 3. Reverses stored parent relationships from Child->Parent into visualization Parent->Child edges.
   * 4. Deduplicates spouse edges so each couple has exactly one symmetric connection.
   * 5. Excludes archived individuals and dangling edges by default unless includeArchived=true.
   * 6. Preserves people with unknown/missing birth dates in an unclassified cohort.
   * 7. Safely validates or rejects invalid relationships referencing non-existent individuals.
   */
  async buildFamilyGraph(options?: BuildGraphOptions): Promise<FamilyGraph> {
    const includeArchived = options?.includeArchived ?? false;
    const rejectInvalidReferences = options?.rejectInvalidReferences ?? true;

    // Load data from repository
    const allPersons = await this.repository.getAllPersons(true);
    const allRels = await this.repository.getAllRelationships();

    // Map of all persons in database for existence checking
    const allPersonIdSet = new Set<string>();
    for (const p of allPersons) {
      allPersonIdSet.add(p.id);
    }

    // Filter persons according to archived policy
    const includedPersons = includeArchived
      ? allPersons
      : allPersons.filter((p) => !p.is_archived);

    // Partition main house members vs external surnamed lineage parents
    const { mainTreePersonIds, externalParentsMap } = this.partitionLineageMembers(
      includedPersons,
      allRels,
      options?.lineage
    );

    // Target persons for the primary visualization tree
    const targetPersons = mainTreePersonIds.size > 0
      ? includedPersons.filter((p) => mainTreePersonIds.has(p.id))
      : includedPersons;

    const personIdMap = new Map<string, (typeof targetPersons)[0]>();
    for (const p of targetPersons) {
      personIdMap.set(p.id, p);
    }

    const targetPersonIdSet = new Set<string>(targetPersons.map((p) => p.id));

    // 1. Build Nodes
    const generationCounts: Record<string, number> = {};
    let classifiedCount = 0;
    let unclassifiedCount = 0;

    const nodes: FamilyGraphNode[] = targetPersons.map((person) => {
      const birthYear = this.generationService.extractBirthYear(person.birth_date);
      const gen = this.generationService.getGenerationByBirthYear(birthYear);
      const extInfo = externalParentsMap.get(person.id);

      if (gen) {
        classifiedCount++;
        generationCounts[gen.id] = (generationCounts[gen.id] || 0) + 1;
      } else {
        unclassifiedCount++;
      }

      return {
        id: person.id,
        personId: person.id,
        firstName: person.first_name,
        middleName: person.middle_name ?? null,
        lastName: person.last_name ?? null,
        birthDate: person.birth_date ?? null,
        birthYear,
        generationId: gen ? gen.id : null,
        generationName: gen ? gen.name : null,
        generationOrder: gen ? gen.order : null,
        photoPath: person.profile_photo ?? null,
        gender: person.gender,
        isLiving: person.is_living,
        isArchived: person.is_archived,
        hasExternalLineage: !!extInfo,
        externalLineage: extInfo || null,
      };
    });

    // 2. Build Edges
    const edges: FamilyGraphEdge[] = [];
    const parentChildEdgeKeys = new Set<string>();
    const spouseEdgePairs = new Set<string>();

    for (const rel of allRels) {
      if (rel.relationship_type === 'parent') {
        const parentId = rel.related_person_id;
        const childId = rel.person_id;

        const parentExists = allPersonIdSet.has(parentId);
        const childExists = allPersonIdSet.has(childId);

        if (!parentExists || !childExists) {
          if (rejectInvalidReferences) {
            const missingId = !parentExists ? parentId : childId;
            throw new GraphValidationError(
              `Relationship "${rel.id}" references non-existent person ID: "${missingId}".`
            );
          }
          continue;
        }

        // Omit edges connecting to external lineage persons outside the target tree
        if (!targetPersonIdSet.has(parentId) || !targetPersonIdSet.has(childId)) {
          continue;
        }

        if (!personIdMap.has(parentId) || !personIdMap.has(childId)) {
          continue;
        }

        const edgeKey = `${parentId}->${childId}`;
        if (parentChildEdgeKeys.has(edgeKey)) {
          continue;
        }
        parentChildEdgeKeys.add(edgeKey);

        edges.push({
          id: `edge-pc-${parentId}-${childId}`,
          source: parentId,
          target: childId,
          type: 'parent_child',
          parentType: rel.parent_type || 'biological',
        });
      } else if (rel.relationship_type === 'spouse') {
        const p1 = rel.person_id;
        const p2 = rel.related_person_id;

        const p1Exists = allPersonIdSet.has(p1);
        const p2Exists = allPersonIdSet.has(p2);

        if (!p1Exists || !p2Exists) {
          if (rejectInvalidReferences) {
            const missingId = !p1Exists ? p1 : p2;
            throw new GraphValidationError(
              `Relationship "${rel.id}" references non-existent person ID: "${missingId}".`
            );
          }
          continue;
        }

        // Omit edges connecting to external lineage persons outside the target tree
        if (!targetPersonIdSet.has(p1) || !targetPersonIdSet.has(p2)) {
          continue;
        }

        if (!personIdMap.has(p1) || !personIdMap.has(p2)) {
          continue;
        }

        const sortedPair = [p1, p2].sort();
        const pairKey = `${sortedPair[0]}<->${sortedPair[1]}`;

        if (spouseEdgePairs.has(pairKey)) {
          continue;
        }
        spouseEdgePairs.add(pairKey);

        edges.push({
          id: `edge-sp-${sortedPair[0]}-${sortedPair[1]}`,
          source: sortedPair[0],
          target: sortedPair[1],
          type: 'spouse',
          parentType: null,
        });
      }
    }

    const graph: FamilyGraph = {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        classifiedCount,
        unclassifiedCount,
        generationCounts,
        generatedAt: new Date().toISOString(),
        includesArchived: includeArchived,
      },
    };

    // Validate graph integrity before delivering
    validateFamilyGraph(graph);

    return graph;
  }

  /**
   * Identifies primary lineage members (Core Bloodline + direct spouses)
   * and maps external surnamed parents who should remain hidden until "View Lineage" is clicked.
   */
  private partitionLineageMembers(
    persons: Array<{ id: string; last_name: string | null; first_name?: string; middle_name?: string | null; gender?: string; is_living?: boolean; birth_date?: string | null; death_date?: string | null; birth_place?: string | null; biography?: string; [key: string]: any }>,
    relationships: Array<{ person_id: string; related_person_id: string; relationship_type: string }>,
    targetLineage: string = 'konukuru'
  ) {
    const normTarget = (targetLineage || 'konukuru').trim().toLowerCase();

    // 1. Core bloodline: Anyone with the primary house surname
    const coreBloodlineIds = new Set<string>();
    for (const p of persons) {
      if (p.last_name && p.last_name.trim().toLowerCase() === normTarget) {
        coreBloodlineIds.add(p.id);
      }
    }

    // Expand bloodline downwards:
    // If target is Konukuru: all biological descendants (e.g. Chandrakala Etigadda, Hemanth Etigadda)
    // If target is Paradarami: direct children of Paradarami parents (Suguna, Rada Galeti)
    let addedDescendants = true;
    while (addedDescendants) {
      addedDescendants = false;
      for (const rel of relationships) {
        if (rel.relationship_type === 'parent') {
          // related_person_id is parent, person_id is child
          if (coreBloodlineIds.has(rel.related_person_id) && !coreBloodlineIds.has(rel.person_id)) {
            if (normTarget === 'paradarami') {
              const parent = persons.find((p) => p.id === rel.related_person_id);
              if (parent && parent.last_name?.trim().toLowerCase() === 'paradarami') {
                coreBloodlineIds.add(rel.person_id);
                addedDescendants = true;
              }
            } else {
              coreBloodlineIds.add(rel.person_id);
              addedDescendants = true;
            }
          }
        }
      }
    }

    // Expand bloodline upwards: any ancestral parents of target house
    let addedAncestors = true;
    while (addedAncestors) {
      addedAncestors = false;
      for (const rel of relationships) {
        if (rel.relationship_type === 'parent') {
          const child = persons.find((p) => p.id === rel.person_id);
          if (child && child.last_name?.trim().toLowerCase() === normTarget && !coreBloodlineIds.has(rel.related_person_id)) {
            const parent = persons.find((p) => p.id === rel.related_person_id);
            if (parent && (!parent.last_name || parent.last_name.trim().toLowerCase() === normTarget)) {
              coreBloodlineIds.add(rel.related_person_id);
              addedAncestors = true;
            }
          }
        }
      }
    }

    // 2. Main tree persons = core bloodline + direct spouses of core bloodline
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

    // 3. Detect external parents (parents of main tree members who are NOT in main tree)
    const externalParentsMap = new Map<string, { father: any; mother: any; lineageName: string; lineageId: string }>();

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
          if (p) {
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
        }

        const lineageId = lineageLastName ? lineageLastName.toLowerCase() : 'external';
        const lineageName = lineageLastName ? `House of ${lineageLastName}` : 'External Ancestry';

        externalParentsMap.set(memberId, { father, mother, lineageName, lineageId });
      }
    }

    return { mainTreePersonIds, externalParentsMap };
  }

  /**
   * Retrieves a single person formatted as a graph node.
   */
  async getFamilyGraphNode(
    personId: string,
    options?: BuildGraphOptions
  ): Promise<FamilyGraphNode | null> {
    const includeArchived = options?.includeArchived ?? false;
    const person = await this.repository.getPersonById(personId);

    if (!person) {
      return null;
    }
    if (person.is_archived && !includeArchived) {
      return null;
    }

    const birthYear = this.generationService.extractBirthYear(person.birth_date);
    const gen = this.generationService.getGenerationByBirthYear(birthYear);

    return {
      id: person.id,
      personId: person.id,
      firstName: person.first_name,
      middleName: person.middle_name ?? null,
      lastName: person.last_name ?? null,
      birthDate: person.birth_date ?? null,
      birthYear,
      generationId: gen ? gen.id : null,
      generationName: gen ? gen.name : null,
      generationOrder: gen ? gen.order : null,
      photoPath: person.profile_photo ?? null,
      isLiving: person.is_living,
      isArchived: person.is_archived,
    };
  }
}
