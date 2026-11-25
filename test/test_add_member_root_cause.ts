import assert from 'assert';
import { layoutApi, augmentLayoutWithCustomPersons } from '../src/services/layoutApi';
import { personApi } from '../src/services/personApi';
import { relationshipApi } from '../src/services/relationshipApi';
import { parseFullName } from '../src/utils/kinshipInference';
import { convertLayoutToReactFlow } from '../src/adapters/reactFlowAdapter';
import { FamilyLayout } from '../src/types/layout';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup mock localStorage spy to prove ZERO localStorage caching is used by DB services
const store: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => {
    store[key] = String(val);
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
(global as any).window = {
  location: { hostname: 'thefamilytree.web.app' },
};

console.log('================================================================');
console.log('   TEST SUITE: ADD MEMBER, DB PERSISTENCE & LAYOUT VERIFICATION  ');
console.log('================================================================\n');

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

const paradaramiLayoutPath = path.resolve(__dirname, '../public/data/layout-paradarami.json');
const baseParadaramiLayout: FamilyLayout = JSON.parse(fs.readFileSync(paradaramiLayoutPath, 'utf-8'));

async function runAll() {
  let subramanyamId = '';
  let narayanaswamyId = '';
  let rohithaId = '';
  let surendrababuId = '';

  await runTest('DB Persistence: personApi.create stores member in DB with zero localStorage caching', async () => {
    localStorage.clear();
    const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';
    const res = await personApi.create({
      first_name: 'Subramanyam',
      last_name: 'Paradarami',
      gender: 'male',
      birth_date: '1975',
      birth_place: 'Paradarami',
      biography: 'Son of Ramayya Paradarami',
      is_living: true,
      father_id: ramayyaId,
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data);
    subramanyamId = res.data.id;
    assert.strictEqual(res.data.first_name, 'Subramanyam');
    assert.strictEqual(res.data.last_name, 'Paradarami');
    assert.strictEqual(Object.keys(store).length, 0, 'Zero localStorage keys must be written');
  });

  await runTest('DB Persistence: layoutApi.getLayout renders Subramanyam Paradarami from DB', async () => {
    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    assert.strictEqual(layoutRes.success, true);
    const layout = layoutRes.data!;

    const subramanyamNode = layout.nodes.find((n) => n.id === subramanyamId);
    assert.ok(subramanyamNode, 'Subramanyam node must be in DB layout');
    assert.strictEqual(subramanyamNode.generationOrder, 3, '1975 birth year must place Subramanyam in Generation X (order 3)');

    const gen3Lane = layout.lanes.find((l) => l.order === 3);
    assert.ok(gen3Lane, 'Generation X lane must exist');
    const expectedY = gen3Lane.y + Math.round((gen3Lane.height - (subramanyamNode.height || 160)) / 2);
    assert.strictEqual(subramanyamNode.y, expectedY, 'Subramanyam must be positioned in Generation X lane');

    const rf = convertLayoutToReactFlow(layout);
    assert.ok(rf.nodes.some((n) => n.id === subramanyamId), 'ReactFlow nodes must contain Subramanyam');
    assert.ok(
      rf.edges.some((e) => e.source === '1ae73a4b-b739-40d3-8b50-071bbf1b07eb' && e.target === subramanyamId),
      'ReactFlow edges must connect Ramayya -> Subramanyam'
    );
  });

  await runTest('Root Cause Fix: parseFullName auto-segregates single input into first, middle, and family name', () => {
    const p1 = parseFullName('Subramanyam Paradarami');
    assert.strictEqual(p1.firstName, 'Subramanyam');
    assert.strictEqual(p1.middleName, '');
    assert.strictEqual(p1.lastName, 'Paradarami');

    const p2 = parseFullName('Shanmuga Vardhan Konukuru');
    assert.strictEqual(p2.firstName, 'Shanmuga');
    assert.strictEqual(p2.middleName, 'Vardhan');
    assert.strictEqual(p2.lastName, 'Konukuru');

    const p3 = parseFullName('Achamma');
    assert.strictEqual(p3.firstName, 'Achamma');
    assert.strictEqual(p3.middleName, '');
    assert.strictEqual(p3.lastName, '');
  });

  await runTest('Spouse Side-by-Side Rearrangement: Narayanaswamy A sits directly beside Srivalli and Subramanyam rearranges rightwards', async () => {
    const srivalliId = 'bde77be0-8530-4ce6-93a5-f3751cbc3f6a';
    const res = await personApi.create({
      first_name: 'Narayanaswamy',
      last_name: 'A',
      gender: 'male',
      birth_date: '1970',
      is_living: true,
      spouse_id: srivalliId,
    });
    assert.strictEqual(res.success, true);
    narayanaswamyId = res.data!.id;

    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const layout = layoutRes.data!;

    const srivalliNode = layout.nodes.find((n) => n.id === srivalliId);
    const narayanaswamyNode = layout.nodes.find((n) => n.id === narayanaswamyId);
    const subramanyamNode = layout.nodes.find((n) => n.id === subramanyamId);

    assert.ok(srivalliNode && narayanaswamyNode && subramanyamNode);
    assert.strictEqual(srivalliNode.y, narayanaswamyNode.y);
    assert.strictEqual(srivalliNode.y, subramanyamNode.y);

    const leftSpouse = Math.min(srivalliNode.x, narayanaswamyNode.x);
    const rightSpouse = Math.max(srivalliNode.x, narayanaswamyNode.x);
    assert.strictEqual(rightSpouse - leftSpouse, 190 + 56, 'Spouses must be strictly side by side with 56px gap');
    assert.ok(
      subramanyamNode.x >= rightSpouse + 190 + 50 || subramanyamNode.x + 190 + 50 <= leftSpouse,
      'Subramanyam must NOT sit between Srivalli and Narayanaswamy'
    );
  });

  await runTest('Root Cause Fix: Multiple calls are idempotent and do not duplicate nodes or edges', () => {
    const run1 = augmentLayoutWithCustomPersons(baseParadaramiLayout, 'paradarami');
    const run2 = augmentLayoutWithCustomPersons(run1, 'paradarami');
    assert.strictEqual(run1.nodes.length, run2.nodes.length);
    assert.strictEqual(run1.edges.length, run2.edges.length);
  });

  await runTest('Generational Boundary Invariant: Person tiles are strictly contained inside their generational strip and never cross boundaries', async () => {
    const konuRes = await layoutApi.getLayout({ lineage: 'konukuru' });
    const paraRes = await layoutApi.getLayout({ lineage: 'paradarami' });

    const layoutsToTest = [
      { name: 'Konukuru Standard', layout: konuRes.data! },
      { name: 'Paradarami Standard', layout: paraRes.data! },
    ];

    const CARD_NATURAL_HEIGHT = 180;
    for (const { name, layout } of layoutsToTest) {
      for (const node of layout.nodes) {
        const lane = layout.lanes.find((l) => l.order === node.generationOrder);
        assert.ok(lane, `[${name}] Node ${node.firstName} must have a valid lane for genOrder ${node.generationOrder}`);
        assert.ok(node.y >= lane.y, `[${name}] ${node.firstName} top (${node.y}) must be >= laneTop (${lane.y})`);
        assert.ok(
          node.y + CARD_NATURAL_HEIGHT <= lane.y + lane.height,
          `[${name}] ${node.firstName} bottom must be <= laneBottom (${lane.y + lane.height})`
        );
      }
    }
  });

  await runTest('Bug Fix: Rohitha Galeti born in 2002 is placed in Generation Z (Order 5), NOT Millennials', async () => {
    const munirathnamId = '901d8c3f-0bd1-4947-9678-fbfd685d77c1';
    const radaId = 'fd26db0a-7e43-47d8-bb1c-55b1b84026c2';
    const res = await personApi.create({
      first_name: 'Rohitha',
      last_name: 'Galeti',
      gender: 'female',
      birth_date: '2002',
      birth_place: 'Madanapalli',
      is_living: true,
      father_id: munirathnamId,
      mother_id: radaId,
    });
    assert.strictEqual(res.success, true);
    rohithaId = res.data!.id;

    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const rohithaNode = layoutRes.data!.nodes.find((n) => n.id === rohithaId);
    assert.ok(rohithaNode, 'Rohitha Galeti node must be present in layout');
    assert.strictEqual(rohithaNode.generationOrder, 5, 'Rohitha Galeti (born 2002) must be in Generation Z (order 5)');
  });

  await runTest('Bug Fix: Srivalli Narayanaswamy and Surendrababu Paradarami are derived as Brother and Sister', async () => {
    const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';
    const srivalliId = 'bde77be0-8530-4ce6-93a5-f3751cbc3f6a';

    const res = await personApi.create({
      first_name: 'Surendrababu',
      last_name: 'Paradarami',
      gender: 'male',
      birth_date: '1974',
      is_living: true,
      father_id: ramayyaId,
    });
    assert.strictEqual(res.success, true);
    surendrababuId = res.data!.id;

    const relRes = await personApi.getRelationshipTo(srivalliId, surendrababuId);
    assert.strictEqual(relRes.success, true);
    assert.strictEqual(relRes.data?.relationship, 'Brother', 'Surendrababu must be derived as Srivalli Brother');
    assert.strictEqual(relRes.data?.reverse_relationship, 'Sister', 'Srivalli must be derived as Surendrababu Sister');
    assert.strictEqual(relRes.data?.category, 'siblings');
  });

  await runTest('Edit Member Details: Editing existing pre-seeded person (Ramayya Chetty) updates profile & canvas node', async () => {
    const ramayyaId = '1ae73a4b-b739-40d3-8b50-071bbf1b07eb';
    const updateRes = await personApi.update(ramayyaId, {
      alias: 'Pedda Ayya',
      biography: 'Respected patriarch and founder of the Paradarami family estate.',
      birth_place: 'Paradarami Heritage House',
    });

    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.data?.alias, 'Pedda Ayya');

    const getByIdRes = await personApi.getById(ramayyaId);
    assert.strictEqual(getByIdRes.data?.alias, 'Pedda Ayya');

    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const ramayyaNode = layoutRes.data!.nodes.find((n) => n.id === ramayyaId);
    assert.ok(ramayyaNode);
    assert.strictEqual(ramayyaNode.alias, 'Pedda Ayya');
    assert.strictEqual(ramayyaNode.birthPlace, 'Paradarami Heritage House');
  });

  await runTest('Edit Member Details: Editing custom-added person updates DB and layout node', async () => {
    const updateRes = await personApi.update(surendrababuId, {
      alias: 'Babu',
      biography: 'Custom biography updated via edit member form',
      birth_place: 'Paradarami Town',
    });

    assert.strictEqual(updateRes.success, true);
    assert.strictEqual(updateRes.data?.alias, 'Babu');

    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const customNode = layoutRes.data!.nodes.find((n) => n.id === surendrababuId);
    assert.ok(customNode);
    assert.strictEqual(customNode.alias, 'Babu');
    assert.strictEqual(customNode.biography, 'Custom biography updated via edit member form');
  });

  await runTest('Edit Member Details: Non-existent person update returns PERSON_NOT_FOUND', async () => {
    const res = await personApi.update('non-existent-id-999', { first_name: 'Ghost' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error?.code, 'PERSON_NOT_FOUND');
  });

  await runTest('Full Timeline View: Canvas always displays all generational cohorts (no compact display)', async () => {
    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const layout = layoutRes.data!;

    const laneNames = layout.lanes.map((l) => l.name);
    assert.ok(laneNames.includes('Baby Boomers'));
    assert.ok(laneNames.includes('Generation X'));
    assert.ok(laneNames.includes('Generation Z'));
    assert.ok(laneNames.includes('Greatest Generation'));
    assert.ok(laneNames.includes('Silent Generation'));
    assert.ok(laneNames.includes('Generation Alpha'));
    assert.ok(laneNames.includes('Generation Beta'));
    assert.strictEqual(Object.keys(store).length, 0, 'Zero localStorage keys must be written across entire test suite');
  });

  await runTest('Center Alignment: Every generational strip (including elderly root couple) is horizontally centered', async () => {
    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const layout = layoutRes.data!;
    const canvasCenter = layout.width / 2;

    for (const lane of layout.lanes) {
      const laneNodes = layout.nodes.filter((n) => n.generationOrder === lane.order);
      if (laneNodes.length === 0) continue;
      const minLeft = Math.min(...laneNodes.map((n) => n.x));
      const maxRight = Math.max(...laneNodes.map((n) => n.x + (n.width || 190)));
      const laneMidpoint = (minLeft + maxRight) / 2;
      assert.ok(
        Math.abs(laneMidpoint - canvasCenter) <= 2,
        `Lane "${lane.name}" midpoint (${laneMidpoint}) must be centered at canvasCenter (${canvasCenter})`
      );
    }
  });

  await runTest('Obstacle-Aware Routing: Single couple trunk & routes around merged spouse units without crossing spouse lines', async () => {
    const { computeObstacleAwareParentPath, buildMergedSpouseObstacleBoxes } = await import('../src/components/canvas/FamilyEdge');

    // Sai (x=400) and Sravya (x=646) are spouses connected by a dashed line (gap x=590..646)
    const spouseBoxes = buildMergedSpouseObstacleBoxes(
      [
        { id: 'sai', x: 400, y: 3220, width: 190, height: 180 },
        { id: 'sravya', x: 646, y: 3220, width: 190, height: 180 },
      ],
      [{ source: 'sai', target: 'sravya' }]
    );

    assert.strictEqual(spouseBoxes.length, 1, 'Connected spouses must merge into ONE obstacle box covering the spouse line & heart');
    assert.ok(spouseBoxes[0].left < 400 && spouseBoxes[0].right > 836, 'Merged box must cover Sai, heart gap, and Sravya');

    // Edge trying to drop at x=618 (right through Sai-Sravya heart!) must route outside [left, right]
    const routed = computeObstacleAwareParentPath({
      coupleKey: 'jagannadham<->suguna',
      sourceX: 618,
      sourceY: 2840,
      targetX: 618,
      targetY: 3660,
      personBoxes: spouseBoxes,
    });

    assert.ok(routed, 'Must compute custom obstacle-aware route');
    const hitsSpouseUnit = spouseBoxes.some(
      (b) => routed.labelX >= b.left && routed.labelX <= b.right
    );
    assert.strictEqual(hitsSpouseUnit, false, `Vertical drop X (${routed.labelX}) must NOT cross Sai-Sravya spouse line or tiles`);
  });

  await runTest('Single Line Per Couple: Married parents emit only ONE parent-child line per child', async () => {
    const layoutRes = await layoutApi.getLayout({ lineage: 'paradarami' });
    const layout = layoutRes.data!;
    const subramanyamParentEdges = layout.edges.filter(
      (e) => e.type === 'parent_child' && e.target === subramanyamId
    );
    assert.strictEqual(subramanyamParentEdges.length, 1, 'Child of married couple must have exactly ONE parent-child line, not duplicate lines');
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
