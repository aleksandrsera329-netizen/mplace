import { BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'path';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';

/** Stage 24 — allowed MIME sets */
export const ALLOWED_MIME = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
  documents: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const,
  /** KYC: scans + photos */
  kyc: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const,
  csv: [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream', // some browsers send this for .csv
  ] as const,
  media: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
  ] as const,
} as const;

export type UploadKind = 'image' | 'document' | 'kyc' | 'csv' | 'media';

export const MAX_SIZES: Record<UploadKind, number> = {
  image: 5 * 1024 * 1024,
  document: 10 * 1024 * 1024,
  kyc: 10 * 1024 * 1024,
  csv: 20 * 1024 * 1024,
  media: 10 * 1024 * 1024,
};

/** Extension → canonical mime(s) */
const EXT_MIME: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.pdf': ['application/pdf'],
  '.csv': ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
  '.txt': ['text/plain', 'text/csv'],
};

const DANGEROUS_EXT = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.sh',
  '.php',
  '.phtml',
  '.asp',
  '.aspx',
  '.jsp',
  '.cgi',
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.jsx',
  '.tsx',
  '.svg', // XSS risk when served inline
  '.xml',
  '.xhtml',
  '.jar',
  '.war',
  '.py',
  '.rb',
  '.pl',
  '.vbs',
  '.wsf',
  '.hta',
]);

export type SafeFileResult = {
  /** Sanitized display name (never used as storage path) */
  safeOriginalName: string;
  /** Random storage filename: uuid + safe ext */
  storageFileName: string;
  /** Storage key relative path segment: uuid.ext */
  storageKeyName: string;
  ext: string;
  /** Declared client mimetype (may be untrusted) */
  declaredMime: string;
  /** Detected mime from magic bytes (or text/* for CSV) */
  detectedMime: string;
  /** Mime to store / respond with */
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
  kind: UploadKind;
};

function allowedMimesFor(kind: UploadKind): readonly string[] {
  switch (kind) {
    case 'image':
      return ALLOWED_MIME.images;
    case 'document':
      return ALLOWED_MIME.documents;
    case 'kyc':
      return ALLOWED_MIME.kyc;
    case 'csv':
      return ALLOWED_MIME.csv;
    case 'media':
    default:
      return ALLOWED_MIME.media;
  }
}

/**
 * Normalize user-supplied filename:
 * - strip path traversal / separators
 * - keep safe chars only
 * - limit length
 */
export function normalizeFilename(original?: string | null): string {
  let name = String(original || 'file')
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'file';
  // strip nulls and control chars
  name = name.replace(/[\x00-\x1f\x7f]/g, '');
  // collapse .. sequences
  name = name.replace(/\.{2,}/g, '.');
  // allow only safe charset
  name = name.replace(/[^a-zA-Z0-9._\- ()[\]]+/g, '_');
  name = name.replace(/^\.+/, '').trim() || 'file';
  if (name.length > 180) {
    const ext = extname(name).slice(0, 20);
    name = name.slice(0, 160 - ext.length) + ext;
  }
  return name;
}

export function safeExtension(original?: string | null): string {
  const name = normalizeFilename(original);
  const ext = extname(name).toLowerCase();
  if (!ext || ext.length > 10) return '';
  if (DANGEROUS_EXT.has(ext)) {
    throw new BadRequestException(`File extension not allowed: ${ext}`);
  }
  return ext;
}

/** Random storage key segment — never use original filename */
export function randomStorageFileName(ext: string): string {
  const e = ext && ext.startsWith('.') ? ext.toLowerCase() : ext ? `.${ext}` : '';
  // only allow known safe extensions in key
  const safe =
    e && Object.prototype.hasOwnProperty.call(EXT_MIME, e) ? e : '';
  return `${randomUUID()}${safe}`;
}

/**
 * Manual magic-byte fallback (when file-type returns undefined, e.g. text/csv).
 */
export function detectMagicMime(buf: Buffer): string | null {
  if (!buf?.length) return null;
  // JPEG
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return 'image/gif';
  }
  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  // PDF
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ) {
    return 'application/pdf';
  }
  // PE executable (MZ)
  if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) {
    return 'application/x-msdownload';
  }
  // ELF
  if (
    buf.length >= 4 &&
    buf[0] === 0x7f &&
    buf[1] === 0x45 &&
    buf[2] === 0x4c &&
    buf[3] === 0x46
  ) {
    return 'application/x-executable';
  }
  return null;
}

function looksLikeTextCsv(buf: Buffer): boolean {
  // Reject if many null bytes or high binary ratio
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let nulls = 0;
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 0) nulls++;
    if (
      c === 0x09 ||
      c === 0x0a ||
      c === 0x0d ||
      (c >= 0x20 && c <= 0x7e) ||
      c >= 0x80
    ) {
      printable++;
    }
  }
  if (nulls > 0) return false;
  return printable / sample.length > 0.9;
}

/**
 * Full validation pipeline for an uploaded multer file.
 */
