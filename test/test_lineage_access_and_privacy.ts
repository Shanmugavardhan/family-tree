import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KNOWN_LINEAGES,
  PARADARAMI_DEPTH1_PARENTS,
  getParadaramiLayout,
} from '../src/types/lineage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

function it(desc: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ PASS: ${desc}`);
  } catch (err: any) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
  }
}

console.log('=== Running Tests for Lineage Privacy, Multi-House Access & Parallel Viewing ===\n');

// Section 1: Known Lineage Registry & Codes
it('Konukuru lineage is registered with code KONU1290', () => {
  const konukuru = KNOWN_LINEAGES.konukuru;
  assert.ok(konukuru, 'Konukuru lineage should exist');
  assert.strictEqual(konukuru.code, 'KONU1290');
  assert.strictEqual(konukuru.memberCount, 14);
  assert.strictEqual(konukuru.name, 'House of Konukuru');
});

it('Paradarami lineage is registered with code PARA1290', () => {
  const paradarami = KNOWN_LINEAGES.paradarami;
  assert.ok(paradarami, 'Paradarami lineage should exist');
  assert.strictEqual(paradarami.code, 'PARA1290');
  assert.strictEqual(paradarami.memberCount, 8);
  assert.strictEqual(paradarami.name, 'House of Paradarami');
});

// Section 2: Code Validation and Unlocking Logic
function simulateUnlock(inputCode: string): { success: boolean; lineageId?: string; error?: string } {
  const trimmed = inputCode.trim().toUpperCase();
  if (!trimmed) return { success: false, error: 'Please enter a family access code.' };

  for (const [id, info] of Object.entries(KNOWN_LINEAGES)) {
    if (info.code.toUpperCase() === trimmed) {
      return { success: true, lineageId: id };
    }
  }
  return { success: false, error: 'Invalid family code.' };
}

it('Valid code KONU1290 unlocks House of Konukuru', () => {
  const res = simulateUnlock('KONU1290');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.lineageId, 'konukuru');
});

it('Valid code PARA1290 unlocks House of Paradarami', () => {
  const res = simulateUnlock('PARA1290');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.lineageId, 'paradarami');
});

it('Code unlocking is case-insensitive', () => {
  const res1 = simulateUnlock('konu1290');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.lineageId, 'konukuru');

  const res2 = simulateUnlock('para1290');
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.lineageId, 'paradarami');
});

it('Invalid codes are rejected', () => {
  const res = simulateUnlock('RANDOM9999');
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes('Invalid'));
});

// Section 3: Depth-1 Ancestral Verification (Mom\'s Parents)
it('Maternal depth-1 parents strictly contain mom\'s father and mother', () => {
  assert.strictEqual(PARADARAMI_DEPTH1_PARENTS.length, 2);

  const father = PARADARAMI_DEPTH1_PARENTS.find((p) => p.gender === 'male');
  assert.ok(father, 'Mom\'s father should be present');
  assert.strictEqual(father.firstName, 'Gopal');
  assert.strictEqual(father.lastName, 'Paradarami');
  assert.strictEqual(father.relation, 'Maternal Grandfather (Mom\'s Father)');

  const mother = PARADARAMI_DEPTH1_PARENTS.find((p) => p.gender === 'female');
  assert.ok(mother, 'Mom\'s mother should be present');
  assert.strictEqual(mother.firstName, 'Rukminamma');
  assert.strictEqual(mother.lastName, 'Paradarami');
  assert.strictEqual(mother.relation, 'Maternal Grandmother (Mom\'s Mother)');
});

// Section 4: Paradarami Lineage Layout Generator
it('getParadaramiLayout generates valid structured layout', () => {
  const layout = getParadaramiLayout();
  assert.ok(layout, 'Layout must be generated');
  assert.ok(Array.isArray(layout.lanes), 'Lanes must be an array');
  assert.ok(layout.lanes.length >= 4, 'Must have at least 4 generations');
  assert.ok(Array.isArray(layout.nodes), 'Nodes must be an array');
  assert.ok(Array.isArray(layout.edges), 'Edges must be an array');

  // Verify Suguna is connected as child of Gopal Chetty
  const sugunaNode = layout.nodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b');
  assert.ok(sugunaNode, 'Suguna must be present in Paradarami tree');
  assert.strictEqual(sugunaNode.firstName, 'Suguna');

  const parentChildEdge = layout.edges.find(
    (e) => e.source === 'paradarami-gopal-chetty' && e.target === '5c561a7d-3fee-4112-af6e-286f7a8ad61b'
  );
  assert.ok(parentChildEdge, 'Parent-child edge between Gopal Chetty and Suguna must exist');
});

// Section 5: Canonical DB Immutability
it('Canonical persons.json database remains intact with exactly 14 persons', () => {
  const personsPath = path.join(projectRoot, 'data', 'persons.json');
  const data = JSON.parse(fs.readFileSync(personsPath, 'utf8'));
  const list = Array.isArray(data) ? data : data.persons;
  assert.strictEqual(list.length, 14);
});

it('Canonical relationships.json database remains intact with exactly 21 relationships', () => {
  const relPath = path.join(projectRoot, 'data', 'relationships.json');
  const data = JSON.parse(fs.readFileSync(relPath, 'utf8'));
  const list = Array.isArray(data) ? data : data.relationships;
  assert.strictEqual(list.length, 21);
});

console.log(`\n======================================================`);
console.log(`Lineage Access Test Suite: ${passedTests}/${totalTests} assertions passed!`);
console.log(`======================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
