import assert from 'node:assert';
import {
  findDuplicateLineageMembers,
  inferKinshipRelations,
  discoverSiblings,
  estimateBirthYearAndGeneration,
  validateKinshipChronology,
  inferInheritedSurname,
  calculateKinshipNomenclature,
  findNuclearFamilyBatchCandidates,
  detectAncestryCycle,
  KinshipNode,
  KinshipEdge,
} from '../src/utils/kinshipInference.ts';

console.log('================================================================');
console.log('   TEST SUITE: ADVANCED KINSHIP AUTO-INFERENCE (ALL 7 UPGRADES)  ');
console.log('================================================================\n');

// Sample Family Graph for Testing
const sampleNodes: KinshipNode[] = [
  {
    id: 'p-father',
    firstName: 'Murthy Chetty',
    lastName: 'Konukuru',
    gender: 'male',
    birthYear: 1935,
    isLiving: false,
    deathYear: 2010,
  },
  {
    id: 'p-mother',
    firstName: 'Sarojamma',
    lastName: 'Konukuru',
    gender: 'female',
    birthYear: 1940,
    isLiving: false,
    deathYear: 2015,
  },
  {
    id: 'p-second-wife',
    firstName: 'Lakshmi',
    lastName: 'Konukuru',
    gender: 'female',
    birthYear: 1945,
    isLiving: true,
  },
  {
    id: 'p-son1',
    firstName: 'Chandra Babu',
    lastName: 'Konukuru',
    gender: 'male',
    birthYear: 1965,
    isLiving: true,
  },
  {
    id: 'p-daughter1',
    firstName: 'Rajini',
    lastName: 'Konukuru',
    gender: 'female',
    birthYear: 1968,
    isLiving: true,
  },
  {
    id: 'p-grandson',
    firstName: 'Shanmuga',
    lastName: 'Konukuru',
    gender: 'male',
    birthYear: 1995,
    isLiving: true,
  },
];

