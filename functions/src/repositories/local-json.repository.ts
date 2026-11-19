import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { FamilyRepository } from './family.repository';
import { validateFamilyData, FamilyValidationError } from '../validators/family.validator';

export interface LocalJsonRepositoryOptions {
  dataDir?: string;
  personsFileName?: string;
  relationshipsFileName?: string;
}

/**
 * In-process async mutex to serialize write operations.
 */
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = this.queue;
    this.queue = current.then(() => next);

    await current;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class LocalJsonFamilyRepository implements FamilyRepository {
  private dataDir: string;
  private personsPath: string;
  private relationshipsPath: string;
  private mutex = new AsyncMutex();
  private version = 1;

  constructor(options: LocalJsonRepositoryOptions = {}) {
    if (options.dataDir) {
      this.dataDir = options.dataDir;
    } else if (process.env.DATA_DIR) {
      this.dataDir = path.resolve(process.env.DATA_DIR);
    } else {
      // Find candidate seed directory
      const candidates = [
        path.resolve(__dirname, '../../../data'),
        path.resolve(__dirname, '../../data'),
        path.resolve(__dirname, '../data'),
        path.resolve(process.cwd(), 'data'),
        path.resolve(process.cwd(), '../data'),
      ];
      const foundSeedDir =
        candidates.find(
          (dir) =>
            fsSync.existsSync(path.join(dir, 'persons.json')) &&
            fsSync.existsSync(path.join(dir, 'relationships.json'))
        ) || candidates[0];

      // In Cloud Functions / Serverless runtime, root filesystem is read-only, so use /tmp
      const isCloudEnv = Boolean(
        process.env.K_SERVICE ||
        process.env.FUNCTION_TARGET ||
        process.env.FIREBASE_CONFIG ||
        process.env.GCP_PROJECT
      );

      if (isCloudEnv) {
        const tmpDir = path.join('/tmp', 'family_tree_data');
        if (!fsSync.existsSync(tmpDir)) {
          fsSync.mkdirSync(tmpDir, { recursive: true });
        }
        const tmpPersons = path.join(tmpDir, 'persons.json');
        const tmpRels = path.join(tmpDir, 'relationships.json');

        if (!fsSync.existsSync(tmpPersons) && fsSync.existsSync(path.join(foundSeedDir, 'persons.json'))) {
          fsSync.copyFileSync(path.join(foundSeedDir, 'persons.json'), tmpPersons);
        }
        if (!fsSync.existsSync(tmpRels) && fsSync.existsSync(path.join(foundSeedDir, 'relationships.json'))) {
          fsSync.copyFileSync(path.join(foundSeedDir, 'relationships.json'), tmpRels);
        }
        this.dataDir = tmpDir;
      } else {
        this.dataDir = foundSeedDir;
      }
    }

    this.personsPath = path.join(this.dataDir, options.personsFileName || 'persons.json');
    this.relationshipsPath = path.join(this.dataDir, options.relationshipsFileName || 'relationships.json');
  }

  async getVersion(): Promise<number> {
    return this.version;
  }

  /**
   * Helper to write a file safely using atomic temporary file creation and rename.
   */
  private async safeWriteJson(targetPath: string, data: unknown): Promise<void> {
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`;
    const jsonContent = JSON.stringify(data, null, 2);

    try {
      await fs.writeFile(tempPath, jsonContent, 'utf-8');
      await fs.rename(tempPath, targetPath);
    } catch (err) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore temporary file cleanup failure
      }
      throw err;
    }
  }

  /**
   * Loads and validates raw JSON files from disk.
   */
  private async loadValidatedData(): Promise<{ persons: Person[]; relationships: Relationship[] }> {
    let personsRaw: string;
    let relsRaw: string;

    try {
      personsRaw = await fs.readFile(this.personsPath, 'utf-8');
    } catch (err: any) {
      throw new FamilyValidationError('STORAGE_READ_ERROR', `Failed to read persons file: ${err.message}`);
    }

    try {
      relsRaw = await fs.readFile(this.relationshipsPath, 'utf-8');
    } catch (err: any) {
      throw new FamilyValidationError('STORAGE_READ_ERROR', `Failed to read relationships file: ${err.message}`);
    }

    let personsObj: any;
    let relsObj: any;

    try {
      personsObj = JSON.parse(personsRaw);
    } catch (err: any) {
      throw new FamilyValidationError('DATA_CORRUPTION_ERROR', `Malformed JSON in persons file: ${err.message}`);
    }

    try {
      relsObj = JSON.parse(relsRaw);
    } catch (err: any) {
      throw new FamilyValidationError('DATA_CORRUPTION_ERROR', `Malformed JSON in relationships file: ${err.message}`);
    }

    if (!Array.isArray(personsObj?.persons)) {
      throw new FamilyValidationError('DATA_CORRUPTION_ERROR', 'Persons file missing "persons" array root');
    }

    if (!Array.isArray(relsObj?.relationships)) {
      throw new FamilyValidationError('DATA_CORRUPTION_ERROR', 'Relationships file missing "relationships" array root');
    }

    const persons: Person[] = personsObj.persons;
    const relationships: Relationship[] = relsObj.relationships;

    // Validate entire dataset against schema and graph invariants
    validateFamilyData(persons, relationships);

    return { persons, relationships };
  }

  async getAllPersons(includeArchived = false): Promise<Person[]> {
    const { persons } = await this.loadValidatedData();
    if (includeArchived) {
      return persons;
    }
    return persons.filter((p) => !p.is_archived);
  }

  async getPersonById(id: string): Promise<Person | null> {
    const { persons } = await this.loadValidatedData();
    return persons.find((p) => p.id === id) || null;
  }

  async getAllRelationships(): Promise<Relationship[]> {
    const { relationships } = await this.loadValidatedData();
    return relationships;
  }

  async getRelationshipsForPerson(personId: string): Promise<Relationship[]> {
    const { relationships } = await this.loadValidatedData();
    return relationships.filter((r) => r.person_id === personId || r.related_person_id === personId);
  }

  async saveFamilyData(
    persons: Person[],
    relationships: Relationship[],
    expectedVersion?: number
  ): Promise<{ version: number }> {
    return this.mutex.runExclusive(async () => {
      // 1. Optimistic concurrency check
      if (expectedVersion !== undefined && expectedVersion !== this.version) {
        throw new FamilyValidationError(
          'CONCURRENT_MODIFICATION_ERROR',
          `Concurrent modification detected: expected version ${expectedVersion}, but current version is ${this.version}.`
        );
      }

      // 2. Strict validation of incoming data before writing
      validateFamilyData(persons, relationships);

      // 3. Create backups before atomic writes
      try {
        await fs.copyFile(this.personsPath, `${this.personsPath}.bak`);
        await fs.copyFile(this.relationshipsPath, `${this.relationshipsPath}.bak`);
      } catch {
        // Backups created if original files exist
      }

      // 4. Atomic file replacement
      await this.safeWriteJson(this.personsPath, { persons });
      await this.safeWriteJson(this.relationshipsPath, { relationships });

      // 5. Increment version
      this.version += 1;

      return { version: this.version };
    });
  }
}
