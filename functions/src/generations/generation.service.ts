import {
  Generation,
  PersonGenerationResult,
  PersonInputForGeneration,
} from './generation.types';
import { GENERATION_DEFINITIONS } from './generation.config';
import { validateGenerationDefinitions } from './generation.validator';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

interface ParsedDateParts {
  year: number;
  month?: number; // 1-12
  day?: number;   // 1-31
}

function parseDateParts(dateStr: string | null | undefined): ParsedDateParts | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);

    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays) {
      return null; // Invalid calendar date
    }
    return { year, month, day };
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    const maxDays = getDaysInMonth(year, month);
    if (month < 1 || month > 12 || day < 1 || day > maxDays) {
      return null;
    }
    return { year, month, day };
  }

  // 3. Check year only: YYYY
  const yearMatch = /^\d{4}$/.exec(trimmed);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);
    if (year <= 0) return null;
    return { year };
  }

  return null;
}

export class GenerationService {
  private definitions: Generation[];

  constructor(definitions: Generation[] = GENERATION_DEFINITIONS) {
    validateGenerationDefinitions(definitions);
    this.definitions = [...definitions].sort((a, b) => a.order - b.order);
  }

  /**
   * Returns a copy of all configured generation definitions, sorted by order.
   */
  getGenerationDefinitions(): Generation[] {
    return [...this.definitions];
  }

  /**
   * Classifies a birth year into its corresponding birth-cohort generation.
   * Pure operation: independent of any genealogical relationships.
   */
  getGenerationByBirthYear(year: number | null | undefined): Generation | null {
    if (year === null || year === undefined || isNaN(year) || !Number.isInteger(year)) {
      return null;
    }

    const match = this.definitions.find(
      (gen) => year >= gen.startYear && year <= gen.endYear
    );
    return match || null;
  }

  /**
   * Classifies a Person's birth-cohort generation based strictly on their birth year.
   * Returns null if birth_date is missing, invalid, or outside configured ranges.
   */
  getGenerationForPerson(person: PersonInputForGeneration | null | undefined): Generation | null {
    if (!person || !person.birth_date) {
      return null;
    }

    const birthYear = this.extractBirthYear(person.birth_date);
    if (birthYear === null) {
      return null;
    }

    return this.getGenerationByBirthYear(birthYear);
  }

  /**
   * Extracts the 4-digit birth year from a date string (YYYY-MM-DD, DD-MM-YYYY, or YYYY).
   * Validates calendar correctness.
   */
  extractBirthYear(birthDate: string | null | undefined): number | null {
    const parts = parseDateParts(birthDate);
    return parts ? parts.year : null;
  }

  /**
   * Calculates a person's exact chronological age as of an explicit reference date.
   *
   * Rules:
   * 1. Full valid birth date (YYYY-MM-DD): returns exact age taking birthday occurrence into account.
   * 2. Year-only birth date (YYYY): returns null because exact birthday is unknown (avoids false precision).
   * 3. Missing, invalid, or future birth dates relative to referenceDate return null.
   * 4. Leap-year birth (Feb 29): in non-leap years, birthday is considered reached on March 1.
   */
  getAgeAtDate(birthDate: string | null | undefined, referenceDate: Date): number | null {
    if (!referenceDate || isNaN(referenceDate.getTime())) {
      return null;
    }

    const parts = parseDateParts(birthDate);
    if (!parts) {
      return null;
    }

    // Year-only birth dates do not have month/day precision, so exact age cannot be computed.
    if (parts.month === undefined || parts.day === undefined) {
      return null;
    }

    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth() + 1; // 1-12
    const refDay = referenceDate.getDate();

    // Check if birth is in future relative to reference date
    if (
      refYear < parts.year ||
      (refYear === parts.year && refMonth < parts.month) ||
      (refYear === parts.year && refMonth === parts.month && refDay < parts.day)
    ) {
      return null;
    }

    let age = refYear - parts.year;
    const hadBirthday =
      refMonth > parts.month ||
      (refMonth === parts.month && refDay >= parts.day);

    if (!hadBirthday) {
      age -= 1;
    }

    return age;
  }

  /**
   * Convenience method to classify person and compute age as of reference date.
   */
  classifyPerson(
    person: PersonInputForGeneration,
    referenceDate: Date = new Date()
  ): PersonGenerationResult {
    const birthYear = this.extractBirthYear(person.birth_date);
    const generation = this.getGenerationByBirthYear(birthYear);
    const age = this.getAgeAtDate(person.birth_date, referenceDate);

    return {
      personId: person.id,
      birthYear,
      generation,
      age,
    };
  }
}

