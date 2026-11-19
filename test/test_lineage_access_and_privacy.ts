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
import { normalizeDateInput } from '../src/utils/dateUtils.ts';
import { CreatePersonSchema } from '../functions/src/validators/person.validator.ts';
import { GraphService } from '../functions/src/graph/graph.service.ts';
import { LocalJsonFamilyRepository } from '../functions/src/repositories/local-json.repository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;

async function it(desc: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✓ PASS: ${desc}`);
  } catch (err: any) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
  }
}

async function runAll() {
  console.log('=== Running Tests for Lineage Privacy, Multi-House Access & Parallel Viewing ===\n');

  // Section 1: Known Lineage Registry & Codes
  await it('Konukuru lineage is registered with code KONU1290', () => {
    const konukuru = KNOWN_LINEAGES.konukuru;
    assert.ok(konukuru, 'Konukuru lineage should exist');
    assert.strictEqual(konukuru.code, 'KONU1290');
    assert.strictEqual(konukuru.memberCount, 14);
    assert.strictEqual(konukuru.name, 'House of Konukuru');
  });

  await it('Paradarami lineage is registered with code PARA1290', () => {
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

  await it('Valid code KONU1290 unlocks House of Konukuru', () => {
    const res = simulateUnlock('KONU1290');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.lineageId, 'konukuru');
  });

  await it('Valid code PARA1290 unlocks House of Paradarami', () => {
    const res = simulateUnlock('PARA1290');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.lineageId, 'paradarami');
  });

  await it('Code unlocking is case-insensitive', () => {
    const res1 = simulateUnlock('konu1290');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.lineageId, 'konukuru');

    const res2 = simulateUnlock('para1290');
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.lineageId, 'paradarami');
  });

  await it('Invalid codes are rejected', () => {
    const res = simulateUnlock('RANDOM9999');
    assert.strictEqual(res.success, false);
    assert.ok(res.error?.includes('Invalid'));
  });

  // Section 3: Depth-1 Ancestral Verification (Mom's Parents)
  await it('Maternal depth-1 parents strictly contain mom\'s father and mother', () => {
    assert.strictEqual(PARADARAMI_DEPTH1_PARENTS.length, 2);

    const father = PARADARAMI_DEPTH1_PARENTS.find((p) => p.gender === 'male');
    assert.ok(father, 'Mom\'s father should be present');
    assert.strictEqual(father.firstName, 'Ramayya');
    assert.strictEqual(father.middleName, 'Chetty');
    assert.strictEqual(father.lastName, 'Paradarami');
    assert.strictEqual(father.relation, 'Maternal Grandfather (Mom\'s Father)');

    const mother = PARADARAMI_DEPTH1_PARENTS.find((p) => p.gender === 'female');
    assert.ok(mother, 'Mom\'s mother should be present');
    assert.strictEqual(mother.firstName, 'Achamma');
    assert.strictEqual(mother.lastName, 'Paradarami');
    assert.strictEqual(mother.relation, 'Maternal Grandmother (Mom\'s Mother)');
  });

  await it('LINEAGE_PARENTS_BY_PERSON maps Suguna Konukuru to Ramayya Chetty & Achamma Paradarami', () => {
    const sugunaId = '5c561a7d-3fee-4112-af6e-286f7a8ad61b';
    const info = LINEAGE_PARENTS_BY_PERSON[sugunaId];
    assert.ok(info, 'Suguna must be in LINEAGE_PARENTS_BY_PERSON');
    assert.strictEqual(info.lineageId, 'paradarami');
    assert.strictEqual(info.father.firstName, 'Ramayya');
    assert.strictEqual(info.father.middleName, 'Chetty');
    assert.strictEqual(info.father.lastName, 'Paradarami');
    assert.strictEqual(info.mother.firstName, 'Achamma');
    assert.strictEqual(info.mother.lastName, 'Paradarami');
    assert.strictEqual(info.lineageName, 'House of Paradarami');
  });

  // Section 4: Flexible Date Handling (Year-only & Full ISO)
  await it('normalizeDateInput accepts 4-digit year as well as standard dates', () => {
    assert.strictEqual(normalizeDateInput('1947'), '1947');
    assert.strictEqual(normalizeDateInput('2022'), '2022');
    assert.strictEqual(normalizeDateInput('1947-06-15'), '1947-06-15');
    assert.strictEqual(normalizeDateInput('15-06-1947'), '1947-06-15');
    assert.strictEqual(normalizeDateInput('15/06/1947'), '1947-06-15');
    assert.strictEqual(normalizeDateInput(''), null);
    assert.strictEqual(normalizeDateInput(undefined), null);
  });

  await it('CreatePersonSchema accepts year-only dates without validation error', () => {
    const personYearOnly = {
      first_name: 'Test',
      last_name: 'Person',
      gender: 'male' as const,
      birth_date: '1947',
      is_living: false,
      death_date: '2022',
    };
    const result = CreatePersonSchema.safeParse(personYearOnly);
    assert.strictEqual(result.success, true, `Expected validation to pass, errors: ${!result.success ? JSON.stringify(result.error) : ''}`);
  });

  // Section 4: Paradarami Lineage Layout Generator
  await it('getParadaramiLayout generates valid structured layout', () => {
    const layout = getParadaramiLayout();
    assert.ok(layout, 'Layout must be generated');
    assert.ok(Array.isArray(layout.lanes), 'Lanes must be an array');
    assert.ok(layout.lanes.length >= 4, 'Must have at least 4 generations');
    assert.ok(Array.isArray(layout.nodes), 'Nodes must be an array');
    assert.ok(Array.isArray(layout.edges), 'Edges must be an array');

    // Verify Suguna is connected as child of Ramayya Chetty
    const sugunaNode = layout.nodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b');
    assert.ok(sugunaNode, 'Suguna must be present in Paradarami tree');
    assert.strictEqual(sugunaNode.firstName, 'Suguna');

    const parentChildEdge = layout.edges.find(
      (e) => e.source === '1ae73a4b-b739-40d3-8b50-071bbf1b07eb' && e.target === '5c561a7d-3fee-4112-af6e-286f7a8ad61b'
    );
    assert.ok(parentChildEdge, 'Parent-child edge between Ramayya Chetty and Suguna must exist');
  });

  // Section 5: Canonical DB Immutability
  await it('Canonical persons.json database has exactly 16 persons (14 Konukuru + 2 Paradarami parents)', () => {
    const personsPath = path.join(projectRoot, 'data', 'persons.json');
    const data = JSON.parse(fs.readFileSync(personsPath, 'utf8'));
    const list = Array.isArray(data) ? data : data.persons;
    assert.strictEqual(list.length, 16);
  });

  await it('Canonical relationships.json database has exactly 24 relationships', () => {
    const relPath = path.join(projectRoot, 'data', 'relationships.json');
    const data = JSON.parse(fs.readFileSync(relPath, 'utf8'));
    const list = Array.isArray(data) ? data : data.relationships;
    assert.strictEqual(list.length, 24);
  });

  // Section 6: Main House Partitioning & Surnamed External Lineage Hiding
  await it('GraphService partitions Konukuru tree: hides Paradarami parents while keeping Chandrakala Etigadda', async () => {
    const repo = new LocalJsonFamilyRepository({ dataDir: path.join(projectRoot, 'data') });
    const graphService = new GraphService(repo);
    const graph = await graphService.buildFamilyGraph();

    // 1. Exactly 14 nodes in the main Konukuru family tree
    assert.strictEqual(graph.nodes.length, 14, `Expected 14 nodes in Konukuru tree, got ${graph.nodes.length}`);

    // 2. Chandrakala Etigadda is included (daughter of Konukuru, surname Etigadda)
    const chandrakala = graph.nodes.find((n) => n.id === 'f265d0e1-7cea-4273-b907-7dbf3bc907e8');
    assert.ok(chandrakala, 'Chandrakala Etigadda must be present in the main tree');
    assert.strictEqual(chandrakala.lastName, 'Etigadda');
    assert.strictEqual(chandrakala.hasExternalLineage, false, 'Chandrakala has parents on main tree so hasExternalLineage is false');

    // 3. Hemanth Etigadda is included
    const hemanth = graph.nodes.find((n) => n.id === 'fee87ccc-4f6c-4437-b6f5-4719d067e104');
    assert.ok(hemanth, 'Hemanth Etigadda must be present in the main tree');

    // 4. Ramayya Chetty & Achamma Paradarami are HIDDEN from main tree by default
    const ramayya = graph.nodes.find((n) => n.id === '1ae73a4b-b739-40d3-8b50-071bbf1b07eb');
    assert.strictEqual(ramayya, undefined, 'Ramayya Chetty Paradarami must be hidden from main tree');

    const achamma = graph.nodes.find((n) => n.id === 'e66d2d0d-7349-4b5e-8f79-b6d9dba69e0b');
    assert.strictEqual(achamma, undefined, 'Achamma Paradarami must be hidden from main tree');

    // 5. Suguna has hasExternalLineage: true with Ramayya & Achamma in externalLineage
    const suguna = graph.nodes.find((n) => n.id === '5c561a7d-3fee-4112-af6e-286f7a8ad61b');
    assert.ok(suguna, 'Suguna must be in the main tree');
    assert.strictEqual(suguna.hasExternalLineage, true, 'Suguna must have hasExternalLineage: true');
    assert.ok(suguna.externalLineage, 'Suguna must have externalLineage populated');
    assert.strictEqual(suguna.externalLineage.father.firstName, 'Ramayya');
    assert.strictEqual(suguna.externalLineage.father.lastName, 'Paradarami');
    assert.strictEqual(suguna.externalLineage.mother.firstName, 'Achamma');
    assert.strictEqual(suguna.externalLineage.mother.lastName, 'Paradarami');
  });

  console.log(`\n======================================================`);
  console.log(`Lineage Access Test Suite: ${passedTests}/${totalTests} assertions passed!`);
  console.log(`======================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
