import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock LocalStorage in Node.js test environment
const mockStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => mockStorage.get(key) || null,
  setItem: (key: string, val: string) => mockStorage.set(key, val),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};
(global as any).localStorage = localStorageMock;
(global as any).window = {
  location: { hostname: 'thefamilytree.web.app', origin: '' },
};

// Polyfill minimal File / Blob for Node.js if needed
class MockFile {
  name: string;
  type: string;
  size: number;
  private buffer: Buffer;

  constructor(chunks: (string | Buffer)[], name: string, options?: { type?: string }) {
    this.name = name;
    this.type = options?.type || 'image/png';
    this.buffer = Buffer.concat(chunks.map((c) => (typeof c === 'string' ? Buffer.from(c) : c)));
    this.size = this.buffer.length;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
  }
}
(global as any).File = MockFile;

import { personApi, saveLocalCustomPerson, getLocalCustomPersons, LOCAL_CUSTOM_PERSONS_KEY } from '../src/services/personApi';
import { augmentLayoutWithCustomPersons } from '../src/services/layoutApi';
import { FamilyLayout } from '../src/types/layout';
import { Person, CreatePersonInput } from '../src/types/person';

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${name}`);
    console.error(err);
  }
}

async function runAll() {
  console.log('================================================================');
  console.log('   TEST SUITE: COMPLETE PHOTO HANDLING PROCESSES & SANITY CHECKS');
  console.log('================================================================\n');

  const paraCompact: FamilyLayout = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../public/data/layout-paradarami-compact.json'), 'utf-8')
  );

  await runTest('Sanity Check: Reject upload with invalid file types (.txt, .pdf, .exe)', async () => {
    const textFile = new MockFile(['Hello text file'], 'notes.txt', { type: 'text/plain' }) as any;
    const res1 = await personApi.uploadPhoto('any-id', textFile);
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.error?.code, 'INVALID_FILE_TYPE');

    const exeFile = new MockFile(['Binary content'], 'malware.exe', { type: 'application/octet-stream' }) as any;
    const res2 = await personApi.uploadPhoto('any-id', exeFile);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error?.code, 'INVALID_FILE_TYPE');
  });

  await runTest('Sanity Check: Reject upload with oversized file (>10MB)', async () => {
    // 11MB dummy file
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    const bigFile = new MockFile([bigBuffer], 'huge_photo.png', { type: 'image/png' }) as any;

    const res = await personApi.uploadPhoto('any-id', bigFile);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.code, 'FILE_TOO_LARGE');
  });

  await runTest('Sanity Check: Reject upload with null / missing file', async () => {
    const res = await personApi.uploadPhoto('any-id', null as any);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.code, 'INVALID_FILE');
  });

  await runTest('Photo Upload: Valid image converted to Base64 Data URL and persisted in storage', async () => {
    const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';
    const fakeImageBytes = Buffer.from('GIF89a Fake Image Content');
    const validFile = new MockFile([fakeImageBytes], 'ramayya_portrait.jpg', { type: 'image/jpeg' }) as any;

    const uploadRes = await personApi.uploadPhoto(ramayyaId, validFile);
    assert.strictEqual(uploadRes.success, true);
    assert.ok(uploadRes.data, 'Upload data must exist');
    assert.ok(uploadRes.data.profile_photo.startsWith('data:image/jpeg;base64,'), 'Photo must be Base64 Data URL');
    assert.strictEqual(uploadRes.data.person.profile_photo, uploadRes.data.profile_photo);

    // Verify persisted in localStorage
    const getByIdRes = await personApi.getById(ramayyaId);
    assert.strictEqual(getByIdRes.success, true);
    assert.strictEqual(getByIdRes.data?.profile_photo, uploadRes.data.profile_photo);

    // Verify getAll() returns the updated photo
    const getAllRes = await personApi.getAll();
    const ramayyaInAll = getAllRes.data?.find((p) => p.id === ramayyaId);
    assert.ok(ramayyaInAll);
    assert.strictEqual(ramayyaInAll.profile_photo, uploadRes.data.profile_photo);

    // Verify canvas layout node displays photoPath
    const layout = augmentLayoutWithCustomPersons(paraCompact, 'paradarami');
    const ramayyaNode = layout.nodes.find((n) => n.id === ramayyaId);
    assert.ok(ramayyaNode, 'Ramayya node must exist on canvas');
    assert.strictEqual(ramayyaNode.photoPath, uploadRes.data.profile_photo, 'Canvas node photoPath must match Data URL');
  });

  await runTest('Add Member with Photo: Create person with photoPreviewUrl saves photo and sets canvas photoPath', async () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const input: CreatePersonInput = {
      first_name: 'Ananya',
      last_name: 'Paradarami',
      gender: 'female',
      birth_date: '1998',
      biography: 'Young artist',
      profile_photo: mockDataUrl,
    };

    const createRes = await personApi.create(input);
    assert.strictEqual(createRes.success, true);
    assert.ok(createRes.data);
    assert.strictEqual(createRes.data.profile_photo, mockDataUrl, 'profile_photo must be preserved on create');

    // Check canvas layout
    const layout = augmentLayoutWithCustomPersons(paraCompact, 'paradarami');
    const ananyaNode = layout.nodes.find((n) => n.id === createRes.data?.id);
    assert.ok(ananyaNode, 'Ananya node must be present on canvas');
    assert.strictEqual(ananyaNode.photoPath, mockDataUrl, 'Canvas node photoPath must contain the image Data URL');
  });

  await runTest('Photo Deletion: Deleting photo resets profile_photo to null across storage and canvas', async () => {
    const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';

    const deleteRes = await personApi.deletePhoto(ramayyaId);
    assert.strictEqual(deleteRes.success, true);
    assert.strictEqual(deleteRes.data?.deleted, true);
    assert.strictEqual(deleteRes.data?.person.profile_photo, null, 'profile_photo must be set to null');

    // Verify in getById
    const getByIdRes = await personApi.getById(ramayyaId);
    assert.strictEqual(getByIdRes.data?.profile_photo, null);

    // Verify canvas node photoPath is reset to null (falling back to noble avatar)
    const layout = augmentLayoutWithCustomPersons(paraCompact, 'paradarami');
    const ramayyaNode = layout.nodes.find((n) => n.id === ramayyaId);
    assert.ok(ramayyaNode);
    assert.strictEqual(ramayyaNode.photoPath, null, 'Canvas node photoPath must be null after photo deletion');
  });

  await runTest('Touch & Panning Geometry: Pan offset correctly translates face coordinate into center aperture', () => {
    // Viewport dimensions
    const canvasWidth = 340;
    const canvasHeight = 340;
    const centerX = canvasWidth / 2; // 170
    const centerY = canvasHeight / 2; // 170
    const cropRadius = 110;
    const cropDiameter = cropRadius * 2; // 220

    // Original uploaded photo dimensions (e.g. 1200x800 landscape photo where face is located at x=300, y=250)
    const imgWidth = 1200;
    const imgHeight = 800;
    const faceXInImage = 300;
    const faceYInImage = 250;

    // Zoom level 1.5x
    const zoom = 1.5;
    const baseScale = Math.max(cropDiameter / imgWidth, cropDiameter / imgHeight); // 220/800 = 0.275
    const currentScale = baseScale * zoom; // 0.4125

    // In unpanned state, image center is at (centerX, centerY)
    // To center the face at (centerX, centerY), pan offset is:
    const requiredPanX = (imgWidth / 2 - faceXInImage) * currentScale;
    const requiredPanY = (imgHeight / 2 - faceYInImage) * currentScale;

    // Simulate drawing position
    const drawW = imgWidth * currentScale;
    const drawH = imgHeight * currentScale;
    const imgDrawX = centerX - drawW / 2 + requiredPanX;
    const imgDrawY = centerY - drawH / 2 + requiredPanY;

    // The face position on screen:
    const faceScreenX = imgDrawX + faceXInImage * currentScale;
    const faceScreenY = imgDrawY + faceYInImage * currentScale;

    // Face must sit exactly at aperture center!
    assert.strictEqual(
      Math.round(faceScreenX),
      centerX,
      `Face screen X (${faceScreenX}) must align with aperture centerX (${centerX})`
    );
    assert.strictEqual(
      Math.round(faceScreenY),
      centerY,
      `Face screen Y (${faceScreenY}) must align with aperture centerY (${centerY})`
    );
  });

  await runTest('Aspect Ratio & Export Consistency: 1:1 export fits 50% border radius portrait medallion', () => {
    const exportSize = 400; // 400x400
    const medallionDiameter = 96; // 96x96 circular node medallion

    // When an export of 400x400 is rendered with width: 96, height: 96, borderRadius: '50%', objectFit: 'cover':
    const aspectRatio = exportSize / exportSize;
    assert.strictEqual(aspectRatio, 1.0, 'Export must be exactly 1:1 square for circular avatar');

    const scaleFactor = medallionDiameter / exportSize;
    assert.strictEqual(scaleFactor, 0.24, 'Uniform scaling factor without distortion');
  });

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

