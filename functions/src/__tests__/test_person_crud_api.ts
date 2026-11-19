import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { PersonService } from '../services/person.service';
import { PersonController } from '../controllers/person.controller';
import { createPersonRoutes } from '../routes/person.routes';

async function runPersonCrudTests() {
  console.log('=== Running Tests for Milestone 2.4 (Person CRUD & API) ===\n');
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
  const tempTestDir = path.resolve(__dirname, '../../../data/__crud_test_data__');
  await fs.mkdir(tempTestDir, { recursive: true });

  const seedPersons = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
  const seedRels = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');

  await fs.writeFile(path.join(tempTestDir, 'persons.json'), seedPersons, 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), seedRels, 'utf-8');

  // 2. Instantiate test repository, service, controller, and express app
  const testRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  const testService = new PersonService(testRepo);
  const testController = new PersonController(testService);
  const testRoutes = createPersonRoutes(testController);

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  testApp.use('/api/persons', testRoutes);

  // 3. Start test HTTP server
  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/persons`;

  try {
    // --- Test 1: GET /api/persons (Initial state) ---
    const res1 = await fetch(baseUrl);
    assert(res1.status === 200, 'GET /api/persons returns 200');
    const data1 = await res1.json();
    assert(data1.success === true, 'Response has success: true');
    assert(Array.isArray(data1.data) && data1.data.length === 16, `Expected 16 persons, got ${data1.data.length}`);

    // --- Test 2: GET /api/persons with search query ---
    const resSearch = await fetch(`${baseUrl}?search=Meghana`);
    assert(resSearch.status === 200, 'GET /api/persons?search= returns 200');
    const dataSearch = await resSearch.json();
    assert(dataSearch.data.length === 1 && dataSearch.data[0].first_name === 'Meghana', 'Search query returned Meghana');

    // --- Test 3: GET /api/persons/:id (Existing person) ---
    const murthyId = '867842c1-b8a2-45ad-8d9c-89150e68eb16';
    const resGet = await fetch(`${baseUrl}/${murthyId}`);
    assert(resGet.status === 200, 'GET /api/persons/:id returns 200');
    const dataGet = await resGet.json();
    assert(dataGet.data.id === murthyId && dataGet.data.first_name === 'Murthy', 'Retrieved Murthy Chetty correctly');

    // --- Test 4: GET /api/persons/:id (Nonexistent person -> 404) ---
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const resGet404 = await fetch(`${baseUrl}/${fakeId}`);
    assert(resGet404.status === 404, 'GET nonexistent person returns 404');
    const dataGet404 = await resGet404.json();
    assert(dataGet404.success === false && dataGet404.error.code === 'PERSON_NOT_FOUND', 'Returns PERSON_NOT_FOUND code');

    // --- Test 5: GET /api/persons/:id (Invalid UUID -> 400) ---
    const resInvalidUuid = await fetch(`${baseUrl}/not-a-valid-uuid`);
    assert(resInvalidUuid.status === 400, 'GET with invalid UUID returns 400');
    const dataInvalidUuid = await resInvalidUuid.json();
    assert(dataInvalidUuid.error.code === 'INVALID_UUID', 'Returns INVALID_UUID error code');

    // --- Test 6: POST /api/persons (Reject client-supplied ID -> 400) ---
    const resSuppliedId = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: '12345678-1234-4234-8234-123456789012',
        first_name: 'Hacked',
        last_name: 'User',
        gender: 'male',
      }),
    });
    assert(resSuppliedId.status === 400, 'POST with client-supplied ID returns 400');
    const dataSuppliedId = await resSuppliedId.json();
    assert(dataSuppliedId.error.code === 'CLIENT_ID_NOT_ALLOWED', 'Returns CLIENT_ID_NOT_ALLOWED code');

    // --- Test 7: POST /api/persons (Validation failure: missing required first_name -> 400) ---
    const resMissingFirst = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gender: 'female',
      }),
    });
    assert(resMissingFirst.status === 400, 'POST with missing required field returns 400');

    // --- Test 8: POST /api/persons (Validation failure: living person with death_date -> 400) ---
    const resLivingDeath = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Test',
        gender: 'male',
        is_living: true,
        death_date: '2026-01-01',
      }),
    });
    assert(resLivingDeath.status === 400, 'POST with living person + death date returns 400');

    // --- Test 9: POST /api/persons (Create person with parents atomically) ---
    // Jagannadham is father (b19dee44-9906-4c46-84b6-70d2fa70a5b5), Suguna is mother (5c561a7d-3fee-4112-af6e-286f7a8ad61b)
    const fatherId = 'b19dee44-9906-4c46-84b6-70d2fa70a5b5';
    const motherId = '5c561a7d-3fee-4112-af6e-286f7a8ad61b';

    const resCreate = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Ananya',
        middle_name: null,
        last_name: 'Konukuru',
        gender: 'female',
        birth_date: '2010-08-15',
        birth_place: 'Tirupati',
        biography: 'Youngest family member.',
        is_living: true,
        father_id: fatherId,
        mother_id: motherId,
      }),
    });
    assert(resCreate.status === 201, 'POST /api/persons returns 201 Created');
    const dataCreate = await resCreate.json();
    assert(dataCreate.success === true, 'Create response has success: true');
    const newPersonId = dataCreate.data.id;
    assert(typeof newPersonId === 'string' && newPersonId.length === 36, 'Server generated permanent UUID');
    assert(dataCreate.data.first_name === 'Ananya', 'First name matches');
    assert(dataCreate.data.is_archived === false, 'Default is_archived is false');
    assert(dataCreate.data.archived_at === null, 'Default archived_at is null');

    // Verify parent relationships were created atomically
    const newPersonRels = await testRepo.getRelationshipsForPerson(newPersonId);
    assert(newPersonRels.length === 2, `Expected 2 parent relationships for Ananya, got ${newPersonRels.length}`);
    const hasFatherRel = newPersonRels.some(
      (r) => r.person_id === newPersonId && r.related_person_id === fatherId && r.relationship_type === 'parent'
    );
    const hasMotherRel = newPersonRels.some(
      (r) => r.person_id === newPersonId && r.related_person_id === motherId && r.relationship_type === 'parent'
    );
    assert(hasFatherRel && hasMotherRel, 'Both father and mother relationships created atomically');

    // --- Test 10: POST /api/persons with nonexistent parent ID -> 404 ---
    const resBadParent = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Ghost',
        gender: 'male',
        father_id: fakeId,
      }),
    });
    assert(resBadParent.status === 404, 'POST with nonexistent parent ID returns 404');

    // --- Test 11: PATCH /api/persons/:id (Update personal details) ---
    const resPatch = await fetch(`${baseUrl}/${newPersonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: 'Chinnu',
        biography: 'Updated biography: aspiring scientist.',
      }),
    });
    assert(resPatch.status === 200, 'PATCH /api/persons/:id returns 200');
    const dataPatch = await resPatch.json();
    assert(dataPatch.data.id === newPersonId, 'ID preserved after update');
    assert(dataPatch.data.alias === 'Chinnu', 'Alias updated');
    assert(dataPatch.data.biography === 'Updated biography: aspiring scientist.', 'Biography updated');

    // Requirement 8: Ensure relationships were NOT touched during profile update
    const relsAfterPatch = await testRepo.getRelationshipsForPerson(newPersonId);
    assert(relsAfterPatch.length === 2, 'Relationships preserved intact after profile update');

    // --- Test 12: PATCH /api/persons/:id (Attempt to change ID -> 400) ---
    const resPatchId = await fetch(`${baseUrl}/${newPersonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: fakeId,
        first_name: 'New Name',
      }),
    });
    assert(resPatchId.status === 400, 'PATCH attempting to change ID returns 400');
    const dataPatchId = await resPatchId.json();
    assert(dataPatchId.error.code === 'CANNOT_CHANGE_ID', 'Returns CANNOT_CHANGE_ID code');

    // --- Test 13: POST /api/persons/:id/archive (Archive person) ---
    const resArchive = await fetch(`${baseUrl}/${newPersonId}/archive`, {
      method: 'POST',
    });
    assert(resArchive.status === 200, 'POST /api/persons/:id/archive returns 200');
    const dataArchive = await resArchive.json();
    assert(dataArchive.data.is_archived === true, 'Person is now archived');
    assert(dataArchive.data.archived_at !== null, 'archived_at timestamp populated');

    // Verify archived person is excluded from default list
    const resListAfterArchive = await fetch(baseUrl);
    const dataListAfterArchive = await resListAfterArchive.json();
    const isExcluded = !dataListAfterArchive.data.some((p: any) => p.id === newPersonId);
    assert(isExcluded, 'Archived person is excluded from default GET /api/persons');

    // Verify archived person is included when includeArchived=true
    const resListWithArchived = await fetch(`${baseUrl}?includeArchived=true`);
    const dataListWithArchived = await resListWithArchived.json();
    const isIncluded = dataListWithArchived.data.some((p: any) => p.id === newPersonId);
    assert(isIncluded, 'Archived person is returned when includeArchived=true');

    // Verify archived person GET by ID returns 404 without includeArchived
    const resGetArchivedHidden = await fetch(`${baseUrl}/${newPersonId}`);
    assert(resGetArchivedHidden.status === 404, 'GET archived person without includeArchived returns 404');

    const resGetArchivedVisible = await fetch(`${baseUrl}/${newPersonId}?includeArchived=true`);
    assert(resGetArchivedVisible.status === 200, 'GET archived person with includeArchived=true returns 200');

    // Attempting to archive already archived person -> 409 Conflict
    const resReArchive = await fetch(`${baseUrl}/${newPersonId}/archive`, { method: 'POST' });
    assert(resReArchive.status === 409, 'Re-archiving an already archived person returns 409 Conflict');

    // Attempting to update an archived person -> 409 Conflict
    const resUpdateArchived = await fetch(`${baseUrl}/${newPersonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ biography: 'Try to update' }),
    });
    assert(resUpdateArchived.status === 409, 'Updating an archived person returns 409 Conflict');

    // --- Test 14: POST /api/persons/:id/restore (Restore person) ---
    const resRestore = await fetch(`${baseUrl}/${newPersonId}/restore`, {
      method: 'POST',
    });
    assert(resRestore.status === 200, 'POST /api/persons/:id/restore returns 200');
    const dataRestore = await resRestore.json();
    assert(dataRestore.data.is_archived === false, 'Person is now unarchived');
    assert(dataRestore.data.archived_at === null, 'archived_at timestamp reset to null');

    // Verify restored person is back in default list
    const resListAfterRestore = await fetch(baseUrl);
    const dataListAfterRestore = await resListAfterRestore.json();
    const isBack = dataListAfterRestore.data.some((p: any) => p.id === newPersonId);
    assert(isBack, 'Restored person reappears in default GET /api/persons');

    // Attempting to restore an active person -> 409 Conflict
    const resReRestore = await fetch(`${baseUrl}/${newPersonId}/restore`, { method: 'POST' });
    assert(resReRestore.status === 409, 'Restoring an active person returns 409 Conflict');

    // --- Test 15: Check original production database integrity ---
    const originalPersonsRaw = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
    const originalRelsRaw = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');
    const origPersons = JSON.parse(originalPersonsRaw).persons;
    const origRels = JSON.parse(originalRelsRaw).relationships;
    assert(origPersons.length === 16, `Original database has exactly 16 persons (verified: ${origPersons.length})`);
    assert(origRels.length === 24, `Original database has exactly 24 relationships (verified: ${origRels.length})`);

    console.log(`\n🎉 All ${passed}/${total} Milestone 2.4 CRUD API tests PASSED!`);
  } finally {
    server.close();
    // Cleanup temporary test directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  }
}

runPersonCrudTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
