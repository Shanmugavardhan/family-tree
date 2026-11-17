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

    const personIdMap = new Map<string, (typeof includedPersons)[0]>();
    for (const p of includedPersons) {
      personIdMap.set(p.id, p);
    }

    // 1. Build Nodes
    const generationCounts: Record<string, number> = {};
    let classifiedCount = 0;
    let unclassifiedCount = 0;

    const nodes: FamilyGraphNode[] = includedPersons.map((person) => {
      const birthYear = this.generationService.extractBirthYear(person.birth_date);
      const gen = this.generationService.getGenerationByBirthYear(birthYear);

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
      };
    });

    // 2. Build Edges
    const edges: FamilyGraphEdge[] = [];
    const parentChildEdgeKeys = new Set<string>();
    const spouseEdgePairs = new Set<string>();

    for (const rel of allRels) {
      if (rel.relationship_type === 'parent') {
        // Stored: person_id is child, related_person_id is parent
        // Visualization: source = Parent, target = Child
        const parentId = rel.related_person_id;
        const childId = rel.person_id;

        // Check if referenced persons exist at all in database
        const parentExists = allPersonIdSet.has(parentId);
        const childExists = allPersonIdSet.has(childId);

        if (!parentExists || !childExists) {
          if (rejectInvalidReferences) {
            const missingId = !parentExists ? parentId : childId;
            throw new GraphValidationError(
              `Relationship "${rel.id}" references non-existent person ID: "${missingId}".`
            );
          }
          continue; // Skip invalid edge safely if rejectInvalidReferences=false
        }

        // If either parent or child is archived and not included in current view, omit edge
        if (!personIdMap.has(parentId) || !personIdMap.has(childId)) {
          continue;
        }

        const edgeKey = `${parentId}->${childId}`;
        if (parentChildEdgeKeys.has(edgeKey)) {
          continue; // Prevent duplicates
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

        // Check if referenced persons exist at all in database
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

        // If either spouse is archived and not included in current view, omit edge
        if (!personIdMap.has(p1) || !personIdMap.has(p2)) {
          continue;
        }

        // Normalize symmetrically: sort IDs so [A, B] and [B, A] map to one edge
        const sortedPair = [p1, p2].sort();
        const pairKey = `${sortedPair[0]}<->${sortedPair[1]}`;

        if (spouseEdgePairs.has(pairKey)) {
          continue; // Prevent duplicate edge for the same couple
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