export async function validateUploadedFile(
  file: Express.Multer.File | undefined | null,
  kind: UploadKind,
  options?: { maxSize?: number },
): Promise<SafeFileResult> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required');
  }

  const maxSize = options?.maxSize ?? MAX_SIZES[kind];
  const sizeBytes = file.size || file.buffer.length;
  if (sizeBytes > maxSize) {
    throw new BadRequestException(
      `File too large (max ${Math.floor(maxSize / (1024 * 1024))} MB)`,
    );
  }
  if (sizeBytes === 0) {
    throw new BadRequestException('Empty file');
  }

  const safeOriginalName = normalizeFilename(file.originalname);
  let ext = safeExtension(file.originalname);

  // Block dangerous extensions explicitly
  const rawExt = extname(String(file.originalname || '')).toLowerCase();
  if (rawExt && DANGEROUS_EXT.has(rawExt)) {
    throw new BadRequestException(`File type not allowed: ${rawExt}`);
  }

  const declaredMime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  const allowed = allowedMimesFor(kind);

  // Extension whitelist for kind
  if (kind === 'image') {
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      // allow empty ext if magic proves image
      if (ext) {
        throw new BadRequestException(
          `Image extension not allowed: ${ext || '(none)'}`,
        );
      }
    }
  } else if (kind === 'csv') {
    if (ext && !['.csv', '.txt'].includes(ext)) {
      throw new BadRequestException(`CSV extension not allowed: ${ext}`);
    }
    if (!ext) ext = '.csv';
  } else if (kind === 'document' || kind === 'kyc') {
    if (ext && !['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new BadRequestException(`Document extension not allowed: ${ext}`);
    }
  } else if (kind === 'media') {
    if (
      ext &&
      !['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
    ) {
      throw new BadRequestException(`Media extension not allowed: ${ext}`);
    }
  }

  // Magic-byte detection
  let detectedMime: string | null = null;
  try {
    const ft = await fileTypeFromBuffer(file.buffer);
    if (ft?.mime) detectedMime = ft.mime.toLowerCase();
  } catch {
    // ignore library errors — use manual fallback
  }
  if (!detectedMime) {
    detectedMime = detectMagicMime(file.buffer);
  }

  // CSV/text special case
  if (kind === 'csv') {
    if (detectedMime && !detectedMime.startsWith('text/') && detectedMime !== 'application/csv') {
      // binary magic found → reject
      if (
        detectedMime.startsWith('image/') ||
        detectedMime === 'application/pdf' ||
        detectedMime.includes('executable') ||
        detectedMime.includes('msdownload')
      ) {
        throw new BadRequestException(
          `File content does not match CSV (detected ${detectedMime})`,
        );
      }
    }
    if (!looksLikeTextCsv(file.buffer)) {
      throw new BadRequestException(
        'File content is not valid text/CSV (binary content detected)',
      );
    }
    detectedMime = detectedMime || 'text/csv';
  } else {
    if (!detectedMime) {
      throw new BadRequestException(
        'Unable to detect file type from content (magic bytes)',
      );
    }
    // Reject executables always
    if (
      detectedMime.includes('executable') ||
      detectedMime.includes('msdownload') ||
      detectedMime === 'application/x-dosexec'
    ) {
      throw new BadRequestException('Executable files are not allowed');
    }
    {
      const allowedList = allowed as readonly string[];
      const normalized =
        detectedMime === 'image/jpg' ? 'image/jpeg' : detectedMime;
      if (!allowedList.includes(normalized)) {
        throw new BadRequestException(
          `File content type not allowed: ${detectedMime}`,
        );
      }
      detectedMime = normalized;
    }
  }

  // Cross-check extension vs magic (when both present)
  if (ext && kind !== 'csv' && EXT_MIME[ext]) {
    const ok = EXT_MIME[ext].some(
      (m) => m === detectedMime || (m === 'image/jpeg' && detectedMime === 'image/jpg'),
    );
    if (!ok && !EXT_MIME[ext].includes('application/octet-stream')) {
      // soft: if magic is trusted and in allowed, rewrite ext from magic
      const magicExt = mimeToExt(detectedMime);
      if (magicExt) {
        ext = magicExt;
      } else {
        throw new BadRequestException(
          `File extension ${ext} does not match content type ${detectedMime}`,
        );
      }
    }
  }

  // If no ext, derive from magic
  if (!ext) {
    ext = mimeToExt(detectedMime) || '';
  }

  // Declared MIME soft-check (warn via exception only if wildly wrong and not empty)
  if (
    declaredMime &&
    declaredMime !== 'application/octet-stream' &&
    kind !== 'csv' &&
    detectedMime &&
    declaredMime !== detectedMime &&
    !(declaredMime === 'image/jpg' && detectedMime === 'image/jpeg')
  ) {
    // Prefer content over declaration — if content allowed, continue
    // but reject if declared is dangerous
    if (
      declaredMime.includes('javascript') ||
      declaredMime.includes('html') ||
      declaredMime.includes('executable')
    ) {
      throw new BadRequestException(`Declared MIME not allowed: ${declaredMime}`);
    }
  }

  const storageKeyName = randomStorageFileName(ext);
  const mimeType =
    kind === 'csv' ? 'text/csv' : detectedMime || declaredMime || 'application/octet-stream';

  return {
    safeOriginalName,
    storageFileName: storageKeyName,
    storageKeyName,
    ext,
    declaredMime,
    detectedMime: mimeType,
    mimeType,
    sizeBytes,
    buffer: file.buffer,
    kind,
  };
}

function mimeToExt(mime: string | null): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'application/pdf':
      return '.pdf';
    case 'text/csv':
    case 'text/plain':
      return '.csv';
    default:
      return '';
  }
}

/** Content hash helper (optional integrity logging) */
export function fileSha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
