import * as path from 'path';
import * as fs from 'fs/promises';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { validateFamilyData, FamilyValidationError } from '../validators/family.validator';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';

async function runTests() {
  console.log('=== Running Tests for Milestones 2.2 & 2.3 ===\n');
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

  // --- Test 1: Validate existing production data in data/persons.json and data/relationships.json ---
  const dataDir = path.resolve(__dirname, '../../../data');
  const repo = new LocalJsonFamilyRepository({ dataDir });

  const persons = await repo.getAllPersons(true);
  assert(persons.length === 19, `Expected 19 persons in database, got ${persons.length}`);

  const activePersons = await repo.getAllPersons(false);
  assert(activePersons.length === 19, `Expected 19 active persons, got ${activePersons.length}`);

  const relationships = await repo.getAllRelationships();
  assert(relationships.length === 29, `Expected 29 relationships in database, got ${relationships.length}`);

  // Test getPersonById
  const person1 = await repo.getPersonById('867842c1-b8a2-45ad-8d9c-89150e68eb16');
  assert(person1 !== null && person1.first_name === 'Murthy', 'getPersonById retrieved Murthy Chetty correctly');

  // Test getRelationshipsForPerson
  const p1Rels = await repo.getRelationshipsForPerson('867842c1-b8a2-45ad-8d9c-89150e68eb16');
  assert(p1Rels.length === 5, `Expected 5 relationships for Murthy Chetty (1 spouse, 4 children), got ${p1Rels.length}`);

  // --- Test 2: Validation Rule — Duplicate Person ID ---
  let duplicatePersonIdThrew = false;
  try {
    const invalidPersons: Person[] = [
      ...persons,
      { ...persons[0] } // duplicate ID
    ];
    validateFamilyData(invalidPersons, relationships);
  } catch (err: any) {
    duplicatePersonIdThrew = err instanceof FamilyValidationError && err.code === 'DUPLICATE_PERSON_ID';
  }
  assert(duplicatePersonIdThrew, 'Duplicate Person ID was properly rejected');

  // --- Test 3: Validation Rule — Unknown Parent ID (Referential Integrity) ---
  let unknownParentThrew = false;
  try {
    const invalidRels: Relationship[] = [
      ...relationships,
      {
        id: '11111111-1111-4111-8111-111111111111',
        person_id: persons[0].id,
        related_person_id: '99999999-9999-4999-8999-999999999999', // Nonexistent
        relationship_type: 'parent',
        parent_type: 'biological',
        start_date: null,
        end_date: null,
        notes: null,
        created_at: new Date().toISOString()
      }
    ];
    validateFamilyData(persons, invalidRels);
  } catch (err: any) {
    unknownParentThrew = err instanceof FamilyValidationError && err.code === 'UNKNOWN_PERSON_REFERENCE';
  }
  assert(unknownParentThrew, 'Unknown Parent ID was properly rejected');

  // --- Test 4: Validation Rule — Person as Own Parent ---
  let selfParentThrew = false;
  try {
    const invalidRels: Relationship[] = [
      ...relationships,
      {
        id: '22222222-2222-4222-8222-222222222222',
        person_id: persons[0].id,
        related_person_id: persons[0].id, // Self parent
        relationship_type: 'parent',
        parent_type: 'biological',
        start_date: null,
        end_date: null,
        notes: null,
        created_at: new Date().toISOString()
      }
    ];
    validateFamilyData(persons, invalidRels);
  } catch (err: any) {
    selfParentThrew = err instanceof FamilyValidationError && (err.code === 'INVALID_RELATIONSHIP_DATA' || err.code === 'SELF_RELATION_NOT_ALLOWED');
  }
  assert(selfParentThrew, 'Person as own parent was properly rejected');

  // --- Test 5: Validation Rule — Person as Own Spouse ---
  let selfSpouseThrew = false;
  try {
    const invalidRels: Relationship[] = [
      ...relationships,
      {
        id: '33333333-3333-4333-8333-333333333333',
        person_id: persons[0].id,
        related_person_id: persons[0].id, // Self spouse
        relationship_type: 'spouse',
        parent_type: null,
        start_date: null,
        end_date: null,
        notes: null,
        created_at: new Date().toISOString()
      }
    ];
    validateFamilyData(persons, invalidRels);
  } catch (err: any) {
    selfSpouseThrew = err instanceof FamilyValidationError && (err.code === 'INVALID_RELATIONSHIP_DATA' || err.code === 'SELF_RELATION_NOT_ALLOWED');
  }
  assert(selfSpouseThrew, 'Person as own spouse was properly rejected');

  // --- Test 6: Validation Rule — Duplicate Parent Relationship ---
  let duplicateParentThrew = false;
  try {
    const existingParentRel = relationships.find(r => r.relationship_type === 'parent')!;
    const duplicateRel: Relationship = {
      ...existingParentRel,
      id: '44444444-4444-4444-8444-444444444444' // different ID, same parent-child edge
    };
    validateFamilyData(persons, [...relationships, duplicateRel]);
  } catch (err: any) {
    duplicateParentThrew = err instanceof FamilyValidationError && err.code === 'DUPLICATE_PARENT_RELATIONSHIP';
  }
  assert(duplicateParentThrew, 'Duplicate Parent relationship was properly rejected');

  // --- Test 7: Validation Rule — Duplicate Spouse Relationship (Symmetric) ---
  let duplicateSpouseThrew = false;
  try {
    const existingSpouseRel = relationships.find(r => r.relationship_type === 'spouse')!;
    // Invert person_id and related_person_id to test symmetric duplicate detection
    const invertedSpouseRel: Relationship = {
      id: '55555555-5555-4555-8555-555555555555',
      person_id: existingSpouseRel.related_person_id,
      related_person_id: existingSpouseRel.person_id,
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString()
    };
    validateFamilyData(persons, [...relationships, invertedSpouseRel]);
  } catch (err: any) {
    duplicateSpouseThrew = err instanceof FamilyValidationError && err.code === 'DUPLICATE_SPOUSE_RELATIONSHIP';
  }
  assert(duplicateSpouseThrew, 'Symmetric duplicate spouse relationship was properly rejected');

  // --- Test 8: Validation Rule — Ancestry Cycle Detection ---
  let ancestryCycleThrew = false;
  try {
    // Child: b19dee44 (Jagannadham) -> Parent: 867842c1 (Murthy Chetty) already exists.
    // Try to make Murthy Chetty's parent be Jagannadham!
    const cycleRel: Relationship = {
      id: '66666666-6666-4666-8666-666666666666',
      person_id: '867842c1-b8a2-45ad-8d9c-89150e68eb16', // Murthy Chetty (child)
      related_person_id: 'b19dee44-9906-4c46-84b6-70d2fa70a5b5', // Jagannadham (parent)
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString()
    };
    validateFamilyData(persons, [...relationships, cycleRel]);
  } catch (err: any) {
    ancestryCycleThrew = err instanceof FamilyValidationError && err.code === 'ANCESTRY_CYCLE_DETECTED';
  }
  assert(ancestryCycleThrew, 'Ancestry cycle (Father becoming child of his Son) was detected and rejected');

  // --- Test 9: Validation Rule — Living Person with Death Date Consistency ---
  let livingWithDeathDateThrew = false;
  try {
    const invalidPerson: Person = {
      ...persons[2], // Jagannadham (living)
      death_date: '2026-11-16' // Inconsistent!
    };
    validateFamilyData([invalidPerson, ...persons.slice(1)], relationships);
  } catch (err: any) {
    livingWithDeathDateThrew = err instanceof FamilyValidationError && err.code === 'INVALID_PERSON_DATA';
  }
  assert(livingWithDeathDateThrew, 'Living person with a death date was properly rejected');

  // --- Test 10: Storage Concurrency Protection (Optimistic Locking) ---
  const initialVersion = await repo.getVersion();
  let concurrentConflictThrew = false;
  try {
    await repo.saveFamilyData(persons, relationships, initialVersion + 999);
  } catch (err: any) {
    concurrentConflictThrew = err instanceof FamilyValidationError && err.code === 'CONCURRENT_MODIFICATION_ERROR';
  }
  assert(concurrentConflictThrew, 'Optimistic concurrency version conflict was detected and rejected');

  // --- Test 11: Atomic Safe Writes in Temp Test Directory ---
  const tempTestDir = path.resolve(__dirname, '../../../data/__test_repo__');
  await fs.mkdir(tempTestDir, { recursive: true });

  const tempRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  // Initialize temp repo with existing valid data
  await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons }), 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), JSON.stringify({ relationships }), 'utf-8');

  const curVer = await tempRepo.getVersion();
  const saveRes = await tempRepo.saveFamilyData(persons, relationships, curVer);
  assert(saveRes.version === curVer + 1, 'Data saved safely with version increment');

  const loadedPersons = await tempRepo.getAllPersons(true);
  assert(loadedPersons.length === 19, 'Reloaded persons after atomic save intact');

  // Cleanup temp test directory
  await fs.rm(tempTestDir, { recursive: true, force: true });

  console.log(`\n🎉 All ${passed}/${total} validation and repository tests PASSED!`);
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
