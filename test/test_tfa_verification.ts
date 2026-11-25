import assert from 'assert';
import { personApi } from '../src/services/personApi';
import { relationshipApi } from '../src/services/relationshipApi';
import {
  verificationApi,
  buildFactId,
  getVerificationBadgeInfo,
  computeLineageTrustScore,
  resetTestVerificationStore,
} from '../src/services/verificationApi';
import {
  generateTfaQuestionsForViewer,
  shouldTriggerTfaPrompt,
} from '../src/utils/tfaQuestionEngine';
import {
  getLineageMemberIdSet,
  getEffectiveViewerRole,
  resolveUnlockedLineagesOnSwitch,
  GUEST_VIEWER_ID,
} from '../src/utils/viewerRole';

console.log('================================================================');
console.log('   TEST SUITE: TWO-STEP DATA VERIFICATION (TFA) & QUESTION AI   ');
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

async function runAll() {
  resetTestVerificationStore();

  const personsRes = await personApi.getAll({ includeArchived: false });
  const relsRes = await relationshipApi.getAll();
  const allPersons = personsRes.data || [];
  const allRels = relsRes.data || [];

  await runTest('Rule (a): "Who are you in this family?" excludes deceased members', () => {
    const livingCandidates = allPersons.filter((p) => p.is_living !== false && !p.death_date);
    assert.ok(livingCandidates.length > 0, 'Must have living family members');
    assert.ok(
      livingCandidates.every((p) => p.is_living !== false && !p.death_date),
      'No deceased member may appear in Who Are You selector'
    );
  });

  await runTest('Rule (b) & (f): Algorithmic question engine dynamically frames kinship, DOB & birthplace questions', async () => {
    const meghana = allPersons.find((p) => p.first_name === 'Meghana');
    assert.ok(meghana, 'Meghana must exist in DB');

    const questions = generateTfaQuestionsForViewer(
      allPersons,
      allRels,
      meghana.id,
      {},
      { maxQuestions: 50, rng: () => 0.5 }
    );

    assert.ok(questions.length > 0, 'Algorithm must dynamically frame questions for Meghana');
    assert.ok(
      questions.some((q) => q.entity_type === 'relationship'),
      'Must frame relationship verification questions'
    );
    assert.ok(
      questions.some((q) => q.field === 'birth_date'),
      'Must frame DOB verification questions'
    );
    for (const q of questions) {
      assert.ok(q.question_text.endsWith('?'), 'Question must be properly formatted');
      assert.ok(
        q.allowFillInput ? q.options.length >= 2 : q.options.length >= 3,
        'Question must provide options'
      );
    }
  });

  await runTest('Rule (c): Author who recorded data NEVER receives it as a TFA question', async () => {
    const shanmuga = allPersons.find((p) => p.first_name.includes('Shanmuga'));
    const meghana = allPersons.find((p) => p.first_name === 'Meghana');
    assert.ok(shanmuga && meghana);

    // Shanmuga records a new member's DOB and birth place
    const created = await personApi.create({
      first_name: 'Kavya',
      last_name: 'Konukuru',
      gender: 'female',
      birth_date: '2006',
      birth_place: 'Tirupati',
      is_living: true,
      father_id: shanmuga.id,
    });
    assert.ok(created.data);
    const kavyaId = created.data.id;

    await verificationApi.recordAuthorEntry({
      entityType: 'person',
      entityId: kavyaId,
      field: 'birth_date',
      authorId: shanmuga.id,
    });

    const verMap = (await verificationApi.getAllMap()).data || {};

    // Shanmuga (author) MUST NOT be asked to verify Kavya's DOB
    const shanmugaQuestions = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      shanmuga.id,
      verMap,
      { maxQuestions: 50, rng: () => 0.5 }
    );
    const kavyaDobFactId = buildFactId('person', kavyaId, 'birth_date');
    assert.strictEqual(
      shanmugaQuestions.some((q) => q.fact_id === kavyaDobFactId),
      false,
      'Author must NEVER receive their own entry as a TFA question'
    );

    // Attempting direct self-verification via API must also be rejected
    const selfAttempt = await verificationApi.submitAnswer({
      factId: kavyaDobFactId,
      entityType: 'person',
      entityId: kavyaId,
      field: 'birth_date',
      recordedBy: shanmuga.id,
      viewerId: shanmuga.id,
      action: 'confirm',
    });
    assert.strictEqual(selfAttempt.success, false);
    assert.strictEqual(selfAttempt.error?.code, 'SELF_VERIFICATION_FORBIDDEN');

    // Another family member (Meghana) CAN receive and verify it
    const meghanaQuestions = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      verMap,
      { maxQuestions: 100, rng: () => 0.5 }
    );
    const kavyaQuestion = meghanaQuestions.find((q) => q.fact_id === kavyaDobFactId);
    assert.ok(kavyaQuestion, 'Another family member must be eligible to verify Kavya DOB');
    assert.ok(
      kavyaQuestion.options.some((o) => o.label === '2006' && o.action === 'confirm'),
      'Smart multiple-choice options must include recorded birth year 2006'
    );
  });

  await runTest('Two-Step Badge Progression: 1/2 transitions to 2/2 Verified upon second member acknowledgment', async () => {
    const shanmuga = allPersons.find((p) => p.first_name.includes('Shanmuga'))!;
    const meghana = allPersons.find((p) => p.first_name === 'Meghana')!;
    const kavya = (await personApi.getAll()).data!.find((p) => p.first_name === 'Kavya')!;
    const factId = buildFactId('person', kavya.id, 'birth_date');

    const beforeMap = (await verificationApi.getAllMap()).data || {};
    const beforeBadge = getVerificationBadgeInfo(beforeMap[factId]);
    assert.strictEqual(beforeBadge.label, '1/2');
    assert.strictEqual(beforeBadge.isVerified, false);

    // Meghana confirms
    const ackRes = await verificationApi.submitAnswer({
      factId,
      entityType: 'person',
      entityId: kavya.id,
      field: 'birth_date',
      recordedBy: shanmuga.id,
      viewerId: meghana.id,
      action: 'confirm',
    });
    assert.strictEqual(ackRes.success, true);

    const afterBadge = getVerificationBadgeInfo(ackRes.data);
    assert.strictEqual(afterBadge.label, '2/2 Verified');
    assert.strictEqual(afterBadge.isVerified, true);

    // Once 2/2 Verified, no longer appears in TFA questions
    const afterMap = (await verificationApi.getAllMap()).data || {};
    const thirdParty = allPersons.find((p) => p.id !== shanmuga.id && p.id !== meghana.id)!;
    const thirdPartyQuestions = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      thirdParty.id,
      afterMap,
      { maxQuestions: 100 }
    );
    assert.strictEqual(
      thirdPartyQuestions.some((q) => q.fact_id === factId),
      false,
      '2/2 Verified fact must not be asked again'
    );
  });

  await runTest('Rule (d): Random probabilistic trigger does not prompt on every visit', () => {
    assert.strictEqual(shouldTriggerTfaPrompt(0.5, () => 0.2), true, 'Triggers when rng < probability');
    assert.strictEqual(shouldTriggerTfaPrompt(0.5, () => 0.8), false, 'Skips when rng >= probability');
  });

  await runTest('Lineage Scoping & Guest Role: Navaneeth Galeti vs Meghana Konukuru code retention rules', () => {
    const lineageMemberMap = {
      konukuru: getLineageMemberIdSet(allPersons, allRels, 'konukuru'),
      paradarami: getLineageMemberIdSet(allPersons, allRels, 'paradarami'),
    };

    const navaneeth = allPersons.find((p) => p.first_name === 'Navaneeth')!;
    const meghana = allPersons.find((p) => p.first_name === 'Meghana')!;
    assert.ok(navaneeth && meghana);

    // Navaneeth is ONLY in Paradarami, NOT Konukuru
    assert.strictEqual(lineageMemberMap.paradarami.has(navaneeth.id), true);
    assert.strictEqual(lineageMemberMap.konukuru.has(navaneeth.id), false);

    // Meghana is in BOTH Konukuru and Paradarami
    assert.strictEqual(lineageMemberMap.konukuru.has(meghana.id), true);
    assert.strictEqual(lineageMemberMap.paradarami.has(meghana.id), true);

    // Guest tile always gets guest role
    assert.strictEqual(getEffectiveViewerRole(GUEST_VIEWER_ID, 'paradarami', lineageMemberMap), 'guest');

    // Navaneeth is 'member' in Paradarami, but takes 'guest' role in Konukuru
    assert.strictEqual(getEffectiveViewerRole(navaneeth.id, 'paradarami', lineageMemberMap), 'member');
    assert.strictEqual(getEffectiveViewerRole(navaneeth.id, 'konukuru', lineageMemberMap), 'guest');

    // Navaneeth's access to non-member Konukuru is RETAINED when switching back to Paradarami
    const navaneethAfterSwitch = resolveUnlockedLineagesOnSwitch({
      viewerId: navaneeth.id,
      fromLineageId: 'konukuru',
      toLineageId: 'paradarami',
      currentUnlocked: ['paradarami', 'konukuru'],
      lineageMemberMap,
    });
    assert.ok(navaneethAfterSwitch.includes('konukuru'), 'Non-member family access must be retained for Navaneeth');
    assert.ok(navaneethAfterSwitch.includes('paradarami'));

    // Meghana is in BOTH families: switching from Konukuru to Paradarami does NOT retain Konukuru
    const meghanaAfterSwitch = resolveUnlockedLineagesOnSwitch({
      viewerId: meghana.id,
      fromLineageId: 'konukuru',
      toLineageId: 'paradarami',
      currentUnlocked: ['konukuru'],
      lineageMemberMap,
    });
    assert.strictEqual(meghanaAfterSwitch.includes('konukuru'), false, 'Meghana must NOT retain simultaneous access to both families');
    assert.ok(meghanaAfterSwitch.includes('paradarami'));
  });

  await runTest('Upgrades 1-7: Smart distractors, conflict tie-breaker, fill-in-the-blank, branch cooling, compound check & trust score', async () => {
    const shanmuga = allPersons.find((p) => p.first_name.includes('Shanmuga'))!;
    const meghana = allPersons.find((p) => p.first_name === 'Meghana')!;
    const kavya = (await personApi.getAll()).data!.find((p) => p.first_name === 'Kavya')!;

    // Upgrade 1: Smart multiple-choice distractors for birth year (2006)
    const freshPerson = (await personApi.create({
      first_name: 'Vikram',
      last_name: 'Konukuru',
      gender: 'male',
      birth_date: '2005',
      alias: 'Vicky',
      is_living: true,
      father_id: shanmuga.id,
    })).data!;

    const qList = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      {},
      { maxQuestions: 100, rng: () => 0.5 }
    );

    const vikramDobQ = qList.find((q) => q.entity_id === freshPerson.id && q.field === 'birth_date');
    assert.ok(vikramDobQ, 'Must generate DOB question for Vikram');
    assert.ok(vikramDobQ.options.some((o) => o.label === '2005' && o.action === 'confirm'), 'Must include correct year option');
    assert.ok(vikramDobQ.options.length >= 4, 'Must include multiple-choice distractors');

    // Upgrade 7: Alias verifiable field
    const vikramAliasQ = qList.find((q) => q.entity_id === freshPerson.id && q.field === 'alias');
    assert.ok(vikramAliasQ && vikramAliasQ.question_text.includes('Vicky'), 'Must verify alias field');

    // Upgrade 5: Compound triangulated couple-children question
    const compoundQ = qList.find((q) => q.fact_id.endsWith('__compound'));
    assert.ok(compoundQ, 'Must generate triangulated couple-children question');

    // Upgrade 2: Conflict resolution & tie-breaker boost (+200)
    const vikramDobFact = buildFactId('person', freshPerson.id, 'birth_date');
    await verificationApi.submitAnswer({
      factId: vikramDobFact,
      entityType: 'person',
      entityId: freshPerson.id,
      field: 'birth_date',
      recordedBy: shanmuga.id,
      viewerId: kavya.id,
      action: 'reject',
      suggestedValue: '2004',
    });
    const mapAfterDispute = (await verificationApi.getAllMap()).data || {};
    assert.strictEqual(mapAfterDispute[vikramDobFact].suggested_corrections?.[0].value, '2004');
    const tieBreakerQ = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      mapAfterDispute,
      { maxQuestions: 10, rng: () => 0.5 }
    );
    const boosted = tieBreakerQ.find((q) => q.fact_id === vikramDobFact);
    assert.ok(boosted && boosted.isDisputed, 'Disputed fact must be prioritized for 3rd-party tie-breaker');

    // Upgrade 3: Fill-in-the-blank for missing DOB
    const noDob = (await personApi.create({
      first_name: 'Nikhil',
      last_name: 'Konukuru',
      gender: 'male',
      is_living: true,
      father_id: shanmuga.id,
    })).data!;
    const fillQ = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      mapAfterDispute,
      { maxQuestions: 100, rng: () => 0.5 }
    ).find((q) => q.entity_id === noDob.id && q.field === 'birth_date');
    assert.ok(fillQ && fillQ.allowFillInput, 'Missing DOB must trigger fill-in-the-blank prompt');

    // Upgrade 4: Adaptive branch cooling lowers score
    const uncooled = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      mapAfterDispute,
      { maxQuestions: 100, rng: () => 0.5 }
    ).find((q) => q.fact_id === vikramDobFact)!;
    const cooled = generateTfaQuestionsForViewer(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      meghana.id,
      mapAfterDispute,
      { maxQuestions: 100, cooledBranchKeys: new Set(['konukuru']), rng: () => 0.5 }
    ).find((q) => q.fact_id === vikramDobFact)!;
    assert.ok(cooled.relevance_score < uncooled.relevance_score, 'Cooled branch must reduce score');

    // Upgrade 6: Lineage Trust Score
    const trust = computeLineageTrustScore(
      (await personApi.getAll()).data || [],
      (await relationshipApi.getAll()).data || [],
      mapAfterDispute
    );
    assert.ok(trust.totalFacts > 0 && trust.percentage >= 0 && trust.percentage <= 100);
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
