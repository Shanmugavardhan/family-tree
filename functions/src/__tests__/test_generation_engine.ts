import * as path from 'path';
import * as fs from 'fs/promises';
import { GenerationService } from '../generations/generation.service';
import { GenerationConfigError } from '../generations/generation.validator';
import { Generation } from '../generations/generation.types';

async function runGenerationEngineTests() {
  console.log('=== Running Tests for Milestone 3.1 (Chronological Generation Engine) ===\n');
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

  const service = new GenerationService();

  // --- Section 1: Standard Config Definitions Check ---
  const defs = service.getGenerationDefinitions();
  assert(defs.length === 11, `Expected 11 standard generation definitions, got ${defs.length}`);
  assert(defs[0].id === 'ancestral_gilded' && defs[0].startYear === 1843 && defs[0].endYear === 1859, 'Gilded Generation defined: 1843–1859');
  assert(defs[1].id === 'missionary' && defs[1].startYear === 1860 && defs[1].endYear === 1882, 'Missionary Generation defined: 1860–1882');
  assert(defs[2].id === 'lost' && defs[2].startYear === 1883 && defs[2].endYear === 1900, 'Lost Generation defined: 1883–1900');
  assert(defs[3].id === 'greatest' && defs[3].startYear === 1901 && defs[3].endYear === 1927, 'Greatest Generation defined: 1901–1927');
  assert(defs[4].id === 'silent' && defs[4].startYear === 1928 && defs[4].endYear === 1945, 'Silent Generation defined: 1928–1945');
  assert(defs[5].id === 'baby_boomers' && defs[5].startYear === 1946 && defs[5].endYear === 1964, 'Baby Boomers defined: 1946–1964');
  assert(defs[6].id === 'gen_x' && defs[6].startYear === 1965 && defs[6].endYear === 1980, 'Generation X defined: 1965–1980');
  assert(defs[7].id === 'millennials' && defs[7].startYear === 1981 && defs[7].endYear === 1996, 'Millennials defined: 1981–1996');
  assert(defs[8].id === 'gen_z' && defs[8].startYear === 1997 && defs[8].endYear === 2012, 'Generation Z defined: 1997–2012');
  assert(defs[9].id === 'gen_alpha' && defs[9].startYear === 2013 && defs[9].endYear === 2024, 'Generation Alpha defined: 2013–2024');
  assert(defs[10].id === 'gen_beta' && defs[10].startYear === 2025 && defs[10].endYear === 2039, 'Generation Beta defined: 2025–2039');

  // --- Section 2: Mandatory Birth Year Range Tests ---
  assert(service.getGenerationByBirthYear(1850)?.id === 'ancestral_gilded', 'Birth year 1850 -> Gilded Generation');
  assert(service.getGenerationByBirthYear(1870)?.id === 'missionary', 'Birth year 1870 -> Missionary Generation');
  assert(service.getGenerationByBirthYear(1890)?.id === 'lost', 'Birth year 1890 -> Lost Generation');
  assert(service.getGenerationByBirthYear(1910)?.id === 'greatest', 'Birth year 1910 -> Greatest Generation');
  assert(service.getGenerationByBirthYear(1928)?.id === 'silent', 'Birth year 1928 -> Silent Generation');
  assert(service.getGenerationByBirthYear(1945)?.id === 'silent', 'Birth year 1945 -> Silent Generation');
  assert(service.getGenerationByBirthYear(1946)?.id === 'baby_boomers', 'Birth year 1946 -> Baby Boomers');
  assert(service.getGenerationByBirthYear(1964)?.id === 'baby_boomers', 'Birth year 1964 -> Baby Boomers');
  assert(service.getGenerationByBirthYear(1965)?.id === 'gen_x', 'Birth year 1965 -> Generation X');
  assert(service.getGenerationByBirthYear(1980)?.id === 'gen_x', 'Birth year 1980 -> Generation X');
  assert(service.getGenerationByBirthYear(1981)?.id === 'millennials', 'Birth year 1981 -> Millennials');
  assert(service.getGenerationByBirthYear(1996)?.id === 'millennials', 'Birth year 1996 -> Millennials');
  assert(service.getGenerationByBirthYear(1997)?.id === 'gen_z', 'Birth year 1997 -> Generation Z');
  assert(service.getGenerationByBirthYear(2012)?.id === 'gen_z', 'Birth year 2012 -> Generation Z');
  assert(service.getGenerationByBirthYear(2013)?.id === 'gen_alpha', 'Birth year 2013 -> Generation Alpha');
  assert(service.getGenerationByBirthYear(2024)?.id === 'gen_alpha', 'Birth year 2024 -> Generation Alpha');
  assert(service.getGenerationByBirthYear(2025)?.id === 'gen_beta', 'Birth year 2025 -> Generation Beta');
  assert(service.getGenerationByBirthYear(2039)?.id === 'gen_beta', 'Birth year 2039 -> Generation Beta');

  // --- Section 3: Boundary & Out-of-Range Handling ---
  assert(service.getGenerationByBirthYear(1842) === null, 'Birth year 1842 -> null (before lowest definition)');
  assert(service.getGenerationByBirthYear(2040) === null, 'Birth year 2040 -> null (after highest definition)');
  assert(service.getGenerationByBirthYear(null) === null, 'Birth year null -> null');
  assert(service.getGenerationByBirthYear(undefined) === null, 'Birth year undefined -> null');
  assert(service.getGenerationByBirthYear(NaN) === null, 'Birth year NaN -> null');

  // --- Section 4: Person Entity Classification & Missing Dates ---
  const personNoDate = { id: 'p1', birth_date: null };
  assert(service.getGenerationForPerson(personNoDate) === null, 'Missing birth date -> returns null without fabricating generation');

  const personBlankDate = { id: 'p2', birth_date: '   ' };
  assert(service.getGenerationForPerson(personBlankDate) === null, 'Blank string birth date -> returns null');

  const personJag = { id: 'p3', birth_date: '1972-10-16' };
  assert(service.getGenerationForPerson(personJag)?.id === 'gen_x', 'Jagannadham (1972-10-16) -> Generation X');

  const personMeghana = { id: 'p4', birth_date: '2001-05-30' };
  assert(service.getGenerationForPerson(personMeghana)?.id === 'gen_z', 'Meghana (2001-05-30) -> Generation Z');

  const personShanmuga = { id: 'p5', birth_date: '2004-07-23' };
  assert(service.getGenerationForPerson(personShanmuga)?.id === 'gen_z', 'Shanmuga (2004-07-23) -> Generation Z');

  const personDmy = { id: 'p6', birth_date: '23-07-2004' };
  assert(service.getGenerationForPerson(personDmy)?.id === 'gen_z', 'Supports DD-MM-YYYY format (23-07-2004) -> Generation Z');

  const personYearOnly = { id: 'p7', birth_date: '1955' };
  assert(service.getGenerationForPerson(personYearOnly)?.id === 'baby_boomers', 'Supports year-only format ("1955") -> Baby Boomers');

  // --- Section 5: Invalid Date Strings ---
  assert(service.extractBirthYear('not-a-date') === null, 'Invalid string "not-a-date" -> extractBirthYear returns null');
  assert(service.extractBirthYear('1998-02-31') === null, 'Non-existent calendar date "1998-02-31" -> returns null');
  assert(service.extractBirthYear('1998-13-01') === null, 'Invalid month 13 -> returns null');
  assert(service.getGenerationForPerson({ id: 'p-bad', birth_date: 'invalid' }) === null, 'Invalid date string person -> returns null');

  // --- Section 6: Age Calculation with Explicit Reference Date ---
  // Test case: Born 1998-11-20, reference year 2026
  // Day before birthday (2026-11-19) -> Age 27
  const refDayBefore = new Date(2026, 10, 19); // Months are 0-indexed: 10 = Nov
  assert(service.getAgeAtDate('1998-11-20', refDayBefore) === 27, 'Exact birthday vs day before: on 2026-11-19, age is 27');

  // On exact birthday (2026-11-20) -> Age 28
  const refExactBirthday = new Date(2026, 10, 20);
  assert(service.getAgeAtDate('1998-11-20', refExactBirthday) === 28, 'On exact birthday: on 2026-11-20, age turns 28');

  // Day after birthday (2026-11-21) -> Age 28
  const refDayAfter = new Date(2026, 10, 21);
  assert(service.getAgeAtDate('1998-11-20', refDayAfter) === 28, 'Day after birthday: on 2026-11-21, age is 28');

  // Reference date before birth date -> returns null (future birth)
  const refPast = new Date(1990, 0, 1);
  assert(service.getAgeAtDate('1998-11-20', refPast) === null, 'Reference date before birth date -> returns null');

  // Year-only age calculation: must return null for exact age to avoid false precision
  const refYearOnly = new Date(2026, 5, 15);
  assert(service.getAgeAtDate('1998', refYearOnly) === null, 'Year-only birth date ("1998") returns null for exact age (unknown month/day)');
  assert(service.getAgeAtDate('1955', refYearOnly) === null, 'Year-only birth date ("1955") returns null for exact age');
  assert(service.getGenerationByBirthYear(1998)?.id === 'gen_z', 'Year-only value 1998 still classifies as Generation Z');
  assert(service.getGenerationForPerson({ id: 'p-year', birth_date: '1998' })?.id === 'gen_z', 'Person with year-only birth date "1998" classifies as Generation Z');

  // Invalid birth date age calculation -> null
  assert(service.getAgeAtDate('invalid', refYearOnly) === null, 'Invalid birth date returns null age');
  assert(service.getAgeAtDate(null, refYearOnly) === null, 'Null birth date returns null age');

  // --- Section 7: Leap-Year Birthday Tests ---
  // Born Feb 29, 2000
  // Leap year 2024:
  // On 2024-02-28 (day before) -> Age 23
  assert(service.getAgeAtDate('2000-02-29', new Date(2024, 1, 28)) === 23, 'Leap year birthday: 2024-02-28 age is 23');
  // On 2024-02-29 (exact leap day) -> Age 24
  assert(service.getAgeAtDate('2000-02-29', new Date(2024, 1, 29)) === 24, 'Leap year birthday: 2024-02-29 age is 24');

  // Non-leap year 2025:
  // On 2025-02-28 (Feb 28 in non-leap) -> Age 24 (birthday not yet reached)
  assert(service.getAgeAtDate('2000-02-29', new Date(2025, 1, 28)) === 24, 'Non-leap year: 2025-02-28 age is 24');
  // On 2025-03-01 (March 1 in non-leap) -> Age 25 (birthday reached)
  assert(service.getAgeAtDate('2000-02-29', new Date(2025, 2, 1)) === 25, 'Non-leap year: 2025-03-01 age is 25');

  // Invalid non-leap day Feb 29 (1999 is not a leap year)
  assert(service.extractBirthYear('1999-02-29') === null, 'Non-leap year 1999-02-29 is rejected as invalid date');

  // --- Section 8: Configuration Validation & Error Handling ---
  // Overlapping year ranges
  const overlappingDefs: Generation[] = [
    { id: 'g1', name: 'G1', startYear: 1928, endYear: 1945, order: 1 },
    { id: 'g2', name: 'G2', startYear: 1945, endYear: 1960, order: 2 }, // overlaps at 1945
  ];
  let caughtOverlap = false;
  try {
    new GenerationService(overlappingDefs);
  } catch (err: any) {
    if (err instanceof GenerationConfigError && err.message.includes('overlaps')) {
      caughtOverlap = true;
    }
  }
  assert(caughtOverlap, 'Overlapping generation year ranges rejected with GenerationConfigError');

  // Inverted range (startYear > endYear)
  const invertedDefs: Generation[] = [
    { id: 'g1', name: 'G1', startYear: 1960, endYear: 1940, order: 1 },
  ];
  let caughtInverted = false;
  try {
    new GenerationService(invertedDefs);
  } catch (err: any) {
    if (err instanceof GenerationConfigError && err.message.includes('startYear')) {
      caughtInverted = true;
    }
  }
  assert(caughtInverted, 'Inverted generation range (startYear > endYear) rejected with GenerationConfigError');

  // Empty definitions array
  let caughtEmpty = false;
  try {
    new GenerationService([]);
  } catch (err: any) {
    if (err instanceof GenerationConfigError) {
      caughtEmpty = true;
    }
  }
  assert(caughtEmpty, 'Empty generation definitions array rejected with GenerationConfigError');

  // Duplicate generation IDs
  const duplicateIdDefs: Generation[] = [
    { id: 'gen_z', name: 'Gen Z-1', startYear: 1997, endYear: 2005, order: 1 },
    { id: 'gen_z', name: 'Gen Z-2', startYear: 2006, endYear: 2012, order: 2 },
  ];
  let caughtDuplicateId = false;
  try {
    new GenerationService(duplicateIdDefs);
  } catch (err: any) {
    if (err instanceof GenerationConfigError && err.message.includes('Duplicate generation id')) {
      caughtDuplicateId = true;
    }
  }
  assert(caughtDuplicateId, 'Duplicate generation IDs rejected with GenerationConfigError');

  // --- Section 9: Decoupling from Kinship (Core Phase 3 Principle) ---
  // Case A: Parents in different cohorts, child strictly in their own birth cohort
  const fatherPerson = { id: 'father', birth_date: '1972-05-10' }; // 1972 -> Gen X
  const motherPerson = { id: 'mother', birth_date: '1982-08-15' }; // 1982 -> Millennials
  const childPerson = { id: 'child', birth_date: '2004-03-25' };   // 2004 -> Gen Z

  const fatherGen = service.getGenerationForPerson(fatherPerson);
  const motherGen = service.getGenerationForPerson(motherPerson);
  const childGen = service.getGenerationForPerson(childPerson);

  assert(fatherGen?.id === 'gen_x', 'Father belongs to Generation X (1972)');
  assert(motherGen?.id === 'millennials', 'Mother belongs to Millennials (1982)');
  assert(childGen?.id === 'gen_z', 'Child belongs strictly to Generation Z (2004) regardless of parents cohorts');

  // Case B: Uncle and Nephew in the EXACT SAME birth cohort
  // Uncle born in 1998 (Gen Z), Nephew born in 1999 (Gen Z)
  const unclePerson = { id: 'uncle', birth_date: '1998-04-12' };
  const nephewPerson = { id: 'nephew', birth_date: '1999-11-05' };

  const uncleGen = service.getGenerationForPerson(unclePerson);
  const nephewGen = service.getGenerationForPerson(nephewPerson);

  assert(uncleGen?.id === 'gen_z', 'Uncle born in 1998 belongs to Generation Z');
  assert(nephewGen?.id === 'gen_z', 'Nephew born in 1999 belongs to Generation Z');
  assert(uncleGen?.id === nephewGen?.id, 'Uncle and Nephew are both in Generation Z: genealogical hierarchy does NOT dictate cohort placement');

  // --- Section 10: ClassifyPerson Composite Method ---
  const ref2026 = new Date(2026, 10, 17); // Nov 17, 2026
  const classifiedShanmuga = service.classifyPerson({ id: 'shanmuga', birth_date: '2004-07-23' }, ref2026);
  assert(classifiedShanmuga.birthYear === 2004, 'ClassifyPerson extracts correct birthYear (2004)');
  assert(classifiedShanmuga.generation?.id === 'gen_z', 'ClassifyPerson classifies generation as gen_z');
  assert(classifiedShanmuga.age === 22, 'ClassifyPerson calculates age 22 as of Nov 17, 2026 (born Jul 23, 2004)');

  // --- Section 11: Preservation of Canonical Database ---
  const rootDataDir = path.resolve(__dirname, '../../../data');
  const personsRaw = JSON.parse(await fs.readFile(path.join(rootDataDir, 'persons.json'), 'utf-8')).persons;
  const relsRaw = JSON.parse(await fs.readFile(path.join(rootDataDir, 'relationships.json'), 'utf-8')).relationships;
  assert(personsRaw.length === 14, `Canonical database has exactly 14 persons (verified: ${personsRaw.length})`);
  assert(relsRaw.length === 21, `Canonical database has exactly 21 relationships (verified: ${relsRaw.length})`);

  console.log(`\n🎉 All ${passed}/${total} Milestone 3.1 Chronological Generation Engine tests PASSED!`);
}

runGenerationEngineTests().catch((err) => {
  console.error('Generation engine test failed:', err);
  process.exit(1);
});
