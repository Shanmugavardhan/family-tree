import assert from 'assert';
import { augmentLayoutWithCustomPersons } from '../src/services/layoutApi';
import { saveLocalCustomPerson, getLocalCustomPersons } from '../src/services/personApi';
import { saveLocalCustomRelationship, getLocalCustomRelationships } from '../src/services/relationshipApi';
import { parseFullName } from '../src/utils/kinshipInference';
import { convertLayoutToReactFlow } from '../src/adapters/reactFlowAdapter';
import { Person } from '../src/types/person';
import { Relationship } from '../src/types/relationship';
import { FamilyLayout } from '../src/types/layout';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup mock localStorage for Node.js environment
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => {
    store[key] = String(val);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
(global as any).window = {
  location: { hostname: 'thefamilytree.web.app' }, // Deployed production environment
};

console.log('================================================================');
console.log('   TEST SUITE: ADD MEMBER ROOT CAUSE & PERSISTENCE VERIFICATION  ');
console.log('================================================================\n');

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
  }
}

// Load base static Paradarami layout
const paradaramiLayoutPath = path.resolve(__dirname, '../public/data/layout-paradarami.json');
const baseParadaramiLayout: FamilyLayout = JSON.parse(fs.readFileSync(paradaramiLayoutPath, 'utf-8'));

