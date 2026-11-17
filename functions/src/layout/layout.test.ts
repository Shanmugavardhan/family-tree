import * as path from 'path';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as crypto from 'crypto';
import { app } from '../app';
import { LayoutService } from './layout.service';
import { validateFamilyLayout, LayoutValidationError } from './layout.validator';
import { FamilyGraph, FamilyGraphNode, FamilyGraphEdge } from '../graph/graph.types';
import { FamilyLayout } from './layout.types';

export async function runLayoutEngineTests(): Promise<{ passed: number; total: number }> {
  console.log('=== Running Tests for Milestone 3.3 (Chronological Layout Engine) ===\n');
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

  // Verify non-mutation baseline hashes
  const origPersonsRaw = await fs.readFile(personsPath, 'utf-8');
  const origRelsRaw = await fs.readFile(relsPath, 'utf-8');
  const origPersonsHash = crypto.createHash('sha256').update(origPersonsRaw).digest('hex');
  const origRelsHash = crypto.createHash('sha256').update(origRelsRaw).digest('hex');

  const layoutService = new LayoutService();

  // =========================================================================
  // Section 1: Canonical Family Tree Layout Verification
  // =========================================================================
  console.log('\n--- Section 1: Canonical Family Tree Layout Verification ---');
  const canonicalLayout = await layoutService.getFamilyLayout();

  assert(Array.isArray(canonicalLayout.nodes), 'Layout has nodes array');
  assert(Array.isArray(canonicalLayout.edges), 'Layout has edges array');
  assert(canonicalLayout.nodes.length === 14, `Expected 14 canonical nodes, got ${canonicalLayout.nodes.length}`);
  assert(canonicalLayout.edges.length === 21, `Expected 21 canonical edges, got ${canonicalLayout.edges.length}`);
  assert(canonicalLayout.lanes.length > 0, 'Layout contains defined cohort lanes');
  assert(canonicalLayout.width >= 1200, `Layout width (${canonicalLayout.width}) is at least minCanvasWidth (1200)`);
  assert(canonicalLayout.height >= 800, `Layout height (${canonicalLayout.height}) is at least minCanvasHeight (800)`);

  // =========================================================================
  // Section 2: Same Cohort Fixed Y & Different Cohorts Distinct Y
  // =========================================================================
  console.log('\n--- Section 2: Cohort Lane Fixed Y Coordinates ---');
  const jagannadham = canonicalLayout.nodes.find((n) => n.firstName === 'Jagannadham');
  const shanmuga = canonicalLayout.nodes.find((n) => n.firstName === 'Shanmuga');
  const meghana = canonicalLayout.nodes.find((n) => n.firstName === 'Meghana');
  const murthy = canonicalLayout.nodes.find((n) => n.firstName === 'Murthy');
  const sarojamma = canonicalLayout.nodes.find((n) => n.firstName === 'Sarojamma');

  assert(!!jagannadham && !!shanmuga && !!meghana && !!murthy && !!sarojamma, 'Found all key canonical nodes');

  // Same cohort (Gen Z) has identical Y
  assert(shanmuga?.generationOrder === 5, 'Shanmuga is in generation order 5 (Gen Z)');
  assert(meghana?.generationOrder === 5, 'Meghana is in generation order 5 (Gen Z)');
  assert(shanmuga?.y === meghana?.y, `Same cohort nodes receive identical Y coordinate (${shanmuga?.y})`);

  // Same cohort (Unknown) has identical Y
  assert(murthy?.generationOrder === null, 'Murthy generationOrder is null (Unknown)');
  assert(sarojamma?.generationOrder === null, 'Sarojamma generationOrder is null (Unknown)');
  assert(murthy?.y === sarojamma?.y, `Unknown birth date nodes receive identical Y coordinate (${murthy?.y})`);

  // Different cohorts have distinct Y coordinates
  assert(jagannadham?.generationOrder === 3, 'Jagannadham is in generation order 3 (Gen X)');
  assert(jagannadham?.y !== shanmuga?.y, 'Gen X and Gen Z receive different Y coordinates');
  assert(jagannadham?.y !== murthy?.y, 'Gen X and Unknown receive different Y coordinates');
  assert(shanmuga?.y !== murthy?.y, 'Gen Z and Unknown receive different Y coordinates');

  // Verify chronological Y order: Gen X Y < Gen Z Y < Unknown Y
  assert(jagannadham!.y < shanmuga!.y, 'Gen X (Order 3) appears vertically above Gen Z (Order 5)');
  assert(shanmuga!.y < murthy!.y, 'Gen Z appears vertically above Unknown lane at bottom');

  // =========================================================================
  // Section 3: No Overlap within Any Cohort
  // =========================================================================
  console.log('\n--- Section 3: Non-Overlapping Person Cards Guarantee ---');
  // Check pairwise bounding box collisions for canonical layout
  const nodesByCohort = new Map<number | null, typeof canonicalLayout.nodes>();
  for (const n of canonicalLayout.nodes) {
    const key = n.generationOrder;
    if (!nodesByCohort.has(key)) nodesByCohort.set(key, []);
    nodesByCohort.get(key)!.push(n);
  }

  let canonicalOverlapFound = false;
  for (const [cohort, nodes] of nodesByCohort.entries()) {
    const sorted = [...nodes].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.x + a.width > b.x) {
        canonicalOverlapFound = true;
        console.error(`Overlap in cohort ${cohort}: ${a.firstName} (ends ${a.x + a.width}) and ${b.firstName} (starts ${b.x})`);
      }
    }
  }
  assert(!canonicalOverlapFound, 'Zero overlaps detected across all cohorts in canonical layout');

  // =========================================================================
  // Section 4: Deterministic Placement
  // =========================================================================
  console.log('\n--- Section 4: Deterministic Placement Guarantee ---');
  const secondLayout = await layoutService.getFamilyLayout();
  assert(canonicalLayout.nodes.length === secondLayout.nodes.length, 'Node count identical across multiple runs');

  let deterministicMismatch = false;
  for (let i = 0; i < canonicalLayout.nodes.length; i++) {
    const n1 = canonicalLayout.nodes[i];
    const n2 = secondLayout.nodes.find((n) => n.id === n1.id);
    if (!n2 || n1.x !== n2.x || n1.y !== n2.y) {
      deterministicMismatch = true;
      break;
    }
  }
  assert(!deterministicMismatch, 'Same graph produces 100% identical (x, y) coordinates');

  // =========================================================================
  // Section 5: Complex Family Features (Multiple Spouses & Multiple Parents)
  // =========================================================================
  console.log('\n--- Section 5: Multiple Spouses & Multiple Parents Handling ---');
  const complexGraph: FamilyGraph = {
    nodes: [
      {
        id: 'father-1',
        personId: 'father-1',
        firstName: 'Father',
        middleName: null,
        lastName: 'Test',
        birthDate: '1970-01-01',
        birthYear: 1970,
        generationId: 'gen_x',
        generationName: 'Generation X',
        generationOrder: 3,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'mother-1',
        personId: 'mother-1',
        firstName: 'Mother',
        middleName: null,
        lastName: 'Test',
        birthDate: '1972-01-01',
        birthYear: 1972,
        generationId: 'gen_x',
        generationName: 'Generation X',
        generationOrder: 3,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'stepfather-1',
        personId: 'stepfather-1',
        firstName: 'Stepfather',
        middleName: null,
        lastName: 'Test',
        birthDate: '1971-01-01',
        birthYear: 1971,
        generationId: 'gen_x',
        generationName: 'Generation X',
        generationOrder: 3,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'spouse2-of-father',
        personId: 'spouse2-of-father',
        firstName: 'SecondWife',
        middleName: null,
        lastName: 'Test',
        birthDate: '1975-01-01',
        birthYear: 1975,
        generationId: 'gen_x',
        generationName: 'Generation X',
        generationOrder: 3,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'child-1',
        personId: 'child-1',
        firstName: 'Child',
        middleName: null,
        lastName: 'Test',
        birthDate: '2002-01-01',
        birthYear: 2002,
        generationId: 'gen_z',
        generationName: 'Generation Z',
        generationOrder: 5,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
    ],
    edges: [
      // Multiple parents to child-1
      { id: 'e-p1', source: 'father-1', target: 'child-1', type: 'parent_child', parentType: 'biological' },
      { id: 'e-p2', source: 'mother-1', target: 'child-1', type: 'parent_child', parentType: 'biological' },
      { id: 'e-p3', source: 'stepfather-1', target: 'child-1', type: 'parent_child', parentType: 'step' },
      // Multiple spouses for father-1
      { id: 'e-sp1', source: 'father-1', target: 'mother-1', type: 'spouse', parentType: null },
      { id: 'e-sp2', source: 'father-1', target: 'spouse2-of-father', type: 'spouse', parentType: null },
    ],
    metadata: {
      totalNodes: 5,
      totalEdges: 5,
      classifiedCount: 5,
      unclassifiedCount: 0,
      generationCounts: { gen_x: 4, gen_z: 1 },
      generatedAt: new Date().toISOString(),
      includesArchived: false,
    },
  };

  const complexLayout = layoutService.calculateLayout(complexGraph);
  assert(complexLayout.nodes.length === 5, 'All 5 nodes placed in complex family layout');
  assert(complexLayout.edges.length === 5, 'All 5 edges preserved in complex family layout');

  // Verify all 4 Gen X people have identical Y and no overlap
  const genXNodes = complexLayout.nodes.filter((n) => n.generationOrder === 3);
  assert(genXNodes.length === 4, 'All 4 Gen X parents/spouses present');
  const genXY = genXNodes[0].y;
  assert(genXNodes.every((n) => n.y === genXY), 'All Gen X nodes share exact same Y coordinate');

  // Check no overlap among multiple spouses/parents
  const sortedGenX = [...genXNodes].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sortedGenX.length - 1; i++) {
    const nA = sortedGenX[i];
    const nB = sortedGenX[i + 1];
    assert(nA.x + nA.width <= nB.x, `No overlap between ${nA.firstName} and ${nB.firstName}`);
  }

  // Verify child in Gen Z has distinct Y
  const childNode = complexLayout.nodes.find((n) => n.id === 'child-1');
  assert(childNode?.y !== genXY, 'Child in Gen Z has distinct Y from parents in Gen X');
  validateFamilyLayout(complexLayout);

  // =========================================================================
  // Section 6: Uncle and Nephew in Same Cohort (Generational Independence)
  // =========================================================================
  console.log('\n--- Section 6: Uncle and Nephew in Same Cohort ---');
  const uncleNephewGraph: FamilyGraph = {
    nodes: [
      {
        id: 'grandfather',
        personId: 'grandfather',
        firstName: 'Grandfather',
        middleName: null,
        lastName: 'Test',
        birthDate: '1940-01-01',
        birthYear: 1940,
        generationId: 'silent',
        generationName: 'Silent Generation',
        generationOrder: 1,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'father-genx',
        personId: 'father-genx',
        firstName: 'Father',
        middleName: null,
        lastName: 'Test',
        birthDate: '1970-01-01',
        birthYear: 1970,
        generationId: 'gen_x',
        generationName: 'Generation X',
        generationOrder: 3,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'uncle-genz',
        personId: 'uncle-genz',
        firstName: 'Uncle',
        middleName: null,
        lastName: 'Test',
        birthDate: '1998-01-01',
        birthYear: 1998,
        generationId: 'gen_z',
        generationName: 'Generation Z',
        generationOrder: 5,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
      {
        id: 'nephew-genz',
        personId: 'nephew-genz',
        firstName: 'Nephew',
        middleName: null,
        lastName: 'Test',
        birthDate: '2000-01-01',
        birthYear: 2000,
        generationId: 'gen_z',
        generationName: 'Generation Z',
        generationOrder: 5,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      },
    ],
    edges: [
      { id: 'e1', source: 'grandfather', target: 'father-genx', type: 'parent_child', parentType: 'biological' },
      { id: 'e2', source: 'grandfather', target: 'uncle-genz', type: 'parent_child', parentType: 'biological' },
      { id: 'e3', source: 'father-genx', target: 'nephew-genz', type: 'parent_child', parentType: 'biological' },
    ],
    metadata: {
      totalNodes: 4,
      totalEdges: 3,
      classifiedCount: 4,
      unclassifiedCount: 0,
      generationCounts: { silent: 1, gen_x: 1, gen_z: 2 },
      generatedAt: new Date().toISOString(),
      includesArchived: false,
    },
  };

  const unLayout = layoutService.calculateLayout(uncleNephewGraph);
  const uncleN = unLayout.nodes.find((n) => n.id === 'uncle-genz');
  const nephewN = unLayout.nodes.find((n) => n.id === 'nephew-genz');
  assert(uncleN?.y === nephewN?.y, 'Uncle and Nephew share the exact same Y coordinate in Gen Z lane');
  assert(Math.abs(uncleN!.x - nephewN!.x) >= 220 + 30, 'Uncle and Nephew have distinct non-overlapping X coordinates');
  validateFamilyLayout(unLayout);

  // =========================================================================
  // Section 7: Large Graph Performance Stress Tests (500 and 1,000 People)
  // =========================================================================
  console.log('\n--- Section 7: Large Graph Performance Testing (500 & 1,000 Nodes) ---');

  function generateSyntheticGraph(totalCount: number): FamilyGraph {
    const nodes: FamilyGraphNode[] = [];
    const edges: FamilyGraphEdge[] = [];
    const generationOrders = [1, 2, 3, 4, 5, 6, 7, null];

    for (let i = 0; i < totalCount; i++) {
      const order = generationOrders[i % generationOrders.length];
      const birthYear = order !== null ? 1930 + order * 12 + (i % 8) : null;
      nodes.push({
        id: `node-${i}`,
        personId: `node-${i}`,
        firstName: `Person${i}`,
        middleName: null,
        lastName: `Family${Math.floor(i / 10)}`,
        birthDate: birthYear ? `${birthYear}-05-15` : null,
        birthYear,
        generationId: order !== null ? `gen_${order}` : null,
        generationName: order !== null ? `Gen ${order}` : null,
        generationOrder: order,
        photoPath: null,
        isLiving: true,
        isArchived: false,
      });

      // Generate realistic parent-child and spouse connections
      if (i > 0 && i % 2 === 0) {
        // Parent-child connection to previous generation
        const parentId = `node-${Math.max(0, i - 10)}`;
        edges.push({
          id: `edge-pc-${parentId}-node-${i}`,
          source: parentId,
          target: `node-${i}`,
          type: 'parent_child',
          parentType: 'biological',
        });
      }
      if (i % 5 === 0 && i + 1 < totalCount) {
        // Spouse connection within same bucket
        edges.push({
          id: `edge-sp-node-${i}-node-${i + 1}`,
          source: `node-${i}`,
          target: `node-${i + 1}`,
          type: 'spouse',
          parentType: null,
        });
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        classifiedCount: nodes.filter((n) => n.generationOrder !== null).length,
        unclassifiedCount: nodes.filter((n) => n.generationOrder === null).length,
        generationCounts: {},
        generatedAt: new Date().toISOString(),
        includesArchived: false,
      },
    };
  }

  // 1. 500-person graph
  const graph500 = generateSyntheticGraph(500);
  const start500 = Date.now();
  const layout500 = layoutService.calculateLayout(graph500);
  const time500 = Date.now() - start500;

  assert(layout500.nodes.length === 500, `All 500 nodes placed in output (got ${layout500.nodes.length})`);
  assert(layout500.edges.length === graph500.edges.length, `All ${graph500.edges.length} edges preserved`);
  assert(time500 < 1000, `500-person layout calculated rapidly in ${time500} ms (< 1000 ms threshold)`);
  validateFamilyLayout(layout500);
  console.log(`✓ PASS: 500-person layout validated successfully in ${time500} ms with zero overlaps`);

  // 2. 1,000-person graph
  const graph1000 = generateSyntheticGraph(1000);
  const start1000 = Date.now();
  const layout1000 = layoutService.calculateLayout(graph1000);
  const time1000 = Date.now() - start1000;

  assert(layout1000.nodes.length === 1000, `All 1,000 nodes placed in output (got ${layout1000.nodes.length})`);
  assert(layout1000.edges.length === graph1000.edges.length, `All ${graph1000.edges.length} edges preserved`);
  assert(time1000 < 2000, `1,000-person layout calculated rapidly in ${time1000} ms (< 2000 ms threshold)`);
  validateFamilyLayout(layout1000);
  console.log(`✓ PASS: 1,000-person layout validated successfully in ${time1000} ms with zero overlaps`);

  // =========================================================================
  // Section 8: Layout Validator Direct Invariant Checks
  // =========================================================================
  console.log('\n--- Section 8: Layout Validator Direct Invariant Checks ---');

  // Overlap detection
  let caught = false;
  try {
    const invalidLayout: FamilyLayout = {
      ...canonicalLayout,
      nodes: [
        { id: 'a', x: 100, y: 100, width: 200, height: 100, generationId: 'g1', generationOrder: 1 },
        { id: 'b', x: 250, y: 100, width: 200, height: 100, generationId: 'g1', generationOrder: 1 }, // Overlaps: 100+200=300 > 250!
      ],
      edges: [],
    };
    validateFamilyLayout(invalidLayout);
  } catch (err: any) {
    caught = true;
    assert(err instanceof LayoutValidationError, 'Validator rejected overlapping cards in same cohort');
  }
  assert(caught, 'Overlapping nodes threw LayoutValidationError');

  // Mismatched cohort Y
  caught = false;
  try {
    const invalidCohortYLayout: FamilyLayout = {
      ...canonicalLayout,
      nodes: [
        { id: 'a', x: 100, y: 100, width: 200, height: 100, generationId: 'g1', generationOrder: 1 },
        { id: 'b', x: 400, y: 150, width: 200, height: 100, generationId: 'g1', generationOrder: 1 }, // Different Y in same cohort!
      ],
      edges: [],
    };
    validateFamilyLayout(invalidCohortYLayout);
  } catch (err: any) {
    caught = true;
    assert(err instanceof LayoutValidationError, 'Validator rejected mismatched Y within same cohort');
  }
  assert(caught, 'Mismatched cohort Y threw LayoutValidationError');

  // Different cohorts sharing same Y
  caught = false;
  try {
    const sharedYLayout: FamilyLayout = {
      ...canonicalLayout,
      nodes: [
        { id: 'a', x: 100, y: 200, width: 200, height: 100, generationId: 'g1', generationOrder: 1 },
        { id: 'b', x: 400, y: 200, width: 200, height: 100, generationId: 'g2', generationOrder: 2 }, // Different cohort sharing same Y!
      ],
      edges: [],
    };
    validateFamilyLayout(sharedYLayout);
  } catch (err: any) {
    caught = true;
    assert(err instanceof LayoutValidationError, 'Validator rejected distinct cohorts sharing same Y');
  }
  assert(caught, 'Distinct cohorts sharing same Y threw LayoutValidationError');

  // =========================================================================
  // Section 9: Immutability / Non-Mutation of Database Records
  // =========================================================================
  console.log('\n--- Section 9: Database Immutability Check ---');
  const postPersonsRaw = await fs.readFile(personsPath, 'utf-8');
  const postRelsRaw = await fs.readFile(relsPath, 'utf-8');
  const postPersonsHash = crypto.createHash('sha256').update(postPersonsRaw).digest('hex');
  const postRelsHash = crypto.createHash('sha256').update(postRelsRaw).digest('hex');

  assert(postPersonsHash === origPersonsHash, 'data/persons.json was NOT mutated (hash unchanged)');
  assert(postRelsHash === origRelsHash, 'data/relationships.json was NOT mutated (hash unchanged)');
  assert(postPersonsRaw === origPersonsRaw, 'data/persons.json content matches byte-for-byte');
  assert(postRelsRaw === origRelsRaw, 'data/relationships.json content matches byte-for-byte');

  // =========================================================================
  // Section 10: HTTP API Endpoint Integration (/api/layout)
  // =========================================================================
  console.log('\n--- Section 10: HTTP API Endpoint Integration ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. GET /api/layout
    const resLayout = await fetch(`${baseUrl}/api/layout`);
    assert(resLayout.status === 200, 'GET /api/layout returns HTTP 200');
    const jsonLayout: any = await resLayout.json();
    assert(jsonLayout.success === true, 'Response envelope has success: true');
    assert(jsonLayout.data.nodes.length === 14, 'API layout returns 14 canonical nodes');
    assert(jsonLayout.data.edges.length === 21, 'API layout returns 21 canonical edges');
    assert(jsonLayout.error === null, 'Response error is null');

    // 2. GET /api/layout?compactLanes=true
    const resCompact = await fetch(`${baseUrl}/api/layout?compactLanes=true`);
    assert(resCompact.status === 200, 'GET /api/layout?compactLanes=true returns HTTP 200');
    const jsonCompact: any = await resCompact.json();
    assert(jsonCompact.data.lanes.length <= jsonLayout.data.lanes.length, 'Compact lanes returned compacted lane list');

    // 3. GET /api/layout?nodeWidth=250&nodeHeight=120
    const resCustom = await fetch(`${baseUrl}/api/layout?nodeWidth=250&nodeHeight=120`);
    assert(resCustom.status === 200, 'GET /api/layout with custom dimensions returns HTTP 200');
    const jsonCustom: any = await resCustom.json();
    assert(jsonCustom.data.nodes[0].width === 250, 'Custom nodeWidth respected in output');
    assert(jsonCustom.data.nodes[0].height === 120, 'Custom nodeHeight respected in output');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log(`\n🎉 All ${passed}/${total} assertions for Milestone 3.3 PASSED!`);
  return { passed, total };
}

// Direct execution when run directly via tsx
if (require.main === module) {
  runLayoutEngineTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
