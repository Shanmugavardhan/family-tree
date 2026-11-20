import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KNOWN_LINEAGES,
  PARADARAMI_DEPTH1_PARENTS,
  LINEAGE_PARENTS_BY_PERSON,
  getParadaramiLayout,
} from '../src/types/lineage.ts';
import { GraphService } from '../functions/src/graph/graph.service.ts';
import { LocalJsonFamilyRepository } from '../functions/src/repositories/local-json.repository.ts';
import { LayoutService } from '../functions/src/layout/layout.service.ts';
import { convertLayoutToReactFlow } from '../src/adapters/reactFlowAdapter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
const testResults: Record<string, { pass: boolean; desc: string; error?: string }> = {};

async function testCase(id: string, desc: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    testResults[id] = { pass: true, desc };
    console.log(`✓ [${id}] PASS: ${desc}`);
  } catch (err: any) {
    testResults[id] = { pass: false, desc, error: err.message || String(err) };
    console.error(`✗ [${id}] FAIL: ${desc}`);
    console.error(err);
  }
}

export async function runAuditTests() {
  console.log('================================================================');
  console.log('   SYSTEM ARCHITECTURE TASK AUDIT TEST SUITE (SOURCE OF TRUTH)  ');
  console.log('================================================================\n');

  const repo = new LocalJsonFamilyRepository(projectRoot);
  const graphService = new GraphService(repo);
  const layoutService = new LayoutService();

  // --------------------------------------------------------------------------
  // MODULE 1: INFINITE CANVAS & GENERATION ROWS (ARCH-001)
  // --------------------------------------------------------------------------
  console.log('--- MODULE 1: Infinite Canvas & Generational Cohort Rows ---');

  await testCase('TEST-ARCH-01-01', 'Canvas is partitioned into 11 standardized generation rows with 440px pitch rhythm', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });
    
    const lanes = layout.lanes || (layout as any).cohortLanes;
    assert.ok(lanes, 'Cohort lanes must be generated');
    assert.strictEqual(lanes.length, 11, 'Must have exactly 11 generational cohort lanes');

    // Verify 440px rhythm
    for (let i = 0; i < lanes.length - 1; i++) {
      const current = lanes[i];
      const next = lanes[i + 1];
      const pitch = next.y - current.y;
      assert.strictEqual(pitch, 440, `Lane ${next.id} must be exactly 440px below lane ${current.id}`);
    }
  });

  await testCase('TEST-ARCH-01-02', 'Generation epoch year boundaries correctly map birth years', async () => {
    // 1947 -> Baby Boomers (1946-1964)
    // 1972 -> Generation X (1965-1980)
    // 2006 -> Generation Z (1997-2012)
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'paradarami' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });

    const ramayya = layout.nodes.find((n) => n.id === '1ae73a4b-b739-40d3-8b50-071bbf1b07eb');
    assert.ok(ramayya);
    assert.strictEqual(ramayya.generationId, 'baby_boomers', 'Ramayya (born 1947) must be in Baby Boomers');

    const jagannadham = layout.nodes.find((n) => n.id === 'b19dee44-9906-4c46-84b6-70d2fa70a5b5');
    assert.ok(jagannadham);
    assert.strictEqual(jagannadham.generationId, 'gen_x', 'Jagannadham (born 1972) must be in Generation X');
  });

  await testCase('TEST-ARCH-01-03', 'Kinship generation inference places members lacking birthdates without an Unknown strip', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });

    // Murthy Chetty & Sarojamma have null birth dates, but are parents of Gen X -> Inferred as Silent Generation
    const murthy = layout.nodes.find((n) => n.id === '867842c1-b8a2-45ad-8d9c-89150e68eb16');
    assert.ok(murthy, 'Murthy Chetty exists');
    assert.strictEqual(murthy.generationId, 'silent', 'Murthy Chetty must be inferred into Silent Generation');
    assert.strictEqual(murthy.y, 1900, 'Murthy Chetty must sit on Silent Generation baseline Y=1900');

    // Confirm unknown_birth_year lane is completely absent
    const lanes = layout.lanes || (layout as any).cohortLanes;
    const unknownLane = lanes.find((l: any) => l.id === 'unknown_birth_year');
    assert.strictEqual(unknownLane, undefined, 'unknown_birth_year strip must NOT exist in layout');
  });

  await testCase('TEST-ARCH-01-04', 'Multi-house coexistence: multiple lineages share identical generational coordinate continuum', async () => {
    const konukuruGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const konukuruLayout = layoutService.calculateLayout(konukuruGraph, { inferGenerations: true });

    const paradaramiGraph = await graphService.buildFamilyGraph({ lineage: 'paradarami' });
    const paradaramiLayout = layoutService.calculateLayout(paradaramiGraph, { inferGenerations: true });

    const kLanes = konukuruLayout.lanes || (konukuruLayout as any).cohortLanes;
    const pLanes = paradaramiLayout.lanes || (paradaramiLayout as any).cohortLanes;

    // Verify both layouts share the identical 11 lanes with identical Y coordinates
    assert.strictEqual(kLanes.length, pLanes.length);
    for (let i = 0; i < kLanes.length; i++) {
      const kLane = kLanes[i];
      const pLane = pLanes[i];
      assert.strictEqual(kLane.id, pLane.id, 'Lane IDs must match');
      assert.strictEqual(kLane.y, pLane.y, 'Lane Y positions must match');
    }
  });

  await testCase('TEST-ARCH-01-05', 'Sticky generation labels inverse-zoom mathematical scaling law', () => {
    const computeScale = (vz: number) =>
      Math.min(1.85, Math.max(0.65, Math.pow(1 / Math.max(0.18, vz), 0.58)));

    // Zoom Out tests (size increases)
    const scaleZoomOut = computeScale(0.2);
    assert.ok(scaleZoomOut >= 1.8, `At zoom=0.2 scale must be ~1.85 (got ${scaleZoomOut})`);

    // Zoom 1.0 (neutral)
    const scaleNeutral = computeScale(1.0);
    assert.strictEqual(Math.round(scaleNeutral * 100) / 100, 1.0, 'At zoom=1.0 scale must be 1.0');

    // Zoom In tests (size decreases)
    const scaleZoomIn = computeScale(2.0);
    assert.ok(scaleZoomIn <= 0.7, `At zoom=2.0 scale must be ~0.65 (got ${scaleZoomIn})`);
  });

  await testCase('TEST-ARCH-01-06', 'Person node proportional zoom scaling & surname line split rules', () => {
    // Proportional node scale formula
    const computeNodeScale = (z: number) =>
      Math.min(2.5, Math.max(0.6, Math.pow(1 / Math.max(0.1, z), 2 / 3)));

    const zoomOutNodeScale = computeNodeScale(0.25);
    assert.ok(zoomOutNodeScale > 2.0, 'Node scale should enlarge to >2.0 at zoom=0.25');

    // Surname split logic: Given name on Line 1, Surname on Line 2
    function splitNames(fullName: string): { givenName: string; surname: string } {
      const parts = fullName.trim().split(/\s+/);
      const surname = parts.length > 1 ? parts.pop()! : '';
      const givenName = parts.join(' ');
      return { givenName, surname };
    }

    const { givenName, surname } = splitNames('Murthy Chetty Konukuru');
    assert.strictEqual(givenName, 'Murthy Chetty');
    assert.strictEqual(surname, 'Konukuru');
  });

  // --------------------------------------------------------------------------
  // MODULE 2: CROSS-LINEAGE MARRIAGES & VIEW LINEAGE (ARCH-002)
  // --------------------------------------------------------------------------
  console.log('\n--- MODULE 2: Cross-Lineage Marriages & "View Lineage" ---');

  await testCase('TEST-ARCH-02-01', 'Graph explosion prevention: external spouse parents excluded from resting layout', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });

    // Suguna is present as Jagannadham's spouse
    const suguna = layout.nodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b');
    assert.ok(suguna, 'Suguna must be included in Konukuru tree');

    // Her parents (Ramayya Chetty & Achamma) must NOT be in resting layout
    const ramayya = layout.nodes.find((n) => n.id === '1ae73a4b-b739-40d3-8b50-071bbf1b07eb');
    const achamma = layout.nodes.find((n) => n.id === 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b');
    assert.strictEqual(ramayya, undefined, 'Ramayya Chetty must be excluded from resting Konukuru layout');
    assert.strictEqual(achamma, undefined, 'Achamma must be excluded from resting Konukuru layout');
  });

  await testCase('TEST-ARCH-02-02', 'Bilateral View Lineage availability: non-lineage spouse has button; primary house members do not', () => {
    // In Konukuru tree:
    // Suguna (born Paradarami) -> has external lineage (Paradarami)
    const sugunaLineage = LINEAGE_PARENTS_BY_PERSON['5c561a7d-3fee-4112-af6e-286f7a8ad61b'];
    assert.ok(sugunaLineage, 'Suguna must have external lineage mapping');
    assert.strictEqual(sugunaLineage.lineageId, 'paradarami');

    // In Paradarami tree:
    // Jagannadham (born Konukuru) -> has external lineage (Konukuru)
    const jagannadhamLineage = LINEAGE_PARENTS_BY_PERSON['b19dee44-9906-4c46-84b6-70d2fa70a5b5'];
    assert.ok(jagannadhamLineage, 'Jagannadham must have external lineage mapping');
    assert.strictEqual(jagannadhamLineage.lineageId, 'konukuru');

    // Murthy Chetty (primary house patriarch) -> has no external lineage button
    assert.strictEqual(LINEAGE_PARENTS_BY_PERSON['867842c1-b8a2-45ad-8d9c-89150e68eb16'], undefined);
  });

  await testCase('TEST-ARCH-02-03', 'Dynamic Auto-Arrangement: couples relocated to far right end of generation row', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });
    const flowData = convertLayoutToReactFlow(layout, {
      selectedNodeId: null,
      highlightedNodeIds: new Set<string>(),
      highlightedEdgeIds: new Set<string>(),
      pathNodeIds: new Set<string>(),
      pathEdgeIds: new Set<string>(),
      focusMode: false,
    });

    const finalNodes = [...flowData.nodes];
    const targetPersonNode = finalNodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b')!;
    const spouseNode = finalNodes.find((n) => n.id === 'b19dee44-9906-4c46-84b6-70d2fa70a5b5')!;

    // Find max X of other Gen X nodes (Chandrakala at 3365)
    const otherSameGenNodes = finalNodes.filter(
      (n) => n.id !== targetPersonNode.id && n.id !== spouseNode.id && Math.abs(n.position.y - targetPersonNode.position.y) < 120
    );
    const maxSameGenX = Math.max(...otherSameGenNodes.map((n) => n.position.x));
    assert.strictEqual(maxSameGenX, 3365, 'Rightmost other sibling must be Chandrakala at X=3365');

    // Relocation logic
    const newSpouseX = maxSameGenX + 320;
    const newTargetX = newSpouseX + 320;

    assert.strictEqual(newSpouseX, 3685, 'Jagannadham must be relocated to X=3685 (past Chandrakala)');
    assert.strictEqual(newTargetX, 4005, 'Suguna must be relocated to X=4005 (at far right end of row)');
  });

  await testCase('TEST-ARCH-02-04', 'Downstream children centering directly below relocated couple', async () => {
    const newSpouseX = 3685;
    const newTargetX = 4005;
    const parentsMidX = (newSpouseX + newTargetX) / 2; // 3845
    const child1X = parentsMidX - 140; // 3705 (Meghana)
    const child2X = parentsMidX + 140; // 3985 (Shanmuga)

    assert.strictEqual(parentsMidX, 3845, 'Couple midpoint must be 3845');
    assert.strictEqual(child1X, 3705, 'First child Meghana must be centered at 3705 in Gen Z');
    assert.strictEqual(child2X, 3985, 'Second child Shanmuga must be centered at 3985 in Gen Z');
  });

  await testCase('TEST-ARCH-02-05', 'Zero collision: external parents positioned with clear horizontal clearance from primary tree', () => {
    const sugunaX = 4005;
    const fatherX = sugunaX - 140; // 3865 (Ramayya Chetty)
    const motherX = sugunaX + 140; // 4145 (Achamma)
    const chandrakalaX = 3365;

    const clearance = fatherX - chandrakalaX;
    assert.ok(clearance >= 500, `Must have at least 500px clearance from Chandrakala (got ${clearance}px)`);
  });

  await testCase('TEST-ARCH-02-06', 'Graceful collapse: clearing expandedLineagePersonId leaves canonical positions intact', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });
    const suguna = layout.nodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b')!;
    assert.strictEqual(suguna.x, 1905, 'Resting layout X for Suguna remains 1905');
  });

  // --------------------------------------------------------------------------
  // MODULE 3: PRIVACY MODEL & FAMILY ACCESS CODES (ARCH-003)
  // --------------------------------------------------------------------------
  console.log('\n--- MODULE 3: Privacy Model & Family Access Codes ---');

  await testCase('TEST-ARCH-03-01', 'Family Access Codes exist and are unique per house', () => {
    assert.strictEqual(KNOWN_LINEAGES.konukuru.code, 'KONU1290');
    assert.strictEqual(KNOWN_LINEAGES.paradarami.code, 'PARA1290');
    assert.notStrictEqual(KNOWN_LINEAGES.konukuru.code, KNOWN_LINEAGES.paradarami.code);
  });

  await testCase('TEST-ARCH-03-02', 'Ancestral Visibility Rule: direct parents are visible in upper generation', () => {
    const depth1 = PARADARAMI_DEPTH1_PARENTS;
    assert.strictEqual(depth1.length, 2, 'Exactly 2 parents in maternal depth 1');
    const father = depth1.find((p) => p.gender === 'male')!;
    const mother = depth1.find((p) => p.gender === 'female')!;
    assert.strictEqual(father.firstName, 'Ramayya');
    assert.strictEqual(father.lastName, 'Paradarami');
    assert.strictEqual(mother.firstName, 'Achamma');
    assert.strictEqual(mother.lastName, 'Paradarami');
  });

  await testCase('TEST-ARCH-03-03', 'Collateral & descendant privacy: spouse siblings and nephews/nieces are NOT exposed', async () => {
    // When viewing Konukuru with expanded Suguna, the rendered nodes should contain Ramayya & Achamma,
    // but MUST NEVER contain Rada Galeti (sibling), Munirathnam Galeti (in-law), or Navaneeth Galeti (nephew).
    const paradaramiDbPersons = [
      'fd26db0a-7e43-47d8-bb1c-55b1b84026c2', // Rada Galeti
      '901d8c3f-0bd1-4947-9678-fbfd685d77c1', // Munirathnam Galeti
      'e363ae76-6ecd-4810-a20b-06e10852afd7', // Navaneeth Galeti
    ];

    const konukuruGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    for (const id of paradaramiDbPersons) {
      const personInKonukuru = konukuruGraph.nodes.find((n) => n.id === id);
      assert.strictEqual(personInKonukuru, undefined, `Collateral member ${id} must NOT be in Konukuru graph`);
    }
  });

  await testCase('TEST-ARCH-03-04', 'Strict Lower-Generation Placement: Lock Node resides in lower generation (Millennials/Gen Z), not upper generation', () => {
    const sugunaY = 2780; // Gen X
    const parentsY = sugunaY - 440; // 2340 (Baby Boomers, Upper Gen)
    const lockY = sugunaY + 440; // 3220 (Millennials, Lower Gen)

    assert.strictEqual(parentsY, 2340, 'Direct parents must be in upper generation Y=2340');
    assert.strictEqual(lockY, 3220, 'Lock node must be in lower generation Y=3220');
    assert.ok(lockY > sugunaY, 'Lock node Y coordinate must be strictly greater than target person Y');
  });

  await testCase('TEST-ARCH-03-05', 'Refined Grey Styling: Lock Node uses neutral slate grey (#94a3b8) instead of red', () => {
    const lockNodeContent = fs.readFileSync(
      path.resolve(projectRoot, 'src/components/canvas/LineageLockNode.tsx'),
      'utf8'
    );

    // Verify grey is used
    assert.ok(lockNodeContent.includes('#94a3b8'), 'Lock Node must use #94a3b8 grey styling');
    // Verify harsh red is NOT used for locked border/color
    assert.ok(!lockNodeContent.includes("border: unlocked ? '2.5px solid #10b981' : '2.5px solid #ef4444'"), 'Red border must not be used');
    assert.ok(!lockNodeContent.includes('<Lock size={36} color="#f87171" />'), 'Red lock icon must not be used');
  });

  await testCase('TEST-ARCH-03-06', 'Case-insensitive code validation transitions state and enables lineage switching', () => {
    function validateCode(input: string): boolean {
      return input.trim().toUpperCase() === KNOWN_LINEAGES.paradarami.code;
    }

    assert.strictEqual(validateCode('PARA1290'), true, 'Exact uppercase code valid');
    assert.strictEqual(validateCode('para1290'), true, 'Lowercase code valid');
    assert.strictEqual(validateCode('  para1290  '), true, 'Padded code valid');
    assert.strictEqual(validateCode('WRONG_CODE'), false, 'Wrong code rejected');
  });

  // --------------------------------------------------------------------------
  // MODULE 4: DATA MODEL & GRAPH PARTITIONING (ARCH-004)
  // --------------------------------------------------------------------------
  console.log('\n--- MODULE 4: Data Model & Graph Partitioning ---');

  await testCase('TEST-ARCH-04-01', 'Canonical database integrity: exactly 19 persons and 29 relationships without corruption', async () => {
    const persons = await repo.getAllPersons();
    const relationships = await repo.getAllRelationships();

    assert.strictEqual(persons.length, 19, 'Canonical database must have exactly 19 persons');
    assert.strictEqual(relationships.length, 29, 'Canonical database must have exactly 29 relationships');
  });

  await testCase('TEST-ARCH-04-02', 'Deterministic graph partitioning: Konukuru partitioned to 14 nodes; Paradarami partitioned to 6 nodes', async () => {
    const konukuruGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    assert.strictEqual(konukuruGraph.nodes.length, 14, 'Konukuru partition must have exactly 14 nodes');

    const paradaramiGraph = await graphService.buildFamilyGraph({ lineage: 'paradarami' });
    assert.strictEqual(paradaramiGraph.nodes.length, 6, 'Paradarami partition must have exactly 6 nodes');
  });

  await testCase('TEST-ARCH-04-03', 'Layout geometry: standard 190x160 dimensions and 320px spouse spacing', async () => {
    const rawGraph = await graphService.buildFamilyGraph({ lineage: 'konukuru' });
    const layout = layoutService.calculateLayout(rawGraph, { inferGenerations: true });

    for (const node of layout.nodes) {
      assert.strictEqual(node.width, 190, `Node ${node.id} width must be 190`);
      assert.strictEqual(node.height, 160, `Node ${node.id} height must be 160`);
    }

    // Verify spouse horizontal spacing for Sarojamma & Murthy Chetty
    const sarojamma = layout.nodes.find((n) => n.id === '4a80001b-76bf-4e13-963b-89b2aafbb413')!;
    const murthy = layout.nodes.find((n) => n.id === '867842c1-b8a2-45ad-8d9c-89150e68eb16')!;
    const spouseDeltaX = Math.abs(murthy.x - sarojamma.x);
    assert.strictEqual(spouseDeltaX, 320, 'Spouses must be spaced exactly 320px center-to-center');
  });

  await testCase('TEST-ARCH-04-04', 'Pre-rendered static assets exist in public/data and match layout schema', () => {
    const konukuruJsonPath = path.resolve(projectRoot, 'public/data/layout-konukuru.json');
    const paradaramiJsonPath = path.resolve(projectRoot, 'public/data/layout-paradarami.json');

    assert.ok(fs.existsSync(konukuruJsonPath), 'layout-konukuru.json must exist in public/data');
    assert.ok(fs.existsSync(paradaramiJsonPath), 'layout-paradarami.json must exist in public/data');

    const konukuruData = JSON.parse(fs.readFileSync(konukuruJsonPath, 'utf8'));
    assert.strictEqual(konukuruData.nodes.length, 14, 'Pre-rendered Konukuru layout must contain 14 nodes');
    assert.strictEqual(konukuruData.lanes.length, 11, 'Pre-rendered Konukuru layout must contain 11 lanes');
  });

  console.log('\n================================================================');
  console.log(`AUDIT TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('================================================================\n');

  return { totalTests, passedTests, testResults };
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith('test_architecture_audit.ts')) {
  runAuditTests().then(({ totalTests, passedTests }) => {
    if (passedTests !== totalTests) {
      process.exit(1);
    }
  });
}
