import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationError } from './errors';

export interface StorageService {
  uploadFile(objectPath: string, buffer: Buffer, contentType: string): Promise<string>;
  getFile(objectPath: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  deleteFile(objectPath: string): Promise<boolean>;
  fileExists(objectPath: string): Promise<boolean>;
}

/**
 * Local disk implementation of StorageService for development and testing.
 */
export class LocalDiskStorageService implements StorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ||
      (process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR)
        : path.resolve(__dirname, '../../../../data/storage'));
  }

  private getSafePath(objectPath: string): string {
    const normalized = path.normalize(objectPath).replace(/^(\.\.[\/\\])+/, '');
    const resolved = path.resolve(this.baseDir, normalized);
    if (!resolved.startsWith(this.baseDir)) {
      throw new ValidationError('PATH_TRAVERSAL_DETECTED', 'Invalid storage object path.');
    }
    return resolved;
  }

  async uploadFile(objectPath: string, buffer: Buffer, _contentType: string): Promise<string> {
    const targetPath = this.getSafePath(objectPath);
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // Safe atomic write using temporary file
    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    try {
      await fs.writeFile(tempPath, buffer);
      await fs.rename(tempPath, targetPath);
    } catch (err) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore temp cleanup error
      }
      throw err;
    }

    return objectPath;
  }

  async getFile(objectPath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const targetPath = this.getSafePath(objectPath);
    try {
      const buffer = await fs.readFile(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.webp') contentType = 'image/webp';

      return { buffer, contentType };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async deleteFile(objectPath: string): Promise<boolean> {
    const targetPath = this.getSafePath(objectPath);
    try {
      await fs.unlink(targetPath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async fileExists(objectPath: string): Promise<boolean> {
    const targetPath = this.getSafePath(objectPath);
    try {
      await fs.stat(targetPath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }
}

/**
 * Firebase Cloud Storage implementation for production deployment.
 */
export class FirebaseCloudStorageService implements StorageService {
  private bucketName?: string;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || process.env.FIREBASE_STORAGE_BUCKET;
  }

  private getBucket() {
    // Lazy load admin to avoid initializing when running locally
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');
    return this.bucketName ? admin.storage().bucket(this.bucketName) : admin.storage().bucket();
  }

  async uploadFile(objectPath: string, buffer: Buffer, contentType: string): Promise<string> {
    const bucket = this.getBucket();
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      metadata: {
        contentType,
      },
      resumable: false,
    });
    return objectPath;
  }

  async getFile(objectPath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const bucket = this.getBucket();
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;

    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    return { buffer, contentType };
  }

  async deleteFile(objectPath: string): Promise<boolean> {
    const bucket = this.getBucket();
    const file = bucket.file(objectPath);
    try {
      await file.delete();
      return true;
    } catch (err: any) {
      if (err.code === 404) return false;
      throw err;
    }
  }

  async fileExists(objectPath: string): Promise<boolean> {
    const bucket = this.getBucket();
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    return exists;
  }
}

