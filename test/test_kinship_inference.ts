import assert from 'node:assert';
import {
  findDuplicateLineageMembers,
  inferKinshipRelations,
  KinshipNode,
  KinshipEdge,
} from '../src/utils/kinshipInference.ts';

console.log('================================================================');
console.log('   TEST SUITE: KINSHIP AUTO-INFERENCE & DUPLICATE SUGGESTIONS   ');
console.log('================================================================\n');

// Mock data representing a lineage family
const sampleNodes: KinshipNode[] = [
  {
    id: 'p-father',
    firstName: 'Murthy Chetty',
    lastName: 'Konukuru',
    gender: 'male',
    birthYear: 1935,
  },
  {
    id: 'p-mother',
    firstName: 'Sarojamma',
    lastName: 'Konukuru',
    gender: 'female',
    birthYear: 1940,
  },
  {
    id: 'p-son',
    firstName: 'Chandra Babu',
    lastName: 'Konukuru',
    gender: 'male',
    birthYear: 1965,
  },
  {
    id: 'p-daughter-in-law',
    firstName: 'Dana Lakshmi',
    lastName: 'Konukuru',
    gender: 'female',
    birthYear: 1970,
  },
];

const sampleEdges: KinshipEdge[] = [
  // Father and Mother are spouses
  { source: 'p-father', target: 'p-mother', type: 'spouse' },
  // Father and Mother are parents of son
  { source: 'p-father', target: 'p-son', type: 'parent' },
  { source: 'p-mother', target: 'p-son', type: 'parent' },
  // Son is married to daughter-in-law
  { source: 'p-son', target: 'p-daughter-in-law', type: 'spouse' },
];

let total = 0;
let passed = 0;

function runTest(desc: string, fn: () => void) {
  total++;
  try {
    fn();
    passed++;
    console.log(`✓ PASS: ${desc}`);
  } catch (err: any) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
  }
}

// 1. Duplicate Detection Tests (Requirement 1)
runTest('findDuplicateLineageMembers finds exact match by full name', () => {
  const matches = findDuplicateLineageMembers('Murthy Chetty', 'Konukuru', sampleNodes);
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].id, 'p-father');
});

runTest('findDuplicateLineageMembers is case-insensitive', () => {
  const matches = findDuplicateLineageMembers('sarojamma', 'konukuru', sampleNodes);
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].id, 'p-mother');
});

runTest('findDuplicateLineageMembers ignores excluded person ID during edit', () => {
  const matches = findDuplicateLineageMembers('Murthy Chetty', 'Konukuru', sampleNodes, 'p-father');
  assert.strictEqual(matches.length, 0, 'Should exclude currently edited person');
});

runTest('findDuplicateLineageMembers returns empty array for new unique person', () => {
  const matches = findDuplicateLineageMembers('Vikram', 'Konukuru', sampleNodes);
  assert.strictEqual(matches.length, 0);
});

// 2. Kinship Auto-Inference: Selecting Father auto-populates Mother (Requirement 11)
runTest('inferKinshipRelations: Selecting Father auto-populates Mother', () => {
  const res = inferKinshipRelations({
    triggerField: 'father',
    triggerValue: 'p-father',
    currentMotherId: '',
    nodes: sampleNodes,
    edges: sampleEdges,
  });

  assert.strictEqual(res.inferredMotherId, 'p-mother');
  assert(res.reason?.includes("Father's spouse"));
});

// 3. Kinship Auto-Inference: Selecting Mother auto-populates Father (Requirement 11)
runTest('inferKinshipRelations: Selecting Mother auto-populates Father', () => {
  const res = inferKinshipRelations({
    triggerField: 'mother',
    triggerValue: 'p-mother',
    currentFatherId: '',
    nodes: sampleNodes,
    edges: sampleEdges,
  });

  assert.strictEqual(res.inferredFatherId, 'p-father');
  assert(res.reason?.includes("Mother's spouse"));
});

// 4. Kinship Auto-Inference: Selecting Child auto-populates Spouse (Requirement 11)
runTest('inferKinshipRelations: Selecting Child for a female subject auto-populates Father as spouse', () => {
  const res = inferKinshipRelations({
    triggerField: 'child',
    triggerValue: 'p-son',
    subjectGender: 'female',
    currentSpouseId: '',
    nodes: sampleNodes,
    edges: sampleEdges,
  });

  assert.strictEqual(res.inferredSpouseId, 'p-father');
  assert(res.reason?.includes("Child's biological father"));
});

// 5. Kinship Auto-Inference: Selecting Spouse auto-suggests Child (Requirement 11)
runTest('inferKinshipRelations: Selecting Spouse auto-suggests child', () => {
  const res = inferKinshipRelations({
    triggerField: 'spouse',
    triggerValue: 'p-father',
    currentChildId: '',
    nodes: sampleNodes,
    edges: sampleEdges,
  });

  assert.strictEqual(res.inferredChildId, 'p-son');
  assert(res.reason?.includes('Child'));
});

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
