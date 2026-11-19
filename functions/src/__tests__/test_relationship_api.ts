import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { RelationshipService } from '../services/relationship.service';
import { RelationshipController } from '../controllers/relationship.controller';
import { createRelationshipRoutes } from '../routes/relationship.routes';

async function runRelationshipTests() {
  console.log('=== Running Tests for Milestone 2.5 (Relationship Management API) ===\n');
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

  // 1. Setup isolated temporary data directory seeded with existing 14 persons and 21 relationships
  const rootDataDir = path.resolve(__dirname, '../../../data');
  const tempTestDir = path.resolve(__dirname, '../../../data/__rel_test_data__');
  await fs.mkdir(tempTestDir, { recursive: true });

  const seedPersons = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
  const seedRels = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');

  await fs.writeFile(path.join(tempTestDir, 'persons.json'), seedPersons, 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), seedRels, 'utf-8');

  // 2. Instantiate test repository, service, controller, and express app
  const testRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  const testService = new RelationshipService(testRepo);
  const testController = new RelationshipController(testService);
  const testRoutes = createRelationshipRoutes(testController);

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  testApp.use('/api/relationships', testRoutes);

  // 3. Start test HTTP server
  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/relationships`;

  try {
    // --- Test 1: GET /api/relationships (Initial state) ---
    const res1 = await fetch(baseUrl);
    assert(res1.status === 200, 'GET /api/relationships returns 200');
    const data1 = await res1.json();
    assert(data1.success === true, 'Response has success: true');
    assert(Array.isArray(data1.data) && data1.data.length === 29, `Expected 29 relationships, got ${data1.data.length}`);

    // --- Test 2: GET /api/relationships?personId=... (Filter by person) ---
    const murthyId = '867842c1-b8a2-45ad-8d9c-89150e68eb16';
    const resFilterPerson = await fetch(`${baseUrl}?personId=${murthyId}`);
    assert(resFilterPerson.status === 200, 'GET /api/relationships?personId= returns 200');
    const dataFilterPerson = await resFilterPerson.json();
    assert(dataFilterPerson.data.length === 5, `Expected 5 relationships for Murthy Chetty, got ${dataFilterPerson.data.length}`);

    // --- Test 3: GET /api/relationships?relationshipType=spouse ---
    const resFilterSpouse = await fetch(`${baseUrl}?relationshipType=spouse`);
    assert(resFilterSpouse.status === 200, 'GET /api/relationships?relationshipType=spouse returns 200');
    const dataFilterSpouse = await resFilterSpouse.json();
    assert(dataFilterSpouse.data.length === 6, `Expected 6 spouse relationships, got ${dataFilterSpouse.data.length}`);

    // --- Test 4: GET /api/relationships/:id (Existing relationship) ---
    const existingRelId = data1.data[0].id;
    const resGet = await fetch(`${baseUrl}/${existingRelId}`);
    assert(resGet.status === 200, 'GET /api/relationships/:id returns 200');
    const dataGet = await resGet.json();
    assert(dataGet.data.id === existingRelId, 'Retrieved relationship ID matches');

    // --- Test 5: GET /api/relationships/:id (Nonexistent UUID -> 404) ---
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const resGet404 = await fetch(`${baseUrl}/${fakeId}`);
    assert(resGet404.status === 404, 'GET nonexistent relationship returns 404');
    const dataGet404 = await resGet404.json();
    assert(dataGet404.error.code === 'RELATIONSHIP_NOT_FOUND', 'Returns RELATIONSHIP_NOT_FOUND code');

    // --- Test 6: GET /api/relationships/:id (Invalid UUID -> 400) ---
    const resInvalidUuid = await fetch(`${baseUrl}/not-a-valid-uuid`);
    assert(resInvalidUuid.status === 400, 'GET with invalid UUID returns 400');
    const dataInvalidUuid = await resInvalidUuid.json();
    assert(dataInvalidUuid.error.code === 'INVALID_UUID', 'Returns INVALID_UUID code');

    // --- Test 7: POST /api/relationships (Reject client-supplied ID -> 400) ---
    const resSuppliedId = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: fakeId,
        person_id: murthyId,
        related_person_id: '4a80001b-76bf-4e13-963b-89b2aafbb413',
        relationship_type: 'spouse',
      }),
    });
    assert(resSuppliedId.status === 400, 'POST with client-supplied ID returns 400');
    const dataSuppliedId = await resSuppliedId.json();
    assert(dataSuppliedId.error.code === 'CLIENT_ID_NOT_ALLOWED', 'Returns CLIENT_ID_NOT_ALLOWED code');

    // --- Test 8: POST /api/relationships (Missing / Nonexistent Person -> 404) ---
    const resMissingPerson = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: fakeId,
        related_person_id: murthyId,
        relationship_type: 'parent',
        parent_type: 'biological',
      }),
    });
    assert(resMissingPerson.status === 404, 'POST with nonexistent person_id returns 404');

    // --- Test 9: POST /api/relationships (Self-relation rejection -> 400) ---
    const resSelfRel = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: murthyId,
        related_person_id: murthyId,
        relationship_type: 'parent',
        parent_type: 'biological',
      }),
    });
    assert(resSelfRel.status === 400, 'POST with self-relation returns 400');

    // --- Test 10: POST /api/relationships (Duplicate parent rejection -> 409) ---
    // Jagannadham (b19dee44-9906-4c46-84b6-70d2fa70a5b5) already has Murthy (867842c1) as parent
    const jagannadhamId = 'b19dee44-9906-4c46-84b6-70d2fa70a5b5';
    const resDupParent = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: jagannadhamId,
        related_person_id: murthyId,
        relationship_type: 'parent',
        parent_type: 'biological',
      }),
    });
    assert(resDupParent.status === 409, 'POST duplicate parent relationship returns 409 Conflict');
    const dataDupParent = await resDupParent.json();
    assert(dataDupParent.error.code === 'DUPLICATE_PARENT_RELATIONSHIP', 'Returns DUPLICATE_PARENT_RELATIONSHIP code');

    // --- Test 11: POST /api/relationships (Reverse spouse duplicate rejection -> 409) ---
    // Murthy (person_001) and Sarojamma (person_002) are spouses.
    // Try adding Sarojamma -> Murthy in reverse order
    const sarojammaId = '4a80001b-76bf-4e13-963b-89b2aafbb413';
    const resRevSpouse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: sarojammaId,
        related_person_id: murthyId,
        relationship_type: 'spouse',
      }),
    });
    assert(resRevSpouse.status === 409, 'POST reverse spouse relationship returns 409 Conflict');
    const dataRevSpouse = await resRevSpouse.json();
    assert(dataRevSpouse.error.code === 'DUPLICATE_SPOUSE_RELATIONSHIP', 'Returns DUPLICATE_SPOUSE_RELATIONSHIP code');

    // --- Test 12: POST /api/relationships (Ancestry cycle rejection -> 409) ---
    // Murthy -> Father of Jagannadham. Trying to set Jagannadham as parent of Murthy:
    const resCycle = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: murthyId, // Murthy as child
        related_person_id: jagannadhamId, // Jagannadham as parent -> Cycle!
        relationship_type: 'parent',
        parent_type: 'biological',
      }),
    });
    assert(resCycle.status === 409, 'POST with ancestry cycle returns 409 Conflict');
    const dataCycle = await resCycle.json();
    assert(dataCycle.error.code === 'ANCESTRY_CYCLE_DETECTED', 'Returns ANCESTRY_CYCLE_DETECTED code');

    // --- Test 13: POST /api/relationships (Exceeding max 2 parents policy -> 409) ---
    // Jagannadham already has 2 parents (Murthy and Sarojamma). Try adding a 3rd parent:
    const giriBabuId = 'e2c91ec9-622d-4679-9b06-367754f3b15d';
    const resMaxParents = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: jagannadhamId,
        related_person_id: giriBabuId,
        relationship_type: 'parent',
        parent_type: 'adoptive',
      }),
    });
    assert(resMaxParents.status === 409, 'POST adding 3rd parent returns 409 Conflict under current policy');
    const dataMaxParents = await resMaxParents.json();
    assert(dataMaxParents.error.code === 'MAX_PARENTS_EXCEEDED', 'Returns MAX_PARENTS_EXCEEDED code');

    // --- Test 14: POST /api/relationships (Valid parent relationship) ---
    // Hemanth Etigadda (fee87ccc-4f6c-4437-b6f5-4719d067e104) currently has only 1 parent: Chandrakala.
    // Let's create a new person (father of Hemanth) in temp repo to test adding a valid parent relationship
    const hemanthId = 'fee87ccc-4f6c-4437-b6f5-4719d067e104';
    const tempPersonsRaw = JSON.parse(await fs.readFile(path.join(tempTestDir, 'persons.json'), 'utf-8')).persons;
    const testFatherId = '77777777-7777-4777-8777-777777777777';
    tempPersonsRaw.push({
      id: testFatherId,
      first_name: 'Venkata',
      middle_name: null,
      last_name: 'Etigadda',
      alias: null,
      gender: 'male',
      birth_date: null,
      death_date: null,
      birth_place: null,
      death_place: null,
      profile_photo: null,
      biography: '',
      is_living: true,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    });
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersonsRaw }, null, 2));

    const resAddParent = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: hemanthId, // child
        related_person_id: testFatherId, // parent
        relationship_type: 'parent',
        parent_type: 'biological',
        notes: 'Biological father of Hemanth',
      }),
    });
    assert(resAddParent.status === 201, 'POST valid parent relationship returns 201 Created');
    const dataAddParent = await resAddParent.json();
    assert(dataAddParent.success === true, 'Response has success: true');
    const createdParentRelId = dataAddParent.data.id;
    assert(dataAddParent.data.person_id === hemanthId, 'person_id is child');
    assert(dataAddParent.data.related_person_id === testFatherId, 'related_person_id is parent');

    // --- Test 15: PATCH /api/relationships/:id (Update metadata) ---
    const resPatch = await fetch(`${baseUrl}/${createdParentRelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Updated note: Confirmed via family records.',
        start_date: '1995-01-01',
      }),
    });
    assert(resPatch.status === 200, 'PATCH /api/relationships/:id returns 200');
    const dataPatch = await resPatch.json();
    assert(dataPatch.data.id === createdParentRelId, 'Relationship ID is preserved');
    assert(dataPatch.data.notes === 'Updated note: Confirmed via family records.', 'Notes field updated');
    assert(dataPatch.data.start_date === '1995-01-01', 'start_date updated');
    assert(dataPatch.data.person_id === hemanthId, 'Participants remain strictly unchanged');

    // --- Test 16: PATCH /api/relationships/:id (Reject altering participants or ID -> 400) ---
    const resPatchIllegal = await fetch(`${baseUrl}/${createdParentRelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: murthyId,
      }),
    });
    assert(resPatchIllegal.status === 400, 'PATCH attempting to change participants returns 400 Bad Request');
    const dataPatchIllegal = await resPatchIllegal.json();
    assert(dataPatchIllegal.error.code === 'CANNOT_CHANGE_RELATIONSHIP_PARTICIPANTS', 'Returns CANNOT_CHANGE_RELATIONSHIP_PARTICIPANTS');

    // --- Test 17: DELETE /api/relationships/:id ---
    const resDelete = await fetch(`${baseUrl}/${createdParentRelId}`, {
      method: 'DELETE',
    });
    assert(resDelete.status === 200, 'DELETE /api/relationships/:id returns 200');
    const dataDelete = await resDelete.json();
    assert(dataDelete.data.deleted === true && dataDelete.data.id === createdParentRelId, 'Returns deleted confirmation');

    // Verify relationship was removed from database
    const resGetAfterDelete = await fetch(`${baseUrl}/${createdParentRelId}`);
    assert(resGetAfterDelete.status === 404, 'Deleted relationship no longer retrievable');

    // CRITICAL: Verify neither person was deleted!
    const verifyPersons = JSON.parse(await fs.readFile(path.join(tempTestDir, 'persons.json'), 'utf-8')).persons;
    const hemanthExists = verifyPersons.some((p: any) => p.id === hemanthId);
    const fatherExists = verifyPersons.some((p: any) => p.id === testFatherId);
    assert(hemanthExists && fatherExists, 'CRITICAL: Deleting relationship did NOT delete either person');

    // --- Test 18: Failed-operation data integrity ---
    // Count relationships in temp repo before failed operation
    const relsBeforeFail = JSON.parse(await fs.readFile(path.join(tempTestDir, 'relationships.json'), 'utf-8')).relationships;
    // Trigger a failed relationship creation (ancestry cycle)
    await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        person_id: murthyId,
        related_person_id: jagannadhamId,
        relationship_type: 'parent',
        parent_type: 'biological',
      }),
    });
    const relsAfterFail = JSON.parse(await fs.readFile(path.join(tempTestDir, 'relationships.json'), 'utf-8')).relationships;
    assert(relsBeforeFail.length === relsAfterFail.length, 'Data integrity: Failed operation left JSON data completely uncorrupted');

    // --- Test 19: Original production data verification ---
    const origPersons = JSON.parse(await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8')).persons;
    const origRels = JSON.parse(await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8')).relationships;
    assert(origPersons.length === 19, `Original database has exactly 19 persons (verified: ${origPersons.length})`);
    assert(origRels.length === 29, `Original database has exactly 29 relationships (verified: ${origRels.length})`);

    console.log(`\n🎉 All ${passed}/${total} Milestone 2.5 Relationship API tests PASSED!`);
  } finally {
    server.close();
    // Cleanup temporary test directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  }
}

runRelationshipTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

