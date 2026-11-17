import { randomUUID } from 'crypto';
import { Person } from '../types/person';
import { FamilyRepository } from '../repositories/family.repository';
import { LocalJsonFamilyRepository } from '../repositories/local-json.repository';
import { StorageService, LocalDiskStorageService } from './storage.service';
import { validateImageBuffer } from '../validators/photo.validator';
import { ValidationError, NotFoundError, ConflictError } from './errors';
import { FamilyValidationError } from '../validators/family.validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PhotoService {
  private repository: FamilyRepository;
  private storageService: StorageService;

  constructor(repository?: FamilyRepository, storageService?: StorageService) {
    this.repository = repository || new LocalJsonFamilyRepository();
    this.storageService = storageService || new LocalDiskStorageService();
  }

  /**
   * Safely uploads or replaces a person's profile photograph.
   *
   * Replacement safety guarantee:
   * 1. Validates image magic bytes & limits.
   * 2. Uploads the new image to storage first.
   * 3. Updates the person's profile_photo reference in the repository.
   * 4. If repository update fails, cleans up the new storage object immediately.
   * 5. Deletes the previous photo only after the new reference is successfully committed.
   */
  async uploadPersonPhoto(
    personId: string,
    fileBuffer: Buffer
  ): Promise<{ profile_photo: string; person: Person }> {
    if (!UUID_REGEX.test(personId)) {
      throw new ValidationError('INVALID_UUID', `Person ID "${personId}" is not a valid UUID.`);
    }

    // 1. Validate magic bytes and format
    const { mimeType, extension } = validateImageBuffer(fileBuffer);

    // 2. Load person from repository
    const allPersons = await this.repository.getAllPersons(true);
    const allRelationships = await this.repository.getAllRelationships();
    const version = await this.repository.getVersion();

    const personIndex = allPersons.findIndex((p) => p.id === personId);
    if (personIndex === -1) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${personId}" was not found.`);
    }

    const existing = allPersons[personIndex];
    if (existing.is_archived) {
      throw new ConflictError(
        'CANNOT_MODIFY_ARCHIVED_PERSON',
        'Cannot upload photograph for an archived person. Restore them first.'
      );
    }

    const previousPhotoPath = existing.profile_photo;

    // 3. Generate unique object name to prevent collisions and path traversal
    const timestamp = Date.now();
    const token = randomUUID().substring(0, 8);
    const objectName = `profile-${timestamp}-${token}.${extension}`;
    const objectPath = `persons/${personId}/${objectName}`;

    // 4. Upload new image to storage
    await this.storageService.uploadFile(objectPath, fileBuffer, mimeType);

    // 5. Update person record in repository
    const now = new Date().toISOString();
    const updatedPerson: Person = {
      ...existing,
      profile_photo: objectPath,
      updated_at: now,
    };

    const newPersons = [...allPersons];
    newPersons[personIndex] = updatedPerson;

    try {
      await this.repository.saveFamilyData(newPersons, allRelationships, version);
    } catch (err: any) {
      // Rollback: Clean up newly uploaded image so no orphan files remain
      try {
        await this.storageService.deleteFile(objectPath);
      } catch {
        // Ignore storage cleanup failure
      }

      if (err instanceof FamilyValidationError) {
        throw new ConflictError(err.code, err.message, err.details);
      }
      throw err;
    }

    // 6. Delete previous image only after successful commit
    if (previousPhotoPath && previousPhotoPath !== objectPath) {
      try {
        await this.storageService.deleteFile(previousPhotoPath);
      } catch {
        // Log or handle non-fatal retention policy
      }
    }

    return { profile_photo: objectPath, person: updatedPerson };
  }

  /**
   * Retrieves a person's photograph binary buffer and content type.
   */
  async getPersonPhoto(
    personId: string,
    options?: { includeArchived?: boolean }
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!UUID_REGEX.test(personId)) {
      throw new ValidationError('INVALID_UUID', `Person ID "${personId}" is not a valid UUID.`);
    }

    const allPersons = await this.repository.getAllPersons(true);
    const person = allPersons.find((p) => p.id === personId);
    if (!person) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${personId}" was not found.`);
    }

    if (person.is_archived && !options?.includeArchived) {
      throw new NotFoundError(
        'PERSON_ARCHIVED',
        `Person with ID "${personId}" is archived. Pass includeArchived=true to retrieve photo.`
      );
    }

    if (!person.profile_photo) {
      throw new NotFoundError('PHOTO_NOT_FOUND', `Person with ID "${personId}" does not have a profile photograph.`);
    }

    const fileData = await this.storageService.getFile(person.profile_photo);
    if (!fileData) {
      throw new NotFoundError('PHOTO_FILE_MISSING', 'Photograph file not found in storage.');
    }

    return fileData;
  }

  /**
   * Removes a person's photograph from storage and sets profile_photo to null in repository.
   */
  async deletePersonPhoto(personId: string): Promise<{ deleted: true; person_id: string }> {
    if (!UUID_REGEX.test(personId)) {
      throw new ValidationError('INVALID_UUID', `Person ID "${personId}" is not a valid UUID.`);
    }

    const allPersons = await this.repository.getAllPersons(true);
    const allRelationships = await this.repository.getAllRelationships();
    const version = await this.repository.getVersion();

    const personIndex = allPersons.findIndex((p) => p.id === personId);
    if (personIndex === -1) {
      throw new NotFoundError('PERSON_NOT_FOUND', `Person with ID "${personId}" was not found.`);
    }

    const existing = allPersons[personIndex];
    if (existing.is_archived) {
      throw new ConflictError(
        'CANNOT_MODIFY_ARCHIVED_PERSON',
        'Cannot delete photograph for an archived person.'
      );
    }

    if (!existing.profile_photo) {
      throw new NotFoundError(
        'PHOTO_NOT_FOUND',
        `Person with ID "${personId}" does not have a profile photograph to delete.`
      );
    }

    const photoPathToDelete = existing.profile_photo;

    // Update repository first
    const now = new Date().toISOString();
    const updatedPerson: Person = {
      ...existing,
      profile_photo: null,
      updated_at: now,
    };

    const newPersons = [...allPersons];
    newPersons[personIndex] = updatedPerson;

    try {
      await this.repository.saveFamilyData(newPersons, allRelationships, version);
    } catch (err: any) {
      if (err instanceof FamilyValidationError) {
        throw new ConflictError(err.code, err.message, err.details);
      }
      throw err;
    }

    // Delete file from storage after repository commit
    try {
      await this.storageService.deleteFile(photoPathToDelete);
    } catch {
      // Non-fatal if already deleted
    }

    return { deleted: true, person_id: personId };
  }
}