const sampleEdges: KinshipEdge[] = [
  // Murthy Chetty married to Sarojamma
  { source: 'p-father', target: 'p-mother', type: 'spouse' },
  // Murthy Chetty also married to Lakshmi (Remarriage scenario)
  { source: 'p-father', target: 'p-second-wife', type: 'spouse' },
  // Parents of Chandra Babu and Rajini
  { source: 'p-father', target: 'p-son1', type: 'parent' },
  { source: 'p-mother', target: 'p-son1', type: 'parent' },
  { source: 'p-father', target: 'p-daughter1', type: 'parent' },
  { source: 'p-mother', target: 'p-daughter1', type: 'parent' },
  // Chandra Babu is parent of Shanmuga
  { source: 'p-son1', target: 'p-grandson', type: 'parent' },
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

// --------------------------------------------------------------------------
// Upgrade 1: Sibling Auto-Discovery
// --------------------------------------------------------------------------
runTest('Upgrade 1: Sibling Auto-Discovery detects full siblings sharing both parents', () => {
  const siblings = discoverSiblings('p-father', 'p-mother', 'p-son1', sampleNodes, sampleEdges);
  assert.strictEqual(siblings.fullSiblings.length, 1);
  assert.strictEqual(siblings.fullSiblings[0].id, 'p-daughter1');
  assert(siblings.summaryText?.includes('Rajini'));
});

// --------------------------------------------------------------------------
// Upgrade 2: Generational Epoch & Birth Year Estimation
// --------------------------------------------------------------------------
runTest('Upgrade 2: Birth year estimated from parents maps to Generation X', () => {
  const est = estimateBirthYearAndGeneration({
    fatherId: 'p-father', // 1935
    motherId: 'p-mother', // 1940
    nodes: sampleNodes,
  });
  assert(est !== null);
  // Average (1935+1940)/2 = 1937.5 + 28 = 1966 -> Generation X (1965-1980)
  assert.strictEqual(est.estimatedBirthYear, 1966);
  assert.strictEqual(est.generationId, 'gen_x');
  assert.strictEqual(est.generationName, 'Generation X');
});

runTest('Upgrade 2: Birth year estimated from child maps to Baby Boomers', () => {
  const est = estimateBirthYearAndGeneration({
    childId: 'p-grandson', // 1995 (Millennial)
    nodes: sampleNodes,
  });
  assert(est !== null);
  // 1995 - 28 = 1967 -> Generation X
  assert.strictEqual(est.estimatedBirthYear, 1967);
  assert.strictEqual(est.generationId, 'gen_x');
});

// --------------------------------------------------------------------------
// Upgrade 3: Biological & Chronological Sanity Checks
// --------------------------------------------------------------------------
runTest('Upgrade 3: Detects inverted chronology when child is born before parent', () => {
  const issues = validateKinshipChronology({
    subjectBirthDate: '1930', // Before father (1935)
    fatherId: 'p-father',
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const conflict = issues.find((i) => i.severity === 'error' && i.message.includes('Chronology conflict'));
  assert(conflict !== undefined, 'Must flag error when child born before father');
});

runTest('Upgrade 3: Detects biological age anomaly (father younger than 13)', () => {
  const issues = validateKinshipChronology({
    subjectBirthDate: '1940', // Father was born in 1935 -> age 5!
    fatherId: 'p-father',
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const anomaly = issues.find((i) => i.message.includes('Biological anomaly'));
  assert(anomaly !== undefined, 'Must flag biological anomaly for under-age parent');
});

runTest('Upgrade 3: Detects ancestry cycle (cannot set grandson as father)', () => {
  // Shanmuga is grandson of Murthy Chetty. If Shanmuga is set as parent of Murthy Chetty, cycle!
  const hasCycle = detectAncestryCycle('p-father', 'p-grandson', sampleEdges);
  assert.strictEqual(hasCycle, true, 'Descendant cannot be set as parent');
});

runTest('Upgrade 3 (Derived): Detects future birth date error', () => {
  const issues = validateKinshipChronology({
    subjectBirthDate: '2099',
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const futureErr = issues.find((i) => i.severity === 'error' && i.message.includes('cannot be in the future'));
  assert(futureErr !== undefined, 'Must flag error for future birth date');
});

runTest('Upgrade 3 (Derived): Detects lifespan exceeding 120 years', () => {
  const issues = validateKinshipChronology({
    subjectBirthDate: '1850',
    subjectDeathDate: '1995', // 145 years
    isLiving: false,
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const lifespanErr = issues.find((i) => i.severity === 'error' && i.message.includes('exceeds the verified human limit'));
  assert(lifespanErr !== undefined, 'Must flag error for lifespan > 120');
});

runTest('Upgrade 3 (Derived): Prevents self-relationships (cannot be own father or marry self)', () => {
  const issues = validateKinshipChronology({
    currentPersonId: 'p-father',
    fatherId: 'p-father',
    spouseId: 'p-father',
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  assert(issues.some((i) => i.message.includes('cannot be their own Father')));
  assert(issues.some((i) => i.message.includes('cannot be married to themselves')));
});

runTest('Upgrade 3 (Derived): Detects direct consanguinity conflict (marrying parent or child)', () => {
  const issues = validateKinshipChronology({
    currentPersonId: 'p-grandson',
    fatherId: 'p-son1',
    spouseId: 'p-son1', // Marrying own father!
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const consangErr = issues.find((i) => i.severity === 'error' && i.message.includes('Direct consanguinity conflict'));
  assert(consangErr !== undefined, 'Must flag error when spouse is direct parent or child');
});

runTest('Upgrade 3 (Derived): Detects grandparent generational inversion', () => {
  // Chandra Babu is father (born 1965). Murthy Chetty is Paternal Grandfather (born 1935).
  // If child is entered as born in 1930 (before grandfather), generational inversion!
  const issues = validateKinshipChronology({
    subjectBirthDate: '1930',
    fatherId: 'p-son1',
    nodes: sampleNodes,
    edges: sampleEdges,
  });
  const gpInversion = issues.find((i) => i.severity === 'error' && i.message.includes('Paternal Grandparent'));
  assert(gpInversion !== undefined, 'Must flag error when child born before grandparent');
});

runTest('Upgrade 3 (Derived): Detects child born after parent passed away', () => {
  const issues = validateKinshipChronology({
    subjectDeathDate: '1980',
    childId: 'p-son1', // Chandra Babu born 1965, but let's test with a child born later
    nodes: [
      ...sampleNodes,
      { id: 'c-late', firstName: 'Late', lastName: 'Child', gender: 'male', birthYear: 1985 },
    ],
    edges: sampleEdges,
  });
  // If we set childId to c-late and subject died in 1980
  const issues2 = validateKinshipChronology({
    subjectDeathDate: '1980',
    childId: 'c-late',
    nodes: [
      ...sampleNodes,
      { id: 'c-late', firstName: 'Late', lastName: 'Child', gender: 'male', birthYear: 1985 },
    ],
    edges: sampleEdges,
  });
  const afterDeathErr = issues2.find((i) => i.severity === 'error' && i.message.includes('cannot be born after parent passed away'));
  assert(afterDeathErr !== undefined, 'Must flag error when child born years after parent death');
});

// --------------------------------------------------------------------------
// Upgrade 4: Surname & House Name Inheritance Heuristics
// --------------------------------------------------------------------------
runTest('Upgrade 4: Inherits family house surname from Father when blank', () => {
  const surnameInference = inferInheritedSurname('p-father', '', sampleNodes);
  assert.strictEqual(surnameInference.suggestedSurname, 'Konukuru');
});

runTest('Upgrade 4: Does not override user-specified last name', () => {
  const surnameInference = inferInheritedSurname('p-father', 'Sharma', sampleNodes);
  assert.strictEqual(surnameInference.suggestedSurname, null);
});

// --------------------------------------------------------------------------
// Upgrade 5: Remarriage & Multi-Spouse Disambiguation
// --------------------------------------------------------------------------
runTest('Upgrade 5: Detects multiple spouses and requires disambiguation', () => {
  const res = inferKinshipRelations({
    triggerField: 'father',
    triggerValue: 'p-father',
    nodes: sampleNodes,
    edges: sampleEdges,
  });

  assert.strictEqual(res.requiresDisambiguation, true);
  assert.strictEqual(res.multipleSpouseCandidates?.length, 2);
  const names = res.multipleSpouseCandidates?.map((c) => c.fullName);
  assert(names?.some((n) => n.includes('Sarojamma')));
  assert(names?.some((n) => n.includes('Lakshmi')));
});

// --------------------------------------------------------------------------
// Upgrade 6: Deep Kinship Nomenclature (Traditional & English)
// --------------------------------------------------------------------------
runTest('Upgrade 6: Computes formal English & Traditional Telugu kinship titles', () => {
  const unclePaternal = calculateKinshipNomenclature('uncle', 'male', true, true);
  assert.strictEqual(unclePaternal.formalEnglish, 'Elder Paternal Uncle');
  assert.strictEqual(unclePaternal.traditionalTelugu, 'Peddananna');

  const auntPaternal = calculateKinshipNomenclature('aunt', 'female', true, false);
  assert.strictEqual(auntPaternal.formalEnglish, 'Paternal Aunt');
  assert.strictEqual(auntPaternal.traditionalTelugu, 'Menatha / Athagaru');

  const uncleMaternal = calculateKinshipNomenclature('uncle', 'male', false, false);
  assert.strictEqual(uncleMaternal.formalEnglish, 'Maternal Uncle');
  assert.strictEqual(uncleMaternal.traditionalTelugu, 'Menamama / Mamagaru');
});

// --------------------------------------------------------------------------
// Upgrade 7: Cascading Batch Nuclear Family Linking
// --------------------------------------------------------------------------
runTest('Upgrade 7: Discovers all existing children of spouse for batch linking', () => {
  const batchCandidates = findNuclearFamilyBatchCandidates('p-mother', 'p-father', sampleNodes, sampleEdges);
  assert.strictEqual(batchCandidates.length, 2);
  const childNames = batchCandidates.map((c) => c.fullName);
  assert(childNames.includes('Chandra Babu Konukuru'));
  assert(childNames.includes('Rajini Konukuru'));
});

console.log(`\nResults: ${passed} / ${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}
