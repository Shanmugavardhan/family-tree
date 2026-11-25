import assert from 'assert';
import { personApi } from '../src/services/personApi';
import { relationshipApi } from '../src/services/relationshipApi';
import {
  verificationApi,
  buildFactId,
  getVerificationBadgeInfo,
  resetTestVerificationStore,
} from '../src/services/verificationApi';
import {
  generateTfaQuestionsForViewer,
  shouldTriggerTfaPrompt,
} from '../src/utils/tfaQuestionEngine';

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
      assert.ok(q.options.length >= 3, 'Question must provide multiple-choice options');
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
    assert.ok(kavyaQuestion.question_text.includes('2006'), 'Dynamic question must include recorded birth year 2006');
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

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