async function runAll() {
  await runTest('Root Cause Fix: saveLocalCustomPerson stores member in persistent local storage', () => {
  localStorage.clear();
  const subramanyam: Person = {
    id: 'subramanyam-test-uuid',
    first_name: 'Subramanyam',
    middle_name: null,
    last_name: 'Paradarami',
    alias: null,
    gender: 'male',
    birth_date: '1975',
    death_date: null,
    birth_place: 'Paradarami',
    death_place: null,
    profile_photo: null,
    biography: 'Son of Ramayya Paradarami',
    is_living: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  };

  saveLocalCustomPerson(subramanyam);
  const stored = getLocalCustomPersons();
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].id, 'subramanyam-test-uuid');
  assert.strictEqual(stored[0].first_name, 'Subramanyam');
  assert.strictEqual(stored[0].last_name, 'Paradarami');
});

  await runTest('Root Cause Fix: saveLocalCustomRelationship stores parent relationship in persistent storage', () => {
  const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb'; // Ramayya Paradarami in base tree
  const rel: Relationship = {
    id: 'rel-ramayya-subramanyam',
    person_id: 'subramanyam-test-uuid', // Child
    related_person_id: ramayyaId, // Father
    relationship_type: 'parent',
    parent_type: 'biological',
    start_date: null,
    end_date: null,
    notes: null,
    created_at: new Date().toISOString(),
  };

  saveLocalCustomRelationship(rel);
  const stored = getLocalCustomRelationships();
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].person_id, 'subramanyam-test-uuid');
  assert.strictEqual(stored[0].related_person_id, ramayyaId);
});

  await runTest('Root Cause Fix: augmentLayoutWithCustomPersons renders Subramanyam Paradarami on canvas layout', () => {
  const initialNodeCount = baseParadaramiLayout.nodes.length;
  const initialEdgeCount = baseParadaramiLayout.edges.length;

  const augmentedLayout = augmentLayoutWithCustomPersons(baseParadaramiLayout, 'paradarami');

  // Must have 1 more node and at least 1 more edge
  assert.strictEqual(augmentedLayout.nodes.length, initialNodeCount + 1, 'Subramanyam must be added to layout nodes');
  assert.strictEqual(augmentedLayout.edges.length, initialEdgeCount + 1, 'Connecting parent edge must be added');

  const subramanyamNode = augmentedLayout.nodes.find((n) => n.firstName === 'Subramanyam');
  assert.ok(subramanyamNode, 'Subramanyam node must exist in augmented layout');
  assert.strictEqual(subramanyamNode.lastName, 'Paradarami');
  assert.strictEqual(subramanyamNode.gender, 'male');
  assert.ok(subramanyamNode.x > 0, 'Must have valid positive x coordinate');
  assert.ok(subramanyamNode.y > 0, 'Must have valid positive y coordinate');

  // Verify non-overlapping coordinates in the generational strip
  const sugunaNode = augmentedLayout.nodes.find((n) => n.firstName === 'Suguna');
  assert.ok(sugunaNode, 'Suguna Konukuru node must exist');
  assert.notStrictEqual(subramanyamNode.x, sugunaNode.x, 'Subramanyam MUST NOT overlap Suguna Konukuru');
  assert.ok(
    Math.abs(subramanyamNode.x - sugunaNode.x) >= 270,
    `Subramanyam (${subramanyamNode.x}) and Suguna (${sugunaNode.x}) must be separated by at least 270px`
  );

  // Verify ALL nodes in Generation 3 have strictly zero overlap and flat strip Y alignment
  const gen3Nodes = augmentedLayout.nodes.filter((n) => n.generationOrder === 3);
  assert.ok(gen3Nodes.length >= 6, 'Must have at least 6 members in Generation 3');
  for (const node of gen3Nodes) {
    assert.strictEqual(node.y, 2780, `${node.firstName} must be aligned to lane baseline y=2780`);
  }

  // Pairwise bounding box overlap check
  for (let i = 0; i < gen3Nodes.length; i++) {
    for (let j = i + 1; j < gen3Nodes.length; j++) {
      const a = gen3Nodes[i];
      const b = gen3Nodes[j];
      const gap = Math.abs(a.x - b.x);
      assert.ok(
        gap >= 270,
        `Collision detected between ${a.firstName} (${a.x}) and ${b.firstName} (${b.x}): gap is only ${gap}px`
      );
    }
  }

  // Verify the edge connects Ramayya (parent) to Subramanyam (child)
  const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';
  const edge = augmentedLayout.edges.find(
    (e) => e.source === ramayyaId && e.target === 'subramanyam-test-uuid'
  );
  assert.ok(edge, 'Edge connecting Ramayya to Subramanyam must exist');
  assert.strictEqual(edge.type, 'parent_child');
});

  await runTest('Root Cause Fix: parseFullName auto-segregates single input into first, middle, and family name', () => {
  // 1 token
  const t1 = parseFullName('Subramanyam');
  assert.strictEqual(t1.firstName, 'Subramanyam');
  assert.strictEqual(t1.middleName, '');
  assert.strictEqual(t1.lastName, '');

  // 2 tokens
  const t2 = parseFullName('Subramanyam Paradarami');
  assert.strictEqual(t2.firstName, 'Subramanyam');
  assert.strictEqual(t2.middleName, '');
  assert.strictEqual(t2.lastName, 'Paradarami');

  // 3 tokens
  const t3 = parseFullName('Subramanyam Chetty Paradarami');
  assert.strictEqual(t3.firstName, 'Subramanyam');
  assert.strictEqual(t3.middleName, 'Chetty');
  assert.strictEqual(t3.lastName, 'Paradarami');

  // 4 tokens
  const t4 = parseFullName('Sri Rama Krishna Rao Konukuru');
  assert.strictEqual(t4.firstName, 'Sri');
  assert.strictEqual(t4.middleName, 'Rama Krishna Rao');
  assert.strictEqual(t4.lastName, 'Konukuru');
});

  await runTest('Spouse Side-by-Side Rearrangement: Narayanaswamy A sits directly beside Srivalli and Subramanyam rearranges rightwards', () => {
  // Add Narayanaswamy A as spouse of Srivalli Narayanaswamy
  const srivalliId = 'bde77be0-8530-4ce6-93a5-f3751cbc3f6a';
  const narayanaswamy: Person = {
    id: 'narayanaswamy-test-uuid',
    first_name: 'Narayanaswamy',
    middle_name: null,
    last_name: 'A',
    alias: null,
    gender: 'male',
    birth_date: '1970',
    death_date: null,
    birth_place: 'Paradarami',
    death_place: null,
    profile_photo: null,
    biography: 'Husband of Srivalli Narayanaswamy',
    is_living: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  };

  saveLocalCustomPerson(narayanaswamy);

  const spouseRel: Relationship = {
    id: 'rel-srivalli-narayanaswamy',
    person_id: 'narayanaswamy-test-uuid',
    related_person_id: srivalliId,
    relationship_type: 'spouse',
    parent_type: null,
    start_date: null,
    end_date: null,
    notes: null,
    created_at: new Date().toISOString(),
  };

  saveLocalCustomRelationship(spouseRel);

  const layout = augmentLayoutWithCustomPersons(baseParadaramiLayout, 'paradarami');

  const srivalli = layout.nodes.find((n) => n.id === srivalliId);
  const narayana = layout.nodes.find((n) => n.id === 'narayanaswamy-test-uuid');
  const subramanyam = layout.nodes.find((n) => n.id === 'subramanyam-test-uuid');

  assert.ok(srivalli, 'Srivalli must exist');
  assert.ok(narayana, 'Narayanaswamy A must exist');
  assert.ok(subramanyam, 'Subramanyam must exist');

  // Rule: Spouses MUST be side-by-side with no intermediate node between them!
  const spouseDistance = Math.abs(narayana.x - srivalli.x);
  assert.strictEqual(spouseDistance, 320, 'Spouses must sit side-by-side at standard couple spacing (320px)');

  // Rule: Subramanyam must be rearranged to the right of the couple
  const coupleRightEdge = Math.max(srivalli.x, narayana.x) + 190;
  assert.ok(
    subramanyam.x >= coupleRightEdge,
    `Subramanyam (${subramanyam.x}) must be to the right of the Srivalli-Narayanaswamy couple (${coupleRightEdge})`
  );

  // Check no other node sits between Srivalli and Narayanaswamy
  const minSpouseX = Math.min(srivalli.x, narayana.x);
  const maxSpouseX = Math.max(srivalli.x, narayana.x);
  const betweenNodes = layout.nodes.filter(
    (n) => n.generationOrder === 3 && n.x > minSpouseX && n.x < maxSpouseX
  );
  assert.strictEqual(betweenNodes.length, 0, 'No node may ever sit between spouses in the generational strip');

  // Verify Spouse Edge Representation:
  // Must connect from Srivalli (left, spouse-right) to Narayanaswamy (right, spouse-left)
  // so the pink dotted line is ONLY in the gap and NEVER crosses either tile.
  const spouseEdge = layout.edges.find(
    (e) =>
      e.type === 'spouse' &&
      ((e.source === srivalliId && e.target === 'narayanaswamy-test-uuid') ||
        (e.source === 'narayanaswamy-test-uuid' && e.target === srivalliId))
  );
  assert.ok(spouseEdge, 'Spouse edge between Srivalli and Narayanaswamy must exist');
  assert.strictEqual(spouseEdge.source, srivalliId, 'Spouse edge source must be canonically oriented to the left node (Srivalli)');
  assert.strictEqual(spouseEdge.target, 'narayanaswamy-test-uuid', 'Spouse edge target must be the right node (Narayanaswamy)');

  // Verify in ReactFlow adapter conversion
  const reactFlowData = convertLayoutToReactFlow(layout);
  const rfSpouseEdge = reactFlowData.edges.find((e) => e.id === spouseEdge.id);
  assert.ok(rfSpouseEdge, 'React Flow spouse edge must exist');
  assert.strictEqual(rfSpouseEdge.source, srivalliId, 'RF edge source must be Srivalli');
  assert.strictEqual(rfSpouseEdge.target, 'narayanaswamy-test-uuid', 'RF edge target must be Narayanaswamy');
  assert.strictEqual(rfSpouseEdge.sourceHandle, 'spouse-right', 'RF edge sourceHandle must be spouse-right (pointing right)');
  assert.strictEqual(rfSpouseEdge.targetHandle, 'spouse-left', 'RF edge targetHandle must be spouse-left (pointing left)');
});

  await runTest('Root Cause Fix: Multiple calls are idempotent and do not duplicate nodes or edges', () => {
  const run1 = augmentLayoutWithCustomPersons(baseParadaramiLayout, 'paradarami');
  const run2 = augmentLayoutWithCustomPersons(run1, 'paradarami');

  assert.strictEqual(run2.nodes.length, run1.nodes.length, 'Node count must not duplicate');
  assert.strictEqual(run2.edges.length, run1.edges.length, 'Edge count must not duplicate');
});

  await runTest('Generational Boundary Invariant: Person tiles are strictly contained inside their generational strip and never cross boundaries', () => {
  // Test across both standard and compact layouts for both lineages
  const konuStandard: FamilyLayout = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/layout-konukuru.json'), 'utf-8'));
  const konuCompact: FamilyLayout = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/layout-konukuru-compact.json'), 'utf-8'));
  const paraStandard: FamilyLayout = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/layout-paradarami.json'), 'utf-8'));
  const paraCompact: FamilyLayout = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/layout-paradarami-compact.json'), 'utf-8'));

  const layoutsToTest = [
    { name: 'Konukuru Standard', layout: augmentLayoutWithCustomPersons(konuStandard, 'konukuru') },
    { name: 'Konukuru Compact', layout: augmentLayoutWithCustomPersons(konuCompact, 'konukuru', { compactLanes: true }) },
    { name: 'Paradarami Standard', layout: augmentLayoutWithCustomPersons(paraStandard, 'paradarami') },
    { name: 'Paradarami Compact', layout: augmentLayoutWithCustomPersons(paraCompact, 'paradarami', { compactLanes: true }) },
  ];

  const CARD_NATURAL_HEIGHT = 180; // Portrait medallion (96px) + margins (14px) + 2 text lines (42px) + status/spacing (28px)

  for (const { name, layout } of layoutsToTest) {
    for (const node of layout.nodes) {
      const lane = layout.lanes.find((l) => l.order === node.generationOrder);
      assert.ok(lane, `[${name}] Node ${node.firstName} must have a valid lane for genOrder ${node.generationOrder}`);

      const laneTop = lane.y;
      const laneBottom = lane.y + lane.height;

      // 1. Node top must be safely below lane top
      assert.ok(
        node.y >= laneTop,
        `[${name}] Node ${node.firstName} top (y=${node.y}) must be >= lane top (${laneTop})`
      );

      // 2. Node bottom (at mobile scale 1.0) must be strictly above lane bottom
      const nodeBottom = node.y + CARD_NATURAL_HEIGHT;
      assert.ok(
        nodeBottom <= laneBottom,
        `[${name}] Node ${node.firstName} bottom (y=${nodeBottom}) must be <= lane bottom (${laneBottom}) - crossed by ${nodeBottom - laneBottom}px!`
      );

      // 3. Must have comfortable breathing clearance (at least 30px on both sides)
      const topClearance = node.y - laneTop;
      const bottomClearance = laneBottom - nodeBottom;
      assert.ok(
        topClearance >= 40,
        `[${name}] Node ${node.firstName} top clearance (${topClearance}px) must be >= 40px`
      );
      assert.ok(
        bottomClearance >= 40,
        `[${name}] Node ${node.firstName} bottom clearance (${bottomClearance}px) must be >= 40px`
      );
    }
  }
});

  await runTest('Bug Fix: Rohitha Galeti born in 2002 is placed in Generation Z (Order 5), NOT Millennials', () => {
  // Clear and add Munirathnam/Rada as parents, and Rohitha with birth year 2002
  const rohitha: Person = {
    id: 'rohitha-galeti-uuid',
    first_name: 'Rohitha',
    middle_name: null,
    last_name: 'Galeti',
    alias: null,
    gender: 'female',
    birth_date: '2002',
    death_date: null,
    birth_place: 'Madanapalli',
    death_place: null,
    profile_photo: null,
    biography: 'Daughter of Munirathnam and Rada',
    is_living: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  };

  saveLocalCustomPerson(rohitha);

  // Parent relationship to Munirathnam Galeti (who is in Generation X, order 3)
  const muniRel: Relationship = {
    id: 'rel-muni-rohitha',
    person_id: rohitha.id, // child
    related_person_id: '901d8c3f-0bd1-4947-9678-fbfd685d77c1', // Munirathnam (Gen X, order 3)
    relationship_type: 'parent',
    parent_type: 'biological',
    start_date: null,
    end_date: null,
    notes: null,
    created_at: new Date().toISOString(),
  };
  saveLocalCustomRelationship(muniRel);

  const paraCompact: FamilyLayout = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/data/layout-paradarami-compact.json'), 'utf-8'));
  const augmented = augmentLayoutWithCustomPersons(paraCompact, 'paradarami', { compactLanes: true });

  const rohithaNode = augmented.nodes.find((n) => n.id === rohitha.id);
  assert.ok(rohithaNode, 'Rohitha Galeti node must be present in augmented layout');

  // Verify that birth year 2002 maps to Generation Z (order 5), NOT Millennials (order 4)
  assert.strictEqual(
    rohithaNode.generationOrder,
    5,
    `Rohitha Galeti born in 2002 MUST be Generation Z (order 5), but was placed in order ${rohithaNode.generationOrder}!`
  );
  assert.strictEqual(
    rohithaNode.generationId,
    'gen_z',
    `Rohitha Galeti generationId must be 'gen_z', got '${rohithaNode.generationId}'`
  );
  assert.strictEqual(
    rohithaNode.generationName,
    'Generation Z',
    `Rohitha Galeti generationName must be 'Generation Z', got '${rohithaNode.generationName}'`
  );

  // Verify that Rohitha is positioned on the same vertical baseline as Gen Z peers (y = 1020)
  const navaneethNode = augmented.nodes.find((n) => n.firstName === 'Navaneeth');
  assert.ok(navaneethNode, 'Navaneeth Galeti node must exist in Gen Z');
  assert.strictEqual(
    rohithaNode.y,
    navaneethNode.y,
    `Rohitha Galeti (y=${rohithaNode.y}) must share exact same baseline Y with brother Navaneeth Galeti (y=${navaneethNode.y}) in Generation Z`
  );
});

  await runTest('Bug Fix: Srivalli Narayanaswamy and Surendrababu Paradarami are derived as Brother and Sister', async () => {
  // Srivalli is in base Paradarami tree with father Ramayya Chetty
  const srivalliId = 'bde77be0-8530-4ce6-93a5-f3751cbc3f6a';
  const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';

  // Add Surendrababu Paradarami as custom person with father Ramayya Chetty
  const surendrababu: Person = {
    id: 'surendrababu-paradarami-uuid',
    first_name: 'Surendrababu',
    middle_name: null,
    last_name: 'Paradarami',
    alias: null,
    gender: 'male',
    birth_date: '1972',
    death_date: null,
    birth_place: 'Paradarami',
    death_place: null,
    profile_photo: null,
    biography: 'Son of Ramayya Chetty Paradarami',
    is_living: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  };
  saveLocalCustomPerson(surendrababu);

  const ramayyaSurendraRel: Relationship = {
    id: 'rel-ramayya-surendrababu',
    person_id: surendrababu.id, // child
    related_person_id: ramayyaId, // father
    relationship_type: 'parent',
    parent_type: 'biological',
    start_date: null,
    end_date: null,
    notes: null,
    created_at: new Date().toISOString(),
  };
  saveLocalCustomRelationship(ramayyaSurendraRel);

  // Query Relationship Pathfinder via personApi.getRelationshipTo
  const { personApi } = await import('../src/services/personApi');
  const res = await personApi.getRelationshipTo(srivalliId, surendrababu.id);

  assert.strictEqual(res.success, true);
  assert.ok(res.data, 'Relationship data must be present');

  // Perspective: From Srivalli -> Surendrababu is her Brother!
  assert.strictEqual(
    res.data.relationship,
    'Brother',
    `Expected Srivalli's relationship to Surendrababu to be 'Brother', got '${res.data.relationship}'`
  );

  // Reverse: From Surendrababu -> Srivalli is his Sister!
  assert.strictEqual(
    res.data.reverse_relationship,
    'Sister',
    `Expected reverse relationship to be 'Sister', got '${res.data.reverse_relationship}'`
  );

  assert.strictEqual(
    res.data.category,
    'siblings',
    `Expected category to be 'siblings', got '${res.data.category}'`
  );

  // Path must traverse through shared father Ramayya
  assert.ok(res.data.path.length >= 3, 'Path must connect Srivalli, Ramayya, and Surendrababu');
  assert.ok(res.data.path.some((p) => p.includes('Ramayya')), 'Path must include shared parent Ramayya');
});

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
