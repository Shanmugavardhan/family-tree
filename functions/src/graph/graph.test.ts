import * as path from 'path';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as crypto from 'crypto';
import { app } from '../app';
import { GraphService } from './graph.service';
import { validateFamilyGraph, GraphValidationError } from './graph.validator';
import { FamilyRepository } from '../repositories/family.repository';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';

// In-memory repository mock for isolated edge-case unit testing
class MockFamilyRepository implements FamilyRepository {
  private persons: Person[] = [];
  private relationships: Relationship[] = [];
  private version: number = 1;

  constructor(persons: Person[] = [], relationships: Relationship[] = []) {
    this.persons = JSON.parse(JSON.stringify(persons));
    this.relationships = JSON.parse(JSON.stringify(relationships));
  }

  async getAllPersons(includeArchived = false): Promise<Person[]> {
    return includeArchived ? [...this.persons] : this.persons.filter((p) => !p.is_archived);
  }

  async getPersonById(id: string): Promise<Person | null> {
    return this.persons.find((p) => p.id === id) || null;
  }

  async createPerson(person: Person): Promise<Person> {
    this.persons.push(person);
    return person;
  }

  async updatePerson(id: string, updates: Partial<Person>): Promise<Person> {
    const idx = this.persons.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Person not found');
    this.persons[idx] = { ...this.persons[idx], ...updates };
    return this.persons[idx];
  }

  async getAllRelationships(): Promise<Relationship[]> {
    return [...this.relationships];
  }

  async getRelationshipsForPerson(personId: string): Promise<Relationship[]> {
    return this.relationships.filter((r) => r.person_id === personId || r.related_person_id === personId);
  }

  async getRelationshipById(id: string): Promise<Relationship | null> {
    return this.relationships.find((r) => r.id === id) || null;
  }

  async createRelationship(rel: Relationship): Promise<Relationship> {
    this.relationships.push(rel);
    return rel;
  }

  async updateRelationship(id: string, updates: Partial<Relationship>): Promise<Relationship> {
    const idx = this.relationships.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Relationship not found');
    this.relationships[idx] = { ...this.relationships[idx], ...updates };
    return this.relationships[idx];
  }

  async deleteRelationship(id: string): Promise<void> {
    this.relationships = this.relationships.filter((r) => r.id !== id);
  }

  async getVersion(): Promise<number> {
    return this.version;
  }

  async saveFamilyData(
    persons: Person[],
    relationships: Relationship[],
    expectedVersion?: number
  ): Promise<{ version: number }> {
    if (expectedVersion !== undefined && expectedVersion !== this.version) {
      throw new Error('Optimistic concurrency error');
    }
    this.persons = [...persons];
    this.relationships = [...relationships];
    this.version += 1;
    return { version: this.version };
  }
}

