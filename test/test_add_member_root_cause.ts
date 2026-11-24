import assert from 'assert';
import { augmentLayoutWithCustomPersons } from '../src/services/layoutApi';
import { saveLocalCustomPerson, getLocalCustomPersons } from '../src/services/personApi';
import { saveLocalCustomRelationship, getLocalCustomRelationships } from '../src/services/relationshipApi';
import { parseFullName } from '../src/utils/kinshipInference';
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

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
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

runTest('Root Cause Fix: saveLocalCustomPerson stores member in persistent local storage', () => {
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

runTest('Root Cause Fix: saveLocalCustomRelationship stores parent relationship in persistent storage', () => {
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

runTest('Root Cause Fix: augmentLayoutWithCustomPersons renders Subramanyam Paradarami on canvas layout', () => {
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

runTest('Root Cause Fix: parseFullName auto-segregates single input into first, middle, and family name', () => {
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

runTest('Spouse Side-by-Side Rearrangement: Narayanaswamy A sits directly beside Srivalli and Subramanyam rearranges rightwards', () => {
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
});

runTest('Root Cause Fix: Multiple calls are idempotent and do not duplicate nodes or edges', () => {
  const run1 = augmentLayoutWithCustomPersons(baseParadaramiLayout, 'paradarami');
  const run2 = augmentLayoutWithCustomPersons(run1, 'paradarami');

  assert.strictEqual(run2.nodes.length, run1.nodes.length, 'Node count must not duplicate');
  assert.strictEqual(run2.edges.length, run1.edges.length, 'Edge count must not duplicate');
});

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
