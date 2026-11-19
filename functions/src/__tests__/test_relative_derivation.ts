import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { RelativeService } from '../services/relative.service';
import { RelativeController } from '../controllers/relative.controller';
import { createPersonRoutes } from '../routes/person.routes';

async function runRelativeDerivationTests() {
  console.log('=== Running Tests for Milestone 2.6 (Derived Relatives Engine) ===\n');
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
  const tempTestDir = path.resolve(__dirname, '../../../data/__relative_test_data__');
  await fs.mkdir(tempTestDir, { recursive: true });

  const seedPersons = await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8');
  const seedRels = await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8');

  await fs.writeFile(path.join(tempTestDir, 'persons.json'), seedPersons, 'utf-8');
  await fs.writeFile(path.join(tempTestDir, 'relationships.json'), seedRels, 'utf-8');

  // 2. Instantiate test repository, service, controller, and express app
  const testRepo = new LocalJsonFamilyRepository({ dataDir: tempTestDir });
  const testRelService = new RelativeService(testRepo);
  const testRelController = new RelativeController(testRelService);
  const testRoutes = createPersonRoutes(undefined, testRelController);

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
    // --- Test 1: Full Derivation for Shanmuga Vardhan Konukuru ---
    // Shanmuga ID: dadbde6b-4a42-4eb6-86e3-9a6b6d02bd05
    const shanmugaId = 'dadbde6b-4a42-4eb6-86e3-9a6b6d02bd05';
    const resShanmuga = await fetch(`${baseUrl}/${shanmugaId}/relatives`);
    assert(resShanmuga.status === 200, 'GET /api/persons/:id/relatives returns 200');
    const dataShanmuga = await resShanmuga.json();
    assert(dataShanmuga.success === true, 'Response has success: true');
    const rels = dataShanmuga.data.relatives;

    // Parents
    assert(rels.parents.length === 2, `Expected 2 parents for Shanmuga, got ${rels.parents.length}`);
    const father = rels.parents.find((p: any) => p.relationship === 'Father');
    const mother = rels.parents.find((p: any) => p.relationship === 'Mother');
    assert(father && father.full_name === 'Jagannadham Konukuru', 'Father derived as Jagannadham Konukuru');
    assert(mother && mother.full_name === 'Suguna Konukuru', 'Mother derived as Suguna Konukuru');

    // Siblings
    assert(rels.siblings.length === 1, `Expected 1 sibling for Shanmuga, got ${rels.siblings.length}`);
    const sister = rels.siblings[0];
    assert(
      sister.full_name === 'Meghana Konukuru' && sister.relationship === 'Sister' && sister.shared_parent_ids.length === 2,
      'Sister derived as Meghana Konukuru (Full Sibling)'
    );

    // Grandparents
    assert(rels.grandparents.length === 4, `Expected 4 grandparents for Shanmuga, got ${rels.grandparents.length}`);
    const pGrandfather = rels.grandparents.find((p: any) => p.relationship === 'Paternal Grandfather');
    const pGrandmother = rels.grandparents.find((p: any) => p.relationship === 'Paternal Grandmother');
    const mGrandfather = rels.grandparents.find((p: any) => p.relationship === 'Maternal Grandfather');
    const mGrandmother = rels.grandparents.find((p: any) => p.relationship === 'Maternal Grandmother');
    assert(pGrandfather && pGrandfather.full_name === 'Murthy Chetty Konukuru', 'Paternal Grandfather derived as Murthy Chetty');
    assert(pGrandmother && pGrandmother.full_name === 'Sarojamma Konukuru', 'Paternal Grandmother derived as Sarojamma');
    assert(mGrandfather && mGrandfather.full_name.includes('Ramayya'), 'Maternal Grandfather derived as Ramayya Chetty');
    assert(mGrandmother && mGrandmother.full_name.includes('Achamma'), 'Maternal Grandmother derived as Achamma');

    // Uncles & Aunts (Jagannadham's siblings + Suguna's siblings)
    // Chandra Babu (male -> Paternal Uncle), Giri Babu (male -> Paternal Uncle), Chandrakala (female -> Paternal Aunt), Rada Galeti (female -> Maternal Aunt)
    assert(rels.uncles_aunts.length === 4, `Expected 4 uncles/aunts for Shanmuga, got ${rels.uncles_aunts.length}`);
    const chandraBabu = rels.uncles_aunts.find((p: any) => p.full_name.includes('Chandra'));
    const giriBabu = rels.uncles_aunts.find((p: any) => p.full_name.includes('Giri'));
    const chandrakala = rels.uncles_aunts.find((p: any) => p.full_name.includes('Chandrakala'));
    const rada = rels.uncles_aunts.find((p: any) => p.full_name.includes('Rada'));
    assert(chandraBabu && chandraBabu.relationship === 'Paternal Uncle', 'Chandra Babu derived as Paternal Uncle');
    assert(giriBabu && giriBabu.relationship === 'Paternal Uncle', 'Giri Babu derived as Paternal Uncle');
    assert(chandrakala && chandrakala.relationship === 'Paternal Aunt', 'Chandrakala derived as Paternal Aunt');
    assert(rada && rada.relationship === 'Maternal Aunt', 'Rada Galeti derived as Maternal Aunt');

    // Cousins (Children of uncles & aunts)
    // Chandra Babu's children: Revati, Pranavi. Chandrakala's child: Hemanth Etigadda. Rada Galeti's child: Navaneeth Galeti.
    assert(rels.cousins.length === 4, `Expected 4 cousins for Shanmuga, got ${rels.cousins.length}`);
    const revati = rels.cousins.find((c: any) => c.full_name.includes('Revati'));
    const pranavi = rels.cousins.find((c: any) => c.full_name.includes('Pranavi'));
    const hemanth = rels.cousins.find((c: any) => c.full_name.includes('Hemanth'));
    const navaneeth = rels.cousins.find((c: any) => c.full_name.includes('Navaneeth'));
    assert(revati && pranavi && hemanth && navaneeth, 'All 4 cousins derived (Revati, Pranavi, Hemanth Etigadda, Navaneeth Galeti)');

    // --- Test 2: Full Derivation for Jagannadham (Generation 2) ---
    const jagannadhamId = 'b19dee44-9906-4c46-84b6-70d2fa70a5b5';
    const resJag = await fetch(`${baseUrl}/${jagannadhamId}/relatives`);
    const dataJag = await resJag.json();
    const jagRels = dataJag.data.relatives;

    // Spouses
    assert(jagRels.spouses.length === 1 && jagRels.spouses[0].relationship === 'Wife', 'Suguna derived as Wife of Jagannadham');
    // Children
    assert(jagRels.children.length === 2, '2 children derived for Jagannadham (Meghana, Shanmuga)');
    const son = jagRels.children.find((c: any) => c.relationship === 'Son');
    const daughter = jagRels.children.find((c: any) => c.relationship === 'Daughter');
    assert(son && son.full_name === 'Shanmuga Vardhan Konukuru', 'Son derived as Shanmuga Vardhan');
    assert(daughter && daughter.full_name === 'Meghana Konukuru', 'Daughter derived as Meghana');

    // Nephews & Nieces (Children of Jagannadham's siblings)
    // Chandra Babu's daughters: Revati (Niece), Pranavi (Niece). Chandrakala's son: Hemanth (Nephew).
    assert(jagRels.nephews_nieces.length === 3, `Expected 3 nephews/nieces for Jagannadham, got ${jagRels.nephews_nieces.length}`);
    const nephew = jagRels.nephews_nieces.find((n: any) => n.relationship === 'Nephew');
    const nieces = jagRels.nephews_nieces.filter((n: any) => n.relationship === 'Niece');
    assert(nephew && nephew.full_name === 'Hemanth Etigadda', 'Hemanth derived as Nephew of Jagannadham');
    assert(nieces.length === 2, '2 Nieces derived (Revati and Pranavi)');

    // --- Test 3: Query Filter type=parents ---
    const resParentsFilter = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=parents`);
    assert(resParentsFilter.status === 200, 'GET /api/persons/:id/relatives?type=parents returns 200');
    const dataParentsFilter = await resParentsFilter.json();
    assert(dataParentsFilter.data.relatives.parents.length === 2, 'Parents list populated');
    assert(dataParentsFilter.data.relatives.siblings.length === 0, 'Siblings list empty when type=parents');
    assert(dataParentsFilter.data.relatives.cousins.length === 0, 'Cousins list empty when type=parents');

    // --- Test 4: Query Filter type=siblings ---
    const resSibFilter = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=siblings`);
    const dataSibFilter = await resSibFilter.json();
    assert(dataSibFilter.data.relatives.siblings.length === 1, 'Siblings list populated when type=siblings');
    assert(dataSibFilter.data.relatives.parents.length === 0, 'Parents list empty when type=siblings');

    // --- Test 5: Invalid Category Filter -> 400 ---
    const resBadFilter = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=invalid_category`);
    assert(resBadFilter.status === 400, 'Invalid category filter returns 400 Bad Request');
    const dataBadFilter = await resBadFilter.json();
    assert(dataBadFilter.error.code === 'INVALID_CATEGORY_FILTER', 'Returns INVALID_CATEGORY_FILTER code');

    // --- Test 6: Deceased Relatives Inclusion ---
    // Murthy Chetty (deceased) must be present in Shanmuga's grandparents
    const murthyGrandpa = rels.grandparents.find((gp: any) => gp.full_name === 'Murthy Chetty Konukuru');
    assert(murthyGrandpa && murthyGrandpa.is_living === false, 'Deceased grandfather Murthy Chetty is included with is_living: false');

    // --- Test 7: Half-Sibling Derivation Fixture ---
    // Let's create a half-sibling in temp repo: Father = Jagannadham, Mother = someone else
    const tempPersons = JSON.parse(await fs.readFile(path.join(tempTestDir, 'persons.json'), 'utf-8')).persons;
    const tempRels = JSON.parse(await fs.readFile(path.join(tempTestDir, 'relationships.json'), 'utf-8')).relationships;

    const halfBrotherId = '88888888-8888-4888-8888-888888888888';
    tempPersons.push({
      id: halfBrotherId,
      first_name: 'Tarun',
      middle_name: null,
      last_name: 'Konukuru',
      alias: null,
      gender: 'male',
      birth_date: '2006-03-10',
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
    // Add parent relationship: Jagannadham is parent of Tarun
    tempRels.push({
      id: '99999999-9999-4999-8999-999999999999',
      person_id: halfBrotherId, // child
      related_person_id: jagannadhamId, // parent
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersons }, null, 2));
    await fs.writeFile(path.join(tempTestDir, 'relationships.json'), JSON.stringify({ relationships: tempRels }, null, 2));

    const resShanmugaWithHalf = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=siblings`);
    const dataShanmugaWithHalf = await resShanmugaWithHalf.json();
    const sibsWithHalf = dataShanmugaWithHalf.data.relatives.siblings;
    assert(sibsWithHalf.length === 2, `Expected 2 siblings (1 full, 1 half), got ${sibsWithHalf.length}`);
    const fullSister = sibsWithHalf.find((s: any) => s.relationship === 'Sister');
    const halfBrother = sibsWithHalf.find((s: any) => s.relationship === 'Half-Brother');
    assert(fullSister && fullSister.shared_parent_ids.length === 2, 'Full sister has 2 shared parents');
    assert(halfBrother && halfBrother.shared_parent_ids.length === 1, 'Half brother has 1 shared parent');

    // --- Test 8: Unknown Gender Neutral Labels ---
    const neutralChildId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    tempPersons.push({
      id: neutralChildId,
      first_name: 'Alex',
      middle_name: null,
      last_name: 'Konukuru',
      alias: null,
      gender: 'unknown',
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
    tempRels.push({
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      person_id: neutralChildId,
      related_person_id: jagannadhamId,
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersons }, null, 2));
    await fs.writeFile(path.join(tempTestDir, 'relationships.json'), JSON.stringify({ relationships: tempRels }, null, 2));

    const resNeutral = await fetch(`${baseUrl}/${neutralChildId}/relatives?type=parents`);
    const dataNeutral = await resNeutral.json();
    assert(dataNeutral.data.relatives.parents.length >= 1, 'Neutral gender child can calculate parents');

    const resJagNeutralChild = await fetch(`${baseUrl}/${jagannadhamId}/relatives?type=children`);
    const dataJagNeutralChild = await resJagNeutralChild.json();
    const alexChild = dataJagNeutralChild.data.relatives.children.find((c: any) => c.full_name.includes('Alex'));
    assert(alexChild && alexChild.relationship === 'Child', 'Unknown gender child is labeled "Child" (gender neutral)');

    // --- Test 9: Archived Relatives Policy ---
    // Archive Tarun (half brother)
    const tarunIndex = tempPersons.findIndex((p: any) => p.id === halfBrotherId);
    tempPersons[tarunIndex].is_archived = true;
    tempPersons[tarunIndex].archived_at = new Date().toISOString();
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersons }, null, 2));

    // When includeArchived=false, Tarun must NOT appear
    const resExcludeArchived = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=siblings`);
    const dataExcludeArchived = await resExcludeArchived.json();
    const hasArchivedSibling = dataExcludeArchived.data.relatives.siblings.some((s: any) => s.person_id === halfBrotherId);
    assert(!hasArchivedSibling, 'Archived relative excluded by default');

    // When includeArchived=true, Tarun appears
    const resIncludeArchived = await fetch(`${baseUrl}/${shanmugaId}/relatives?type=siblings&includeArchived=true`);
    const dataIncludeArchived = await resIncludeArchived.json();
    const hasArchivedSiblingWhenIncluded = dataIncludeArchived.data.relatives.siblings.some((s: any) => s.person_id === halfBrotherId);
    assert(hasArchivedSiblingWhenIncluded, 'Archived relative included when includeArchived=true');

    // --- Test 10: Nonexistent Person -> 404 ---
    const fakeId = '00000000-0000-4000-8000-000000000000';
    const res404 = await fetch(`${baseUrl}/${fakeId}/relatives`);
    assert(res404.status === 404, 'GET relatives for nonexistent person returns 404');

    // --- Test 11: Invalid UUID -> 400 ---
    const res400 = await fetch(`${baseUrl}/bad-uuid/relatives`);
    assert(res400.status === 400, 'GET relatives with invalid UUID returns 400');

    // --- Test 12: Person with No Relationships ---
    const isolatedId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    tempPersons.push({
      id: isolatedId,
      first_name: 'Isolated',
      middle_name: null,
      last_name: 'Person',
      alias: null,
      gender: 'other',
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
    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersons }, null, 2));

    const resIsolated = await fetch(`${baseUrl}/${isolatedId}/relatives`);
    assert(resIsolated.status === 200, 'GET relatives for isolated person returns 200');
    const dataIsolated = await resIsolated.json();
    assert(dataIsolated.data.total_count === 0, 'Total count is 0 for isolated person');

    // --- Test 13: Perspective-Dependent Relationship Derivation ---
    // Add Revati's husband (Kiran), Revati's son (Rohan), and Meghana's son (Nikhil)
    const revatiId = '3a50c542-2fe5-4cd2-a99d-10f17afd9b81';
    const meghanaId = 'c16eda13-8aae-4dd1-bd93-ffce2303c173';
    const kiranId = '11111111-1111-4111-8111-111111111111'; // Revati's husband
    const rohanId = '22222222-2222-4222-8222-222222222222'; // Revati's son (Cousin's son)
    const nikhilId = '33333333-3333-4333-8333-333333333333'; // Meghana's son (Sister's son)

    tempPersons.push(
      {
        id: kiranId,
        first_name: 'Kiran',
        middle_name: null,
        last_name: 'Kumar',
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
      },
      {
        id: rohanId,
        first_name: 'Rohan',
        middle_name: null,
        last_name: 'Kumar',
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
      },
      {
        id: nikhilId,
        first_name: 'Nikhil',
        middle_name: null,
        last_name: 'Reddy',
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
      }
    );

    // Relationships:
    // Revati & Kiran are spouses
    tempRels.push({
      id: '44444444-4444-4444-8444-444444444444',
      person_id: revatiId,
      related_person_id: kiranId,
      relationship_type: 'spouse',
      parent_type: null,
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    // Rohan is child of Revati
    tempRels.push({
      id: '55555555-5555-4555-8555-555555555555',
      person_id: rohanId,
      related_person_id: revatiId,
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    // Nikhil is child of Meghana (Sister)
    tempRels.push({
      id: '66666666-6666-4666-8666-666666666666',
      person_id: nikhilId,
      related_person_id: meghanaId,
      relationship_type: 'parent',
      parent_type: 'biological',
      start_date: null,
      end_date: null,
      notes: null,
      created_at: new Date().toISOString(),
    });

    await fs.writeFile(path.join(tempTestDir, 'persons.json'), JSON.stringify({ persons: tempPersons }, null, 2));
    await fs.writeFile(path.join(tempTestDir, 'relationships.json'), JSON.stringify({ relationships: tempRels }, null, 2));

    // A) Check from Shanmuga (ME)'s perspective:
    const resFromShanmuga = await fetch(`${baseUrl}/${shanmugaId}/relatives`);
    const dataFromShanmuga = await resFromShanmuga.json();
    const relsFromMe = dataFromShanmuga.data.relatives;

    // 1. Sister's son must be Nephew
    const nikhilFromMe = relsFromMe.nephews_nieces.find((n: any) => n.person_id === nikhilId);
    assert(nikhilFromMe && nikhilFromMe.relationship === 'Nephew', "From ME's perspective: Sister's son is Nephew");

    // 2. Cousin's son must be First Cousin Once Removed (NOT nephew!)
    const rohanInNephews = relsFromMe.nephews_nieces.some((n: any) => n.person_id === rohanId);
    assert(!rohanInNephews, "From ME's perspective: Cousin's son is NOT in nephews_nieces");

    const rohanFromMe = relsFromMe.first_cousins_once_removed.find((c: any) => c.person_id === rohanId);
    assert(
      rohanFromMe && rohanFromMe.relationship.includes('First Cousin Once Removed'),
      "From ME's perspective: Cousin's son is First Cousin Once Removed"
    );

    // 3. Cousin's husband must be Cousin's Husband in in_laws
    const kiranFromMe = relsFromMe.in_laws.find((i: any) => i.person_id === kiranId);
    assert(
      kiranFromMe && kiranFromMe.relationship === "Cousin's Husband",
      "From ME's perspective: Cousin's husband is Cousin's Husband"
    );

    // B) Check from Rohan (Cousin's Son)'s perspective:
    const resFromRohan = await fetch(`${baseUrl}/${rohanId}/relatives`);
    const dataFromRohan = await resFromRohan.json();
    const relsFromRohan = dataFromRohan.data.relatives;

    // 1. Mother is Revati
    const revatiFromRohan = relsFromRohan.parents.find((p: any) => p.person_id === revatiId);
    assert(revatiFromRohan && revatiFromRohan.relationship === 'Mother', "From Rohan's perspective: Revati is Mother");

    // 2. Shanmuga is First Cousin Once Removed
    const shanmugaFromRohan = relsFromRohan.first_cousins_once_removed.find((c: any) => c.person_id === shanmugaId);
    assert(
      shanmugaFromRohan && shanmugaFromRohan.relationship.includes('First Cousin Once Removed'),
      "From Rohan's perspective: Shanmuga is First Cousin Once Removed"
    );

    // 3. Murthy Chetty is Great-Grandfather
    const murthyId = '867842c1-b8a2-45ad-8d9c-89150e68eb16';
    const murthyFromRohan = relsFromRohan.great_grandparents.find((g: any) => g.person_id === murthyId);
    assert(
      murthyFromRohan && murthyFromRohan.relationship === 'Great-Grandfather',
      "From Rohan's perspective: Murthy Chetty is Great-Grandfather"
    );

    // C) Check dedicated endpoint GET /api/persons/:id/relationship-to/:targetId
    const resRelBetween = await fetch(`${baseUrl}/${shanmugaId}/relationship-to/${rohanId}`);
    assert(resRelBetween.status === 200, 'GET /api/persons/:id/relationship-to/:targetId returns 200');
    const dataRelBetween = await resRelBetween.json();
    assert(dataRelBetween.success === true, 'relationship-to response has success: true');
    assert(
      dataRelBetween.data.relationship.includes('First Cousin Once Removed'),
      'relationship is First Cousin Once Removed'
    );
    assert(
      dataRelBetween.data.reverse_relationship.includes('First Cousin Once Removed'),
      'reverse_relationship is First Cousin Once Removed'
    );

    // --- Test 14: Original production database integrity check ---
    const origPersons = JSON.parse(await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8')).persons;
    const origRels = JSON.parse(await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8')).relationships;
    assert(origPersons.length === 19, `Original database has exactly 19 persons (verified: ${origPersons.length})`);
    assert(origRels.length === 29, `Original database has exactly 29 relationships (verified: ${origRels.length})`);

    console.log(`\n🎉 All ${passed}/${total} Milestone 2.6 Relative Derivation tests PASSED!`);
  } finally {
    server.close();
    // Cleanup temporary test directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  }
}

runRelativeDerivationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
