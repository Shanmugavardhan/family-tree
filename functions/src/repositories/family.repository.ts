import { Person } from '../types/person';
import { Relationship } from '../types/relationship';

export interface FamilyRepository {
  /**
   * Retrieves all persons in the database.
   * @param includeArchived Whether to include archived persons (default: false).
   */
  getAllPersons(includeArchived?: boolean): Promise<Person[]>;

  /**
   * Retrieves a single person by their permanent UUID.
   */
  getPersonById(id: string): Promise<Person | null>;

  /**
   * Retrieves all relationship records.
   */
  getAllRelationships(): Promise<Relationship[]>;

  /**
   * Retrieves all direct relationships involving a specific person.
   */
  getRelationshipsForPerson(personId: string): Promise<Relationship[]>;

  /**
   * Safely writes persons and relationships together with validation,
   * atomic file replacement, and optimistic concurrency version checking.
   */
  saveFamilyData(
    persons: Person[],
    relationships: Relationship[],
    expectedVersion?: number
  ): Promise<{ version: number }>;

  /**
   * Retrieves current repository snapshot version counter.
   */
  getVersion(): Promise<number>;
}

