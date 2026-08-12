import { BadRequestException } from '@nestjs/common';
import { memoryStorage, Options } from 'multer';
import { MAX_SIZES, UploadKind } from './file-security';

/**
 * Shared Multer options for Stage 24 uploads.
 * Magic-byte / MIME validation still runs in FileSecurityService after multer.
 */
export function multerMemoryOptions(kind: UploadKind, maxSize?: number): Options {
  const limit = maxSize ?? MAX_SIZES[kind];
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: limit,
      files: 1,
      fields: 20,
    },
    fileFilter: (_req, file, cb) => {
      const name = String(file.originalname || '').toLowerCase();
      // Path traversal in original name
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        // still allow — normalize later; block only null bytes
      }
      if (/\0/.test(file.originalname || '')) {
        return cb(new BadRequestException('Invalid filename') as never, false);
      }
      if (/\.(exe|dll|bat|cmd|php|phtml|html?|js|mjs|sh|jar|svg|asp|aspx|jsp)$/i.test(name)) {
        return cb(new BadRequestException('File type not allowed') as never, false);
      }
      cb(null, true);
    },
  };
}
