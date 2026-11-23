import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { PersonService } from '../services/person.service';
import { RelationshipService } from '../services/relationship.service';
import { RelativeService } from '../services/relative.service';
import { StorageService, LocalDiskStorageService } from '../services/storage.service';
import { PhotoService } from '../services/photo.service';
import { PersonController } from '../controllers/person.controller';
import { RelationshipController } from '../controllers/relationship.controller';
import { RelativeController } from '../controllers/relative.controller';
import { PhotoController } from '../controllers/photo.controller';
import { createPersonRoutes } from '../routes/person.routes';
import { createRelationshipRoutes } from '../routes/relationship.routes';

async function runFrontendIntegrationTests() {
  console.log('=== Running Tests for Milestone 2.8 (Person Management React Interface & Integration) ===\n');
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

  // 1. Setup isolated temporary data directory
  const rootDataDir = path.resolve(__dirname, '../../../data');
  const tempTestDir = path.resolve(__dirname, '../../../data/__ui_test_data__');
  const tempStorageDir = path.join(tempTestDir, 'storage');
  await fs.mkdir(tempStorageDir, { recursive: true });

  const seedPersons = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
  const seedRels = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');

  await fs.writeFile(path.join(tempTestDir, 'persons.json'), seedPersons, 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), seedRels, 'utf-8');

  // 2. Instantiate isolated dependencies
  const testRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  const testStorage: StorageService = new LocalDiskStorageService(tempStorageDir);
  const testPersonService = new PersonService(testRepo);
  const testRelService = new RelationshipService(testRepo);
  const testRelativeService = new RelativeService(testRepo);
  const testPhotoService = new PhotoService(testRepo, testStorage);

  const testPersonController = new PersonController(testPersonService);
  const testRelController = new RelationshipController(testRelService);
  const testRelativeController = new RelativeController(testRelativeService);
  const testPhotoController = new PhotoController(testPhotoService);

  const personRoutes = createPersonRoutes(testPersonController, testRelativeController, testPhotoController);
  const relationshipRoutes = createRelationshipRoutes(testRelController);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString(), service: 'family-tree-api' } });
  });
  app.use('/api/persons', personRoutes);
  app.use('/api/relationships', relationshipRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // --- Test 1: Health endpoint for frontend connection ---
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns 200');
    assert(healthData.data.status === 'healthy', 'Backend is healthy for React frontend');

    // --- Test 2: Load people list (2.8.2) ---
    const listRes = await fetch(`${baseUrl}/persons`);
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /api/persons returns 200');
    assert(listData.data.length === 20, `Expected all 20 canonical members, got ${listData.data.length}`);

    // --- Test 3: Search by name ---
    const searchRes = await fetch(`${baseUrl}/persons?search=Shanmuga`);
    const searchData = await searchRes.json();
    assert(searchData.data.length === 1, 'Search query "Shanmuga" returned exactly 1 record');
    assert(searchData.data[0].first_name === 'Shanmuga', 'First name matches search query');

    // --- Test 4: Empty search result handling ---
    const emptySearchRes = await fetch(`${baseUrl}/persons?search=NonexistentZzz`);
    const emptySearchData = await emptySearchRes.json();
    assert(emptySearchData.data.length === 0, 'Non-matching search returned empty array without errors');

    // --- Test 5: Add person with Father, Mother, Spouse (2.8.3) ---
    const jagannadhamId = 'b19dee44-9906-4c46-84b6-70d2fa70a5b5';
    const sugunaId = '5c561a7d-3fee-4112-af6e-286f7a8ad61b';

    const createRes = await fetch(`${baseUrl}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Aditya',
        middle_name: 'Vardhan',
        last_name: 'Konukuru',
        gender: 'male',
        birth_date: '2026-03-15',
        birth_place: 'Madanapalli',
        is_living: true,
        father_id: jagannadhamId,
        mother_id: sugunaId,
        biography: 'Youngest family member added through Milestone 2.8 UI.',
      }),
    });
    assert(createRes.status === 201, 'POST /api/persons with parent links returns 201 Created');
    const createdData = await createRes.json();
    const newPersonId = createdData.data.id;
    assert(Boolean(newPersonId), 'Permanent server UUID generated for new person');

    // --- Test 6: Verify new person appears in list ---
    const updatedListRes = await fetch(`${baseUrl}/persons`);
    const updatedListData = await updatedListRes.json();
    assert(updatedListData.data.length === 21, 'Updated directory now contains 21 members');

    // --- Test 7: Verify parent relationships were created atomically ---
    const relsRes = await fetch(`${baseUrl}/relationships?personId=${newPersonId}`);
    const relsData = await relsRes.json();
    assert(relsData.data.length === 2, 'Two parent relationships created atomically for new member');

    // --- Test 8: Edit person (2.8.3) ---
    const editRes = await fetch(`${baseUrl}/persons/${newPersonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias: 'Adi',
        biography: 'Updated biography from React edit screen.',
      }),
    });
    assert(editRes.status === 200, 'PATCH /api/persons/:id returns 200');
    const editedData = await editRes.json();
    assert(editedData.data.alias === 'Adi', 'Alias successfully updated to "Adi"');
    assert(editedData.data.biography.includes('Updated'), 'Biography successfully updated');

    // --- Test 9: Client attempted ID alteration rejected ---
    const badEditRes = await fetch(`${baseUrl}/persons/${newPersonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: '00000000-0000-4000-8000-000000000000' }),
    });
    assert(badEditRes.status === 400, 'Attempting to change person ID is strictly rejected with 400');

    // --- Test 10: Photo Management (2.8.4) ---
    // Minimal valid 1x1 PNG
    const testPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
      0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const boundary = '----WebKitFormBoundaryTest123456';
    const postBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n`),
      testPng,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadPhotoRes = await fetch(`${baseUrl}/persons/${newPersonId}/photo`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: postBody,
    });
    assert(uploadPhotoRes.status === 200, 'POST /api/persons/:id/photo returns 200');
    const uploadPhotoData = await uploadPhotoRes.json();
    assert(Boolean(uploadPhotoData.data.profile_photo), 'Profile photo reference saved in person record');

    // GET photo binary
    const getPhotoRes = await fetch(`${baseUrl}/persons/${newPersonId}/photo`);
    assert(getPhotoRes.status === 200, 'GET /api/persons/:id/photo streams uploaded image');
    assert(getPhotoRes.headers.get('content-type') === 'image/png', 'Content-Type header is image/png');

    // Delete photo
    const delPhotoRes = await fetch(`${baseUrl}/persons/${newPersonId}/photo`, { method: 'DELETE' });
    assert(delPhotoRes.status === 200, 'DELETE /api/persons/:id/photo returns 200');
    const getPhotoAfterDel = await fetch(`${baseUrl}/persons/${newPersonId}/photo`);
    assert(getPhotoAfterDel.status === 404, 'Photo returned 404 after deletion');

    // --- Test 11: Archive and Restore flow (2.8.2 / 2.8.5) ---
    const archiveRes = await fetch(`${baseUrl}/persons/${newPersonId}/archive`, { method: 'POST' });
    assert(archiveRes.status === 200, 'POST /api/persons/:id/archive returns 200');

    // Default list excludes archived
    const listWithoutArchived = await (await fetch(`${baseUrl}/persons`)).json();
    assert(listWithoutArchived.data.length === 20, 'Archived person is excluded from default list');

    // includeArchived=true includes them
    const listWithArchived = await (await fetch(`${baseUrl}/persons?includeArchived=true`)).json();
    assert(listWithArchived.data.length === 21, 'Archived person is included when includeArchived=true');

    // Restore person
    const restoreRes = await fetch(`${baseUrl}/persons/${newPersonId}/restore`, { method: 'POST' });
    assert(restoreRes.status === 200, 'POST /api/persons/:id/restore returns 200');

    // --- Test 12: Person profile & Derived Relatives (2.8.5 / 2.8.6) ---
    const relativesRes = await fetch(`${baseUrl}/persons/${newPersonId}/relatives`);
    const relativesData = await relativesRes.json();
    assert(relativesRes.status === 200, 'GET /api/persons/:id/relatives returns 200');
    assert(relativesData.data.relatives.parents.length === 2, 'Parents list contains Father and Mother');
    assert(relativesData.data.relatives.grandparents.length === 4, 'Grandparents list contains paternal and maternal grandparents');

    // --- Test 13: Perspective-dependent relationship calculation ---
    // Relationship between Aditya and Shanmuga (Full brothers: share Jagannadham and Suguna)
    const shanmugaId = 'dadbde6b-4a42-4eb6-86e3-9a6b6d02bd05';
    const relBetweenRes = await fetch(`${baseUrl}/persons/${newPersonId}/relationship-to/${shanmugaId}`);
    assert(relBetweenRes.status === 200, 'GET /api/persons/:id/relationship-to/:targetId returns 200');
    const relBetweenData = await relBetweenRes.json();
    assert(relBetweenData.data.relationship === 'Brother', 'From Aditya perspective, Shanmuga is Brother');
    assert(relBetweenData.data.reverse_relationship === 'Brother', 'From Shanmuga perspective, Aditya is Brother');

    // --- Test 14: Canonical database integrity ---
    const origPersons = JSON.parse(await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8')).persons;
    const origRels = JSON.parse(await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8')).relationships;
    assert(origPersons.length === 20, `Original database has exactly 20 persons (verified: ${origPersons.length})`);
    assert(origRels.length === 31, `Original database has exactly 31 relationships (verified: ${origRels.length})`);

    console.log(`\n🎉 All ${passed}/${total} Milestone 2.8 Frontend Integration tests PASSED!`);
  } finally {
    server.close();
    await fs.rm(tempTestDir, { recursive: true, force: true });
  }
}

runFrontendIntegrationTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

