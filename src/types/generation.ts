import { Person } from './person';

export interface Generation {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  order: number;
  backgroundColor?: string;
  textColor?: string;
  description?: string;
}

export interface PersonGenerationResult {
  personId: string;
  birthYear: number | null;
  generation: Generation | null;
  age: number | null;
}

export type PersonInputForGeneration = Pick<Person, 'id' | 'birth_date'>;

