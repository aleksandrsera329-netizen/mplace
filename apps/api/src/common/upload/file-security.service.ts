import { Injectable, Logger } from '@nestjs/common';
import {
  SafeFileResult,
  UploadKind,
  validateUploadedFile,
} from './file-security';
import { VirusScanService } from './virus-scan.service';

/**
 * Stage 24 — Nest-facing facade for upload validation + optional AV scan.
 */
@Injectable()
export class FileSecurityService {
  private readonly logger = new Logger(FileSecurityService.name);

  constructor(private readonly virus: VirusScanService) {}

  async assertSafe(
    file: Express.Multer.File | undefined | null,
    kind: UploadKind,
    options?: { maxSize?: number; skipVirus?: boolean },
  ): Promise<SafeFileResult> {
    const result = await validateUploadedFile(file, kind, {
      maxSize: options?.maxSize,
    });

    if (!options?.skipVirus) {
      await this.virus.scanBuffer(
        result.buffer,
        result.safeOriginalName,
      );
    }

    this.logger.debug(
      `upload ok kind=${kind} mime=${result.mimeType} size=${result.sizeBytes} name=${result.safeOriginalName} key=${result.storageKeyName}`,
    );
    return result;
  }

  /** Mutate multer file so downstream storage uses safe original name only for metadata */
  applySafeMeta(file: Express.Multer.File, safe: SafeFileResult): Express.Multer.File {
    file.originalname = safe.safeOriginalName;
    file.mimetype = safe.mimeType;
    return file;
  }
}
