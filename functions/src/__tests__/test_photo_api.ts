import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { LocalDiskStorageService } from '../services/storage.service';
import { PhotoService } from '../services/photo.service';
import { PhotoController } from '../controllers/photo.controller';
import { createPersonRoutes } from '../routes/person.routes';

// Sample binary test fixtures
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08,
  0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
  0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34,
  0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00,
  0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01,
  0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
  0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
  0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const VALID_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00,
  0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00,
]);

const SVG_PAYLOAD = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');
const EXE_PAYLOAD = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

function createMultipartFormData(fieldName: string, filename: string, mimeType: string, fileBuffer: Buffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([prefix, fileBuffer, suffix]);
  return {
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

async function runPhotoTests() {
  console.log('=== Running Tests for Milestone 2.7 (Photo Management) ===\n');
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

  // 1. Setup isolated temporary data and storage directory
  const rootDataDir = path.resolve(__dirname, '../../../data');
  const tempTestDir = path.resolve(__dirname, '../../../data/__photo_test_data__');
  const tempStorageDir = path.join(tempTestDir, 'storage');
  await fs.mkdir(tempStorageDir, { recursive: true });

  const seedPersons = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
  const seedRels = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');

  await fs.writeFile(path.join(tempTestDir, 'persons.json'), seedPersons, 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), seedRels, 'utf-8');

  // 2. Instantiate test repo, storage, services, controllers, routes
  const testRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  const testStorage = new LocalDiskStorageService(tempStorageDir);
  const testPhotoService = new PhotoService(testRepo, testStorage);
  const testPhotoController = new PhotoController(testPhotoService);
  const testRoutes = createPersonRoutes(undefined, undefined, testPhotoController);

  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());
  testApp.use('/api/persons', testRoutes);

  // 3. Start test HTTP server
  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/persons`;

  // Target person for test uploads: Shanmuga Vardhan Konukuru
  const targetId = 'dadbde6b-4a42-4eb6-86e3-9a6b6d02bd05';

  try {
    // --- Test 1: GET /api/persons/:id/photo when no photo exists -> 404 ---
    const resNoPhoto = await fetch(`${baseUrl}/${targetId}/photo`);
    assert(resNoPhoto.status === 404, 'GET photo for person with no photo returns 404');
    const dataNoPhoto = await resNoPhoto.json();
    assert(dataNoPhoto.error.code === 'PHOTO_NOT_FOUND', 'Returns PHOTO_NOT_FOUND error code');

    // --- Test 2: POST /api/persons/:id/photo with missing file -> 400 ---
    const resNoFile = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=empty' },
      body: Buffer.from('--empty--\r\n'),
    });
    assert(resNoFile.status === 400, 'POST photo without file returns 400 Bad Request');
    const dataNoFile = await resNoFile.json();
    assert(dataNoFile.error.code === 'NO_FILE_UPLOADED', 'Returns NO_FILE_UPLOADED code');

    // --- Test 3: POST /api/persons/:id/photo with invalid UUID -> 400 ---
    const badUuidUpload = createMultipartFormData('photo', 'test.jpg', 'image/jpeg', VALID_JPEG);
    const resBadUuid = await fetch(`${baseUrl}/not-a-uuid/photo`, {
      method: 'POST',
      headers: badUuidUpload.headers,
      body: badUuidUpload.body,
    });
    assert(resBadUuid.status === 400, 'POST photo with invalid UUID returns 400');

    // --- Test 4: POST /api/persons/:id/photo for nonexistent person -> 404 ---
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const fakeUpload = createMultipartFormData('photo', 'test.jpg', 'image/jpeg', VALID_JPEG);
    const resFake = await fetch(`${baseUrl}/${fakeId}/photo`, {
      method: 'POST',
      headers: fakeUpload.headers,
      body: fakeUpload.body,
    });
    assert(resFake.status === 404, 'POST photo for nonexistent person returns 404');

    // --- Test 5: Reject SVG and XML -> 400 ---
    const svgUpload = createMultipartFormData('photo', 'vector.svg', 'image/svg+xml', SVG_PAYLOAD);
    const resSvg = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: svgUpload.headers,
      body: svgUpload.body,
    });
    assert(resSvg.status === 400, 'POST SVG image rejected with 400 Bad Request');
    const dataSvg = await resSvg.json();
    assert(dataSvg.error.code === 'INVALID_FILE_TYPE', 'Returns INVALID_FILE_TYPE code for SVG');

    // --- Test 6: Reject Executable (MZ) -> 400 ---
    const exeUpload = createMultipartFormData('photo', 'malware.exe', 'application/x-dosexec', EXE_PAYLOAD);
    const resExe = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: exeUpload.headers,
      body: exeUpload.body,
    });
    assert(resExe.status === 400, 'POST executable rejected with 400 Bad Request');
    const dataExe = await resExe.json();
    assert(dataExe.error.code === 'INVALID_FILE_TYPE', 'Returns INVALID_FILE_TYPE code for Executable');

    // --- Test 7: Reject Invalid / Corrupted Magic Bytes -> 400 ---
    const corruptUpload = createMultipartFormData('photo', 'fake.jpg', 'image/jpeg', Buffer.from('NOT AN IMAGE FILE AT ALL'));
    const resCorrupt = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: corruptUpload.headers,
      body: corruptUpload.body,
    });
    assert(resCorrupt.status === 400, 'POST corrupted image rejected with 400');
    const dataCorrupt = await resCorrupt.json();
    assert(dataCorrupt.error.code === 'INVALID_IMAGE_TYPE', 'Returns INVALID_IMAGE_TYPE code');

    // --- Test 8: Reject Oversized Image (> 5 MB) -> 400 ---
    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024, 0xff); // 5 MB + 1 KB
    const oversizedUpload = createMultipartFormData('photo', 'huge.jpg', 'image/jpeg', oversizedBuffer);
    const resOversized = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: oversizedUpload.headers,
      body: oversizedUpload.body,
    });
    assert(resOversized.status === 400, 'POST oversized image rejected with 400');
    const dataOversized = await resOversized.json();
    assert(dataOversized.error.code === 'OVERSIZED_IMAGE', 'Returns OVERSIZED_IMAGE code');

    // --- Test 9: Successful JPEG Upload ---
    const jpegUpload = createMultipartFormData('photo', 'profile.jpg', 'image/jpeg', VALID_JPEG);
    const resJpeg = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: jpegUpload.headers,
      body: jpegUpload.body,
    });
    assert(resJpeg.status === 200, 'POST JPEG photo returns 200 OK');
    const dataJpeg = await resJpeg.json();
    assert(dataJpeg.success === true, 'Response has success: true');
    const firstPhotoPath = dataJpeg.data.profile_photo;
    assert(firstPhotoPath.startsWith(`persons/${targetId}/profile-`) && firstPhotoPath.endsWith('.jpg'), 'Stable storage path returned');
    assert(dataJpeg.data.person.profile_photo === firstPhotoPath, 'Person record updated with storage path');

    // Verify storage file exists on disk
    const fileExistsOnDisk = await testStorage.fileExists(firstPhotoPath);
    assert(fileExistsOnDisk === true, 'File stored in storage directory');

    // Verify JSON record in repo does NOT store base64 or bytes
    const personInRepo = await testRepo.getPersonById(targetId);
    assert(personInRepo?.profile_photo === firstPhotoPath, 'JSON repository stores only object path');

    // --- Test 10: Successful Photo Retrieval (GET /api/persons/:id/photo) ---
    const resGetPhoto = await fetch(`${baseUrl}/${targetId}/photo`);
    assert(resGetPhoto.status === 200, 'GET /api/persons/:id/photo returns 200');
    assert(resGetPhoto.headers.get('content-type') === 'image/jpeg', 'Content-Type is image/jpeg');
    const retrievedBuffer = Buffer.from(await resGetPhoto.arrayBuffer());
    assert(retrievedBuffer.equals(VALID_JPEG), 'Retrieved image bytes match uploaded JPEG exactly');

    // --- Test 11: Photograph Replacement Safety ---
    // Upload PNG to replace the JPEG
    const pngUpload = createMultipartFormData('photo', 'new_profile.png', 'image/png', VALID_PNG);
    const resReplace = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: pngUpload.headers,
      body: pngUpload.body,
    });
    assert(resReplace.status === 200, 'POST replacement photo returns 200');
    const dataReplace = await resReplace.json();
    const secondPhotoPath = dataReplace.data.profile_photo;
    assert(secondPhotoPath.endsWith('.png'), 'Replacement photo is PNG');
    assert(secondPhotoPath !== firstPhotoPath, 'New unique storage object name generated');

    // Verify replacement retrieval returns new PNG bytes
    const resGetPng = await fetch(`${baseUrl}/${targetId}/photo`);
    assert(resGetPng.headers.get('content-type') === 'image/png', 'Retrieved Content-Type is image/png');
    const pngBuffer = Buffer.from(await resGetPng.arrayBuffer());
    assert(pngBuffer.equals(VALID_PNG), 'Retrieved bytes match replacement PNG');

    // Verify previous JPEG was cleaned up from storage
    const oldExists = await testStorage.fileExists(firstPhotoPath);
    assert(oldExists === false, 'Previous photograph file deleted after successful replacement');

    // --- Test 12: Photograph Deletion (DELETE /api/persons/:id/photo) ---
    const resDelete = await fetch(`${baseUrl}/${targetId}/photo`, { method: 'DELETE' });
    assert(resDelete.status === 200, 'DELETE /api/persons/:id/photo returns 200');
    const dataDelete = await resDelete.json();
    assert(dataDelete.data.deleted === true && dataDelete.data.person_id === targetId, 'Returns deleted confirmation');

    // Verify profile_photo is null in person record
    const personAfterDelete = await testRepo.getPersonById(targetId);
    assert(personAfterDelete?.profile_photo === null, 'Person profile_photo reset to null');

    // Verify storage file deleted
    const secondExists = await testStorage.fileExists(secondPhotoPath);
    assert(secondExists === false, 'Photo file deleted from storage');

    // Subsequent GET returns 404
    const resGetAfterDelete = await fetch(`${baseUrl}/${targetId}/photo`);
    assert(resGetAfterDelete.status === 404, 'GET photo after deletion returns 404');

    // Subsequent DELETE returns 404
    const resReDelete = await fetch(`${baseUrl}/${targetId}/photo`, { method: 'DELETE' });
    assert(resReDelete.status === 404, 'Re-deleting photo returns 404');

    // --- Test 13: WebP Upload Support ---
    const webpUpload = createMultipartFormData('photo', 'pic.webp', 'image/webp', VALID_WEBP);
    const resWebp = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: webpUpload.headers,
      body: webpUpload.body,
    });
    assert(resWebp.status === 200, 'POST WebP photo returns 200');
    const dataWebp = await resWebp.json();
    assert(dataWebp.data.profile_photo.endsWith('.webp'), 'WebP photo path recorded');

    // --- Test 14: Archived Person Policy ---
    // Archive target person
    const personsList = JSON.parse(await fs.readFile(path.join(tempTestDir, 'persons.json'), 'utf-8')).persons;
    const tIndex = personsList.findIndex((p: any) => p.id === targetId);
    personsList[tIndex].is_archived = true;
    personsList[tIndex].archived_at = new Date().toISOString();
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: personsList }, null, 2));

    // Upload on archived person -> 409 Conflict
    const resArchivedUpload = await fetch(`${baseUrl}/${targetId}/photo`, {
      method: 'POST',
      headers: jpegUpload.headers,
      body: jpegUpload.body,
    });
    assert(resArchivedUpload.status === 409, 'Uploading photo to archived person returns 409 Conflict');

    // Delete on archived person -> 409 Conflict
    const resArchivedDelete = await fetch(`${baseUrl}/${targetId}/photo`, { method: 'DELETE' });
    assert(resArchivedDelete.status === 409, 'Deleting photo on archived person returns 409 Conflict');

    // GET without includeArchived -> 404
    const resArchivedGet = await fetch(`${baseUrl}/${targetId}/photo`);
    assert(resArchivedGet.status === 404, 'GET photo on archived person without includeArchived returns 404');

    // GET with includeArchived=true -> 200
    const resArchivedGetWithFlag = await fetch(`${baseUrl}/${targetId}/photo?includeArchived=true`);
    assert(resArchivedGetWithFlag.status === 200, 'GET photo on archived person with includeArchived=true returns 200');

    // --- Test 15: Failed-Upload Rollback Integrity ---
    // Unarchive target for failure test
    personsList[tIndex].is_archived = false;
    personsList[tIndex].archived_at = null;
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: personsList }, null, 2));

    // Create a mock repo that throws on saveFamilyData to test replacement rollback
    class FailingRepo extends LocalJsonFamilyRepository {
      async saveFamilyData(): Promise<{ version: number }> {
        throw new Error('Simulated database write failure');
      }
    }
    const failingService = new PhotoService(new FailingRepo({ dataDir: tempTestDir }), testStorage);
    let rollbackThrew = false;
    try {
      await failingService.uploadPersonPhoto(targetId, VALID_JPEG);
    } catch {
      rollbackThrew = true;
    }
    assert(rollbackThrew, 'Failing repo threw as expected');

    // Verify existing photo on person was NOT changed
    const personAfterFail = await testRepo.getPersonById(targetId);
    assert(personAfterFail?.profile_photo === dataWebp.data.profile_photo, 'Existing photo reference preserved after failed save');

    // --- Test 16: Original Database Integrity Check ---
    const origPersons = JSON.parse(await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8')).persons;
    const origRels = JSON.parse(await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8')).relationships;
    assert(origPersons.length === 16, `Original database has exactly 16 persons (verified: ${origPersons.length})`);
    assert(origRels.length === 24, `Original database has exactly 24 relationships (verified: ${origRels.length})`);

    console.log(`\n🎉 All ${passed}/${total} Milestone 2.7 Photo Management tests PASSED!`);
  } finally {
    server.close();
    // Cleanup temporary test directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  }
}

runPhotoTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

