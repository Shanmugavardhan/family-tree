import { Generation } from './generation.types';

export class GenerationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationConfigError';
  }
}

/**
 * Validates that generation definitions are complete, valid, and have no overlapping year ranges.
 */
export function validateGenerationDefinitions(definitions: Generation[]): void {
  if (!definitions || !Array.isArray(definitions) || definitions.length === 0) {
    throw new GenerationConfigError('Generation definitions array must not be empty.');
  }

  const ids = new Set<string>();
  const orders = new Set<number>();

  for (const gen of definitions) {
    if (!gen.id || typeof gen.id !== 'string' || !gen.id.trim()) {
      throw new GenerationConfigError('Generation definition must have a valid non-empty string id.');
    }
    if (!gen.name || typeof gen.name !== 'string' || !gen.name.trim()) {
      throw new GenerationConfigError(`Generation "${gen.id}" must have a valid non-empty display name.`);
    }
    if (!Number.isInteger(gen.startYear) || !Number.isInteger(gen.endYear)) {
      throw new GenerationConfigError(`Generation "${gen.id}" must have integer startYear and endYear.`);
    }
    if (gen.startYear > gen.endYear) {
      throw new GenerationConfigError(
        `Generation "${gen.id}" startYear (${gen.startYear}) cannot be greater than endYear (${gen.endYear}).`
      );
    }
    if (!Number.isInteger(gen.order)) {
      throw new GenerationConfigError(`Generation "${gen.id}" must have an integer order.`);
    }

    if (ids.has(gen.id)) {
      throw new GenerationConfigError(`Duplicate generation id detected: "${gen.id}".`);
    }
    ids.add(gen.id);

    if (orders.has(gen.order)) {
      throw new GenerationConfigError(`Duplicate generation display order detected: ${gen.order}.`);
    }
    orders.add(gen.order);
  }

  // Check for overlapping year ranges
  const sorted = [...definitions].sort((a, b) => a.startYear - b.startYear);
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.endYear >= next.startYear) {
      throw new GenerationConfigError(
        `Overlapping generation year ranges detected: "${current.name}" (${current.startYear}–${current.endYear}) overlaps with "${next.name}" (${next.startYear}–${next.endYear}).`
      );
    }
  }
}