export async function runGraphTransformationTests(): Promise<{ passed: number; total: number }> {
  console.log('=== Running Tests for Milestone 3.2 (Chronological Graph Transformation) ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${desc}`);
      process.exit(1);
    }
    passed++;
    console.log(`✓ PASS: ${desc}`);
  }

  const dataDir = path.resolve(__dirname, '../../../data');
  const personsPath = path.join(dataDir, 'persons.json');
  const relsPath = path.join(dataDir, 'relationships.json');

  // Compute hashes of canonical files before running any transformation
  const originalPersonsRaw = await fs.readFile(personsPath, 'utf-8');
  const originalRelsRaw = await fs.readFile(relsPath, 'utf-8');
  const originalPersonsHash = crypto.createHash('sha256').update(originalPersonsRaw).digest('hex');
  const originalRelsHash = crypto.createHash('sha256').update(originalRelsRaw).digest('hex');

  const defaultService = new GraphService();

  // =========================================================================
  // Section 1: Canonical Family Graph Transformation & Node Representation
  // =========================================================================
  console.log('\n--- Section 1: Canonical Family Graph Transformation ---');
  const canonicalGraph = await defaultService.buildFamilyGraph();

  assert(Array.isArray(canonicalGraph.nodes), 'Canonical graph has nodes array');
  assert(Array.isArray(canonicalGraph.edges), 'Canonical graph has edges array');
  assert(canonicalGraph.nodes.length === 14, `Expected exactly 14 nodes, got ${canonicalGraph.nodes.length}`);
  assert(canonicalGraph.edges.length === 21, `Expected exactly 21 edges, got ${canonicalGraph.edges.length}`);
  assert(canonicalGraph.metadata.totalNodes === 14, 'Metadata totalNodes matches 14');
  assert(canonicalGraph.metadata.totalEdges === 21, 'Metadata totalEdges matches 21');
  assert(canonicalGraph.metadata.includesArchived === false, 'Metadata includesArchived is false by default');
  assert(typeof canonicalGraph.metadata.generatedAt === 'string', 'Metadata generatedAt is string');

  // Verify node structure contains only necessary fields
  const sampleNode = canonicalGraph.nodes[0];
  assert(typeof sampleNode.id === 'string' && sampleNode.id === sampleNode.personId, 'Node id matches personId');
  assert(typeof sampleNode.firstName === 'string', 'Node has firstName');
  assert('middleName' in sampleNode, 'Node has middleName field');
  assert('lastName' in sampleNode, 'Node has lastName field');
  assert('birthDate' in sampleNode, 'Node has birthDate field');
  assert('birthYear' in sampleNode, 'Node has birthYear field');
  assert('generationId' in sampleNode, 'Node has generationId field');
  assert('generationName' in sampleNode, 'Node has generationName field');
  assert('generationOrder' in sampleNode, 'Node has generationOrder field');
  assert('photoPath' in sampleNode, 'Node has photoPath field');
  assert(typeof sampleNode.isLiving === 'boolean', 'Node has isLiving boolean');
  assert(typeof sampleNode.isArchived === 'boolean', 'Node has isArchived boolean');

  // =========================================================================
  // Section 2: Generation Cohorts vs Kinship Distance
  // =========================================================================
  console.log('\n--- Section 2: Generation Cohorts & Classifications ---');
  const jagannadham = canonicalGraph.nodes.find((n) => n.firstName === 'Jagannadham');
  assert(!!jagannadham, 'Found Jagannadham node');
  assert(jagannadham?.birthYear === 1972, 'Jagannadham birthYear is 1972');
  assert(jagannadham?.generationId === 'gen_x', 'Jagannadham (1972) classified as gen_x');
  assert(jagannadham?.generationName === 'Generation X', 'Jagannadham generationName is "Generation X"');
  assert(jagannadham?.generationOrder === 3, 'Jagannadham generationOrder is 3');

  const shanmuga = canonicalGraph.nodes.find((n) => n.firstName === 'Shanmuga');
  assert(!!shanmuga, 'Found Shanmuga node');
  assert(shanmuga?.birthYear === 2004, 'Shanmuga birthYear is 2004');
  assert(shanmuga?.generationId === 'gen_z', 'Shanmuga (2004) classified as gen_z');
  assert(shanmuga?.generationName === 'Generation Z', 'Shanmuga generationName is "Generation Z"');
  assert(shanmuga?.generationOrder === 5, 'Shanmuga generationOrder is 5');

  const meghana = canonicalGraph.nodes.find((n) => n.firstName === 'Meghana');
  assert(!!meghana, 'Found Meghana node');
  assert(meghana?.birthYear === 2001, 'Meghana birthYear is 2001');
  assert(meghana?.generationId === 'gen_z', 'Meghana (2001) classified as gen_z');

  // Unknown birth dates
  const murthy = canonicalGraph.nodes.find((n) => n.firstName === 'Murthy');
  assert(!!murthy, 'Found Murthy Chetty node');
  assert(murthy?.birthDate === null, 'Murthy Chetty birthDate is null');
  assert(murthy?.birthYear === null, 'Murthy Chetty birthYear is null');
  assert(murthy?.generationId === null, 'Murthy Chetty generationId is null (unclassified)');
  assert(murthy?.generationName === null, 'Murthy Chetty generationName is null');
  assert(murthy?.generationOrder === null, 'Murthy Chetty generationOrder is null');

  const sarojamma = canonicalGraph.nodes.find((n) => n.firstName === 'Sarojamma');
  assert(!!sarojamma, 'Found Sarojamma node');
  assert(sarojamma?.generationId === null, 'Sarojamma generationId is null');

  assert(canonicalGraph.metadata.classifiedCount === 3, `Classified count is 3 (got ${canonicalGraph.metadata.classifiedCount})`);
  assert(canonicalGraph.metadata.unclassifiedCount === 11, `Unclassified count is 11 (got ${canonicalGraph.metadata.unclassifiedCount})`);
  assert(canonicalGraph.metadata.generationCounts.gen_x === 1, 'Generation count for gen_x is 1');
  assert(canonicalGraph.metadata.generationCounts.gen_z === 2, 'Generation count for gen_z is 2');

  // =========================================================================
  // Section 3: Parent-Child Edge Direction Reversal
  // =========================================================================
  console.log('\n--- Section 3: Parent-Child Edge Direction Reversal ---');
  // Stored in DB: person_id is child (Jagannadham: b19dee44...), related_person_id is parent (Murthy: 867842c1...)
  // Graph edge: source = parent (Murthy), target = child (Jagannadham)
  const murthyId = murthy!.personId;
  const jagannadhamId = jagannadham!.personId;
  const parentChildEdge = canonicalGraph.edges.find(
    (e) => e.source === murthyId && e.target === jagannadhamId
  );
  assert(!!parentChildEdge, 'Found Parent -> Child edge from Murthy to Jagannadham');
  assert(parentChildEdge?.type === 'parent_child', 'Edge type is "parent_child"');
  assert(parentChildEdge?.parentType === 'biological', 'Parent type metadata preserved as "biological"');
  assert(parentChildEdge?.id === `edge-pc-${murthyId}-${jagannadhamId}`, 'Parent-child edge has deterministic ID');

  // Ensure NO reverse edge (Child -> Parent) exists
  const reverseEdge = canonicalGraph.edges.find(
    (e) => e.source === jagannadhamId && e.target === murthyId
  );
  assert(!reverseEdge, 'No reversed Child -> Parent edge exists in visualization graph');

  // =========================================================================
  // Section 4: Spouse Edge Representation and Deduplication
  // =========================================================================
  console.log('\n--- Section 4: Spouse Edge Deduplication ---');
  const sarojammaId = sarojamma!.personId;
  const spouseEdgesForCouple = canonicalGraph.edges.filter(
    (e) =>
      e.type === 'spouse' &&
      ((e.source === murthyId && e.target === sarojammaId) ||
        (e.source === sarojammaId && e.target === murthyId))
  );
  assert(spouseEdgesForCouple.length === 1, `Expected exactly 1 spouse edge for couple, got ${spouseEdgesForCouple.length}`);
  assert(spouseEdgesForCouple[0].parentType === null, 'Spouse edge has parentType null');

  // Verify all 4 married couples in canonical data each have exactly 1 spouse edge
  const allSpouseEdges = canonicalGraph.edges.filter((e) => e.type === 'spouse');
  assert(allSpouseEdges.length === 4, `Expected exactly 4 spouse edges in canonical graph, got ${allSpouseEdges.length}`);

  // =========================================================================
  // Section 5: Structural Graph Validation of Canonical Graph
  // =========================================================================
  console.log('\n--- Section 5: Structural Graph Validation ---');
  let validationErrorThrown = false;
  try {
    validateFamilyGraph(canonicalGraph);
  } catch (err) {
    validationErrorThrown = true;
  }
  assert(!validationErrorThrown, 'Canonical FamilyGraph passed all strict structural validation assertions');

  // =========================================================================
  // Section 6: In-Memory Mock Tests - Uncle and Nephew in Same Cohort
  // =========================================================================
  console.log('\n--- Section 6: Independent Generational Dimension (Uncle & Nephew in Same Cohort) ---');
  const mockPersons: Person[] = [
    {
      id: 'gp-1',
      first_name: 'Grandfather',
      middle_name: null,
      last_name: 'Test',
      alias: null,
      gender: 'male',
      birth_date: '1940-01-01',
      death_date: null,
      birth_place: null,
      death_place: null,
      profile_photo: null,
      biography: '',
      is_living: true,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      archived_at: null,
    },
    {
      id: 'parent-1',
      first_name: 'Father',
      middle_name: null,
      last_name: 'Test',
      alias: null,
      gender: 'male',
      birth_date: '1970-01-01',
      death_date: null,
      birth_place: null,
      death_place: null,
      profile_photo: null,
      biography: '',
      is_living: true,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      archived_at: null,
    },
    {
      id: 'uncle-1',
      first_name: 'Uncle',
      middle_name: null,
      last_name: 'Test',
      alias: null,
      gender: 'male',
      birth_date: '1998-05-10', // Uncle born 1998 (Gen Z)
      death_date: null,
      birth_place: null,
      death_place: null,
      profile_photo: null,
      biography: '',
      is_living: true,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      archived_at: null,
    },
    {
      id: 'nephew-1',
      first_name: 'Nephew',
      middle_name: null,
      last_name: 'Test',
      alias: null,
      gender: 'male',
      birth_date: '2000-08-20', // Nephew born 2000 (Gen Z)
      death_date: null,
      birth_place: null,
      death_place: null,
      profile_photo: null,
      biography: '',
      is_living: true,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      archived_at: null,
    },
  ];

  const mockRels: Relationship[] = [
    // Grandfather -> Father
    {
      id: 'rel-1',
      person_id: 'parent-1',
      related_person_id: 'gp-1',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    // Grandfather -> Uncle
    {
      id: 'rel-2',
      person_id: 'uncle-1',
      related_person_id: 'gp-1',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    // Father -> Nephew
    {
      id: 'rel-3',
      person_id: 'nephew-1',
      related_person_id: 'parent-1',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const mockRepo = new MockFamilyRepository(mockPersons, mockRels);
  const mockService = new GraphService(mockRepo);
  const cohortGraph = await mockService.buildFamilyGraph();

  const uncleNode = cohortGraph.nodes.find((n) => n.id === 'uncle-1');
  const nephewNode = cohortGraph.nodes.find((n) => n.id === 'nephew-1');
  assert(uncleNode?.generationId === 'gen_z', 'Uncle (1998) is Generation Z');
  assert(nephewNode?.generationId === 'gen_z', 'Nephew (2000) is Generation Z');
  assert(
    uncleNode?.generationId === nephewNode?.generationId,
    'Uncle and Nephew share the exact same generation cohort despite genealogical difference'
  );

  // =========================================================================
  // Section 7: Archived Person Behavior & Dangling Edge Prevention
  // =========================================================================
  console.log('\n--- Section 7: Archived Person Filtering & Dangling Edge Prevention ---');
  const archivedPersons: Person[] = [
    {
      ...mockPersons[0],
      id: 'p-active-1',
      first_name: 'Active1',
      is_archived: false,
    },
    {
      ...mockPersons[1],
      id: 'p-archived',
      first_name: 'ArchivedPerson',
      is_archived: true,
      archived_at: '2026-02-01T00:00:00Z',
    },
    {
      ...mockPersons[2],
      id: 'p-active-2',
      first_name: 'Active2',
      is_archived: false,
    },
  ];

  const archivedRels: Relationship[] = [
    // Active1 married to ArchivedPerson
    {
      id: 'rel-arc-1',
      person_id: 'p-active-1',
      related_person_id: 'p-archived',
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    // ArchivedPerson is parent to Active2
    {
      id: 'rel-arc-2',
      person_id: 'p-active-2',
      related_person_id: 'p-archived',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const arcRepo = new MockFamilyRepository(archivedPersons, archivedRels);
  const arcService = new GraphService(arcRepo);

  // 1. Default: exclude archived
  const activeOnlyGraph = await arcService.buildFamilyGraph({ includeArchived: false });
  assert(activeOnlyGraph.nodes.length === 2, 'Archived person excluded by default (2 active nodes)');
  assert(!activeOnlyGraph.nodes.some((n) => n.id === 'p-archived'), 'Archived person not in node list');
  assert(
    activeOnlyGraph.edges.length === 0,
    'Edges referencing archived person safely omitted to prevent dangling references'
  );
  validateFamilyGraph(activeOnlyGraph); // Must not throw dangling edge error

  // 2. Include archived enabled
  const fullGraphWithArchived = await arcService.buildFamilyGraph({ includeArchived: true });
  assert(fullGraphWithArchived.nodes.length === 3, 'Archived person included when includeArchived=true');
  const archivedNode = fullGraphWithArchived.nodes.find((n) => n.id === 'p-archived');
  assert(archivedNode?.isArchived === true, 'Archived node has isArchived=true');
  assert(fullGraphWithArchived.edges.length === 2, 'Incident edges to archived person included');
  validateFamilyGraph(fullGraphWithArchived);

  // =========================================================================
  // Section 8: Multiple Parents and Multiple Spouses Preserved
  // =========================================================================
  console.log('\n--- Section 8: Multiple Parents & Multiple Spouses ---');
  const complexPersons: Person[] = [
    { ...mockPersons[0], id: 'child-c', first_name: 'Child', birth_date: '2010-01-01' },
    { ...mockPersons[0], id: 'bio-father', first_name: 'BioFather', birth_date: '1980-01-01' },
    { ...mockPersons[0], id: 'bio-mother', first_name: 'BioMother', birth_date: '1982-01-01' },
    { ...mockPersons[0], id: 'step-father', first_name: 'StepFather', birth_date: '1981-01-01' },
    { ...mockPersons[0], id: 'spouse-1', first_name: 'Spouse1', birth_date: '1980-05-01' },
    { ...mockPersons[0], id: 'spouse-2', first_name: 'Spouse2', birth_date: '1985-05-01' },
  ];

  const complexRels: Relationship[] = [
    // Multiple parents for child-c
    {
      id: 'rel-p1',
      person_id: 'child-c',
      related_person_id: 'bio-father',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rel-p2',
      person_id: 'child-c',
      related_person_id: 'bio-mother',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rel-p3',
      person_id: 'child-c',
      related_person_id: 'step-father',
      relationship_type: 'parent',
      parent_type: 'step',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    // Multiple spouses for bio-father
    {
      id: 'rel-s1',
      person_id: 'bio-father',
      related_person_id: 'spouse-1',
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rel-s2',
      person_id: 'bio-father',
      related_person_id: 'spouse-2',
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const complexRepo = new MockFamilyRepository(complexPersons, complexRels);
  const complexService = new GraphService(complexRepo);
  const complexGraph = await complexService.buildFamilyGraph();

  const childIncomingEdges = complexGraph.edges.filter(
    (e) => e.target === 'child-c' && e.type === 'parent_child'
  );
  assert(childIncomingEdges.length === 3, `Expected 3 parent-child edges for child with multiple parents, got ${childIncomingEdges.length}`);
  const parentTypes = childIncomingEdges.map((e) => e.parentType).sort();
  assert(
    JSON.stringify(parentTypes) === JSON.stringify(['biological', 'biological', 'step']),
    'Multiple parent types preserved correctly (biological, biological, step)'
  );

  const fatherSpouseEdges = complexGraph.edges.filter(
    (e) => e.type === 'spouse' && (e.source === 'bio-father' || e.target === 'bio-father')
  );
  assert(fatherSpouseEdges.length === 2, `Expected 2 distinct spouse edges for multiple spouses, got ${fatherSpouseEdges.length}`);
  validateFamilyGraph(complexGraph);

  // =========================================================================
  // Section 9: Duplicate Relationships Deduplication
  // =========================================================================
  console.log('\n--- Section 9: Duplicate Relationships Deduplication ---');
  const duplicateRels: Relationship[] = [
    // Duplicate identical parent-child relationship
    {
      id: 'rel-dup-1',
      person_id: 'child-c',
      related_person_id: 'bio-father',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rel-dup-2',
      person_id: 'child-c',
      related_person_id: 'bio-father',
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    // Symmetric duplicate spouse relationship (A -> B and B -> A)
    {
      id: 'rel-dup-s1',
      person_id: 'bio-father',
      related_person_id: 'spouse-1',
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rel-dup-s2',
      person_id: 'spouse-1',
      related_person_id: 'bio-father',
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const dupRepo = new MockFamilyRepository(complexPersons, duplicateRels);
  const dupService = new GraphService(dupRepo);
  const dedupedGraph = await dupService.buildFamilyGraph();

  assert(dedupedGraph.edges.length === 2, `Expected 2 deduplicated edges, got ${dedupedGraph.edges.length}`);
  assert(dedupedGraph.edges.filter((e) => e.type === 'parent_child').length === 1, 'Only 1 parent-child edge created');
  assert(dedupedGraph.edges.filter((e) => e.type === 'spouse').length === 1, 'Only 1 spouse edge created');
  validateFamilyGraph(dedupedGraph);

  // =========================================================================
  // Section 10: Invalid Relationship References Handled Safely
  // =========================================================================
  console.log('\n--- Section 10: Invalid Relationship References Handled Safely ---');
  const invalidRels: Relationship[] = [
    {
      id: 'rel-invalid-1',
      person_id: 'child-c',
      related_person_id: 'ghost-person-id', // Does not exist
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const invalidRepo = new MockFamilyRepository(complexPersons, invalidRels);
  const invalidService = new GraphService(invalidRepo);

  // 1. By default, rejectInvalidReferences throws GraphValidationError safely
  let caughtInvalidError = false;
  try {
    await invalidService.buildFamilyGraph();
  } catch (err: any) {
    caughtInvalidError = true;
    assert(err instanceof GraphValidationError, 'Safe failure throws GraphValidationError');
    assert(err.message.includes('ghost-person-id'), 'Error message identifies non-existent ID');
  }
  assert(caughtInvalidError, 'Graph construction fails safely on invalid relationship reference');

  // 2. With rejectInvalidReferences: false, skips invalid relationship and returns valid graph
  const resilientGraph = await invalidService.buildFamilyGraph({ rejectInvalidReferences: false });
  assert(resilientGraph.edges.length === 0, 'Resilient mode safely omitted invalid reference edge');
  validateFamilyGraph(resilientGraph);

  // =========================================================================
  // Section 11: getFamilyGraphNode Method Assertions
  // =========================================================================
  console.log('\n--- Section 11: getFamilyGraphNode Method Assertions ---');
  const singleNode = await defaultService.getFamilyGraphNode(jagannadhamId);
  assert(singleNode !== null, 'getFamilyGraphNode returned node for Jagannadham');
  assert(singleNode?.personId === jagannadhamId, 'Returned node has correct personId');
  assert(singleNode?.generationId === 'gen_x', 'Returned node has generationId gen_x');

  const unknownNode = await defaultService.getFamilyGraphNode('non-existent-uuid');
  assert(unknownNode === null, 'getFamilyGraphNode returned null for non-existent ID');

  const archivedSingleNode = await arcService.getFamilyGraphNode('p-archived', { includeArchived: false });
  assert(archivedSingleNode === null, 'getFamilyGraphNode returns null for archived person when includeArchived=false');

  const archivedSingleNodeIncluded = await arcService.getFamilyGraphNode('p-archived', { includeArchived: true });
  assert(archivedSingleNodeIncluded !== null && archivedSingleNodeIncluded.isArchived === true, 'getFamilyGraphNode returns archived node when includeArchived=true');

  // =========================================================================
  // Section 12: Graph Validator Direct Integrity Unit Tests
  // =========================================================================
  console.log('\n--- Section 12: Graph Validator Structural Assertions ---');

  // Duplicate node ID
  let thrown = false;
  try {
    validateFamilyGraph({
      nodes: [sampleNode, sampleNode],
      edges: [],
      metadata: { totalNodes: 2, totalEdges: 0, classifiedCount: 0, unclassifiedCount: 2, generationCounts: {}, generatedAt: '', includesArchived: false },
    });
  } catch (err: any) {
    thrown = true;
    assert(err instanceof GraphValidationError, 'Validator rejected duplicate node ID');
  }
  assert(thrown, 'Duplicate node ID threw validation error');

  // Dangling source edge
  thrown = false;
  try {
    validateFamilyGraph({
      nodes: [sampleNode],
      edges: [{ id: 'e1', source: 'non-existent', target: sampleNode.id, type: 'parent_child', parentType: null }],
      metadata: { totalNodes: 1, totalEdges: 1, classifiedCount: 0, unclassifiedCount: 1, generationCounts: {}, generatedAt: '', includesArchived: false },
    });
  } catch (err: any) {
    thrown = true;
    assert(err instanceof GraphValidationError, 'Validator rejected dangling edge source');
  }
  assert(thrown, 'Dangling source edge threw validation error');

  // Dangling target edge
  thrown = false;
  try {
    validateFamilyGraph({
      nodes: [sampleNode],
      edges: [{ id: 'e2', source: sampleNode.id, target: 'non-existent', type: 'parent_child', parentType: null }],
      metadata: { totalNodes: 1, totalEdges: 1, classifiedCount: 0, unclassifiedCount: 1, generationCounts: {}, generatedAt: '', includesArchived: false },
    });
  } catch (err: any) {
    thrown = true;
    assert(err instanceof GraphValidationError, 'Validator rejected dangling edge target');
  }
  assert(thrown, 'Dangling target edge threw validation error');

  // Self-referencing edge
  thrown = false;
  try {
    validateFamilyGraph({
      nodes: [sampleNode],
      edges: [{ id: 'e3', source: sampleNode.id, target: sampleNode.id, type: 'parent_child', parentType: null }],
      metadata: { totalNodes: 1, totalEdges: 1, classifiedCount: 0, unclassifiedCount: 1, generationCounts: {}, generatedAt: '', includesArchived: false },
    });
  } catch (err: any) {
    thrown = true;
    assert(err instanceof GraphValidationError, 'Validator rejected self-referencing edge');
  }
  assert(thrown, 'Self-referencing edge threw validation error');

  // Metadata count mismatch
  thrown = false;
  try {
    validateFamilyGraph({
      nodes: [sampleNode],
      edges: [],
      metadata: { totalNodes: 99, totalEdges: 0, classifiedCount: 0, unclassifiedCount: 1, generationCounts: {}, generatedAt: '', includesArchived: false },
    });
  } catch (err: any) {
    thrown = true;
    assert(err instanceof GraphValidationError, 'Validator rejected metadata totalNodes mismatch');
  }
  assert(thrown, 'Metadata count mismatch threw validation error');

  // =========================================================================
  // Section 13: Immutability / Non-Mutation of Canonical Database Files
  // =========================================================================
  console.log('\n--- Section 13: Immutability & File Non-Mutation Check ---');
  const postPersonsRaw = await fs.readFile(personsPath, 'utf-8');
  const postRelsRaw = await fs.readFile(relsPath, 'utf-8');
  const postPersonsHash = crypto.createHash('sha256').update(postPersonsRaw).digest('hex');
  const postRelsHash = crypto.createHash('sha256').update(postRelsRaw).digest('hex');

  assert(postPersonsHash === originalPersonsHash, 'data/persons.json was NOT mutated (hash unchanged)');
  assert(postRelsHash === originalRelsHash, 'data/relationships.json was NOT mutated (hash unchanged)');
  assert(postPersonsRaw === originalPersonsRaw, 'data/persons.json content exactly matches');
  assert(postRelsRaw === originalRelsRaw, 'data/relationships.json content exactly matches');

  // =========================================================================
  // Section 14: HTTP API Endpoint Integration
  // =========================================================================
  console.log('\n--- Section 14: HTTP API Endpoint Integration ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. GET /api/graph
    const resGraph = await fetch(`${baseUrl}/api/graph`);
    assert(resGraph.status === 200, 'GET /api/graph returns HTTP 200');
    const jsonGraph: any = await resGraph.json();
    assert(jsonGraph.success === true, 'Response envelope has success: true');
    assert(jsonGraph.data.nodes.length === 14, 'API returned 14 canonical nodes');
    assert(jsonGraph.data.edges.length === 21, 'API returned 21 canonical edges');
    assert(jsonGraph.error === null, 'Response error is null');

    // 2. GET /api/graph?includeArchived=true
    const resArc = await fetch(`${baseUrl}/api/graph?includeArchived=true`);
    assert(resArc.status === 200, 'GET /api/graph?includeArchived=true returns HTTP 200');
    const jsonArc: any = await resArc.json();
    assert(jsonArc.data.metadata.includesArchived === true, 'API metadata includesArchived is true');

    // 3. GET /api/graph/nodes/:personId
    const resNode = await fetch(`${baseUrl}/api/graph/nodes/${jagannadhamId}`);
    assert(resNode.status === 200, `GET /api/graph/nodes/${jagannadhamId} returns HTTP 200`);
    const jsonNode: any = await resNode.json();
    assert(jsonNode.success === true, 'Node response success is true');
    assert(jsonNode.data.id === jagannadhamId, 'Node response has correct person ID');
    assert(jsonNode.data.generationId === 'gen_x', 'Node response has generationId "gen_x"');

    // 4. GET /api/graph/nodes/non-existent
    const res404 = await fetch(`${baseUrl}/api/graph/nodes/00000000-0000-0000-0000-000000000000`);
    assert(res404.status === 404, 'GET /api/graph/nodes/non-existent returns HTTP 404');
    const json404: any = await res404.json();
    assert(json404.success === false, '404 response has success: false');
    assert(json404.error.code === 'PERSON_NOT_FOUND', '404 error code is PERSON_NOT_FOUND');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n🎉 All ${passed}/${total} assertions for Milestone 3.2 PASSED!`);
  return { passed, total };
}

// Direct execution when run directly via tsx
if (require.main === module) {
  runGraphTransformationTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
