import { ValidationError } from '../services/errors';

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type SupportedImageExt = 'jpg' | 'png' | 'webp';

export interface ValidatedImageInfo {
  mimeType: SupportedImageMime;
  extension: SupportedImageExt;
}

/**
 * Validates file buffer by inspecting magic bytes signature.
 * Rejects SVG, executables, HTML, and unsupported formats.
 */
export function validateImageBuffer(buffer: Buffer): ValidatedImageInfo {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('EMPTY_FILE', 'The uploaded file is empty.');
  }

  if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
    throw new ValidationError(
      'OVERSIZED_IMAGE',
      `File size exceeds the 5 MB limit. Received: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB.`
    );
  }

  // 1. Check for Executables / Scripts
  // DOS / Windows PE (MZ)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    throw new ValidationError('INVALID_FILE_TYPE', 'Executable files are strictly forbidden.');
  }
  // Linux ELF
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    throw new ValidationError('INVALID_FILE_TYPE', 'Executable files are strictly forbidden.');
  }
  // Shell script '#!'
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    throw new ValidationError('INVALID_FILE_TYPE', 'Script files are strictly forbidden.');
  }

  // 2. Check for XML / SVG
  const headStr = buffer.slice(0, 100).toString('utf-8').trim().toLowerCase();
  if (headStr.includes('<svg') || headStr.includes('<?xml') || headStr.includes('<html')) {
    throw new ValidationError(
      'INVALID_FILE_TYPE',
      'SVG and XML files are not allowed for profile photographs. Please upload JPEG, PNG, or WebP.'
    );
  }

  // 3. Inspect Magic Bytes
  // JPEG: 0xFF 0xD8 0xFF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // WebP: RIFF (bytes 0-3: 0x52 0x49 0x46 0x46) and WEBP (bytes 8-11: 0x57 0x45 0x42 0x50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  throw new ValidationError(
    'INVALID_IMAGE_TYPE',
    'Invalid image content. Only JPEG, PNG, and WebP images are supported.'
  );
}

