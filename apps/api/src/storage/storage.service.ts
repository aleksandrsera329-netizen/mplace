import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join, resolve, sep } from 'path';
import { Readable } from 'stream';
import sharp from 'sharp';

/** Private objects must never be exposed via static /uploads */
export const PRIVATE_STORAGE_PREFIX = 'private/';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';
  private readonly provider: string;
  /** Local disk root for STORAGE_PROVIDER=local */
  private readonly localRoot: string;
  private readonly signSecret: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (
      this.config.get<string>('STORAGE_PROVIDER') || 'local'
    ).toLowerCase();
    this.localRoot =
      this.config.get<string>('STORAGE_LOCAL_PATH') ||
      join(process.cwd(), 'uploads');
    // Never hardcode a signing secret — reuse JWT or dedicated STORAGE_SIGN_SECRET
    this.signSecret =
      this.config.get<string>('STORAGE_SIGN_SECRET') ||
      this.config.getOrThrow<string>('JWT_SECRET');

    if (this.provider === 'r2' || this.provider === 's3') {
      const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>(
        'STORAGE_SECRET_ACCESS_KEY',
      );
      const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
      this.bucket = this.config.get<string>('STORAGE_BUCKET') || '';
      this.publicUrl = (
        this.config.get<string>('STORAGE_PUBLIC_URL') || ''
      ).replace(/\/$/, '');

      if (!accessKeyId || !secretAccessKey || !endpoint || !this.bucket) {
        this.logger.warn(
          'STORAGE_PROVIDER is r2/s3 but credentials incomplete — falling back to local disk',
        );
      } else {
        this.s3 = new S3Client({
          region: this.config.get<string>('STORAGE_REGION') || 'auto',
          endpoint,
          forcePathStyle: this.provider === 'r2' || this.provider === 's3',
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log(`Storage enabled: ${this.provider} bucket=${this.bucket}`);
      }
    } else {
      this.logger.log(
        `STORAGE_PROVIDER=local — files under ${this.localRoot} (public URL /uploads/..., private under private/)`,
      );
    }
  }

  isPrivateKey(key: string): boolean {
    const k = this.extractKeyFromUrl(key);
    return (
      k.startsWith(PRIVATE_STORAGE_PREFIX) ||
      k.startsWith('kyc/') ||
      k.includes('/kyc/')
    );
  }

  get enabled() {
    // Always available: S3/R2 when configured, otherwise local disk
    return true;
  }

  /** Normalize public URL or key → storage key (no leading slash) */
  extractKeyFromUrl(urlOrKey: string): string {
    if (!urlOrKey) return '';
    let key = urlOrKey;
    if (urlOrKey.startsWith('http')) {
      try {
        const u = new URL(urlOrKey);
        key = u.pathname.replace(/^\//, '');
        if (this.bucket && key.startsWith(`${this.bucket}/`)) {
          key = key.slice(this.bucket.length + 1);
        }
      } catch {
        return urlOrKey;
      }
    } else if (key.startsWith('/uploads/')) {
      key = key.slice('/uploads/'.length);
    } else if (key.startsWith('uploads/')) {
      key = key.slice('uploads/'.length);
    }
    return key.replace(/\\/g, '/');
  }

  toPublicUrl(key: string): string | null {
    const k = key.replace(/\\/g, '/').replace(/^\//, '');
    // Never expose private / KYC keys as public URLs
    if (this.isPrivateKey(k)) {
      return null;
    }
    if (this.s3 && this.publicUrl) {
      return `${this.publicUrl}/${k}`;
    }
    if (this.s3) {
      return `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${k}`;
    }
    return `/uploads/${k}`;
  }

  private async putLocal(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const full = join(this.localRoot, key);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, body);
    this.logger.log(`Local upload ${key} (${body.length} bytes, ${contentType})`);
    if (this.isPrivateKey(key)) {
      // Private: return storage key only (not /uploads/...)
      return key.replace(/\\/g, '/');
    }
    // Served by nginx from monorepo /uploads or API static
    return `/uploads/${key.replace(/\\/g, '/')}`;
  }

  /**
   * Store object under private prefix (KYC etc). Never returns a public URL.
   * @returns storageKey (e.g. private/kyc/{shopId}/{docId}/{uuid}.ext)
   */
  async uploadPrivate(
    file: Express.Multer.File,
    keyPrefix: string,
    options?: { asImage?: boolean },
  ): Promise<{ storageKey: string; mimeType: string; sizeBytes: number }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    const prefix = keyPrefix
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    const privatePrefix = prefix.startsWith(PRIVATE_STORAGE_PREFIX)
      ? prefix
      : `${PRIVATE_STORAGE_PREFIX}${prefix}`;

    let body: Buffer;
    let mimeType: string;
    let ext: string;

    if (options?.asImage || file.mimetype?.startsWith('image/')) {
      body = await sharp(file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      mimeType = 'image/webp';
      ext = '.webp';
    } else {
      body = file.buffer;
      mimeType = file.mimetype || 'application/octet-stream';
      // Never trust original filename for path — only a sanitized extension
      const rawExt = extname(file.originalname || '')
        .toLowerCase()
        .replace(/[^\w.]/g, '');
      const fromMime =
        mimeType === 'application/pdf'
          ? '.pdf'
          : mimeType === 'image/jpeg'
            ? '.jpg'
            : mimeType === 'image/png'
              ? '.png'
              : mimeType === 'image/webp'
                ? '.webp'
                : '';
      ext = fromMime || (rawExt && rawExt.length <= 8 ? rawExt : '');
    }

    // Storage key is always randomUUID + safe ext (never original basename)
    const key = `${privatePrefix}/${randomUUID()}${ext}`;

    if (!this.s3) {
      await this.putLocal(key, body, mimeType);
      return { storageKey: key, mimeType, sizeBytes: body.length };
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        CacheControl: 'private, no-store',
      }),
    );
    this.logger.log(`Private upload ${key} (${body.length} bytes)`);
    return { storageKey: key, mimeType, sizeBytes: body.length };
  }

  /**
   * Time-limited signed download URL.
   * - S3/R2: native presigned GET
   * - Local: HMAC token → GET /api/media/signed?key=&exp=&sig=
   */
  async getSignedUrl(storageKey: string, expiresIn = 180): Promise<string> {
    const key = this.extractKeyFromUrl(storageKey);
    if (!key) throw new BadRequestException('Invalid storage key');

    if (this.s3) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return getSignedUrl(this.s3, command, { expiresIn });
    }

    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const sig = this.signLocal(key, exp);
    const q = new URLSearchParams({
      key,
      exp: String(exp),
      sig,
    });
    return `/api/media/signed?${q.toString()}`;
  }

  private signLocal(key: string, exp: number): string {
    return createHmac('sha256', this.signSecret)
      .update(`${key}:${exp}`)
      .digest('hex');
  }

  /**
   * Verify local signed URL params; throws if invalid/expired.
   */
  verifyLocalSignedUrl(key: string, expRaw: string, sig: string): string {
    const storageKey = this.extractKeyFromUrl(key);
    if (!storageKey || !sig || !expRaw) {
      throw new ForbiddenException('Invalid signed URL');
    }
    const exp = Number(expRaw);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('Signed URL expired');
    }
    const expected = this.signLocal(storageKey, exp);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(sig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid signed URL signature');
    }
    return storageKey;
  }

  /**
   * Resolve absolute local path; reject path traversal.
   */
  resolveLocalPath(storageKey: string): string {
    const key = this.extractKeyFromUrl(storageKey);
    const full = resolve(join(this.localRoot, key));
    const root = resolve(this.localRoot) + sep;
    if (!full.startsWith(root) && full !== resolve(this.localRoot)) {
      throw new ForbiddenException('Invalid storage path');
    }
    return full;
  }

  /**
   * Read private/public object as Buffer (local or S3).
   */
  async readObject(storageKey: string): Promise<{
    body: Buffer;
    contentType?: string;
  }> {
    const key = this.extractKeyFromUrl(storageKey);
    if (!key) throw new NotFoundException('Object not found');

    if (!this.s3) {
      const full = this.resolveLocalPath(key);
      if (!existsSync(full)) throw new NotFoundException('Object not found');
      const body = await readFile(full);
      return { body };
    }

    try {
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = out.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return {
        body: Buffer.concat(chunks),
        contentType: out.ContentType,
      };
    } catch {
      throw new NotFoundException('Object not found');
    }
  }

  openLocalReadStream(storageKey: string): {
    stream: Readable;
    fullPath: string;
  } {
    const full = this.resolveLocalPath(storageKey);
    if (!existsSync(full)) throw new NotFoundException('Object not found');
    return { stream: createReadStream(full), fullPath: full };
  }

  /**
   * Upload image: resize (max 1200), convert to WebP, put to S3/R2 or local.
   * @returns public URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    // Defensive: KYC must use uploadPrivate
    if (folder.replace(/\\/g, '/').toLowerCase().includes('kyc')) {
      throw new BadRequestException(
        'KYC images must use private storage (uploadPrivate)',
      );
    }

    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}.webp`;

    const buffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    if (!this.s3) {
      return this.putLocal(key, buffer, 'image/webp');
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      }),
    );

    const url = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;

    this.logger.log(`Uploaded ${key} (${buffer.length} bytes)`);
    return url;
  }

  /**
   * Upload non-image document (PDF, DOC, etc.) as-is.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'documents',
  ): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    if (folder.replace(/\\/g, '/').toLowerCase().includes('kyc')) {
      throw new BadRequestException(
        'KYC files must use private storage (uploadPrivate)',
      );
    }
    const contentType = file.mimetype || 'application/octet-stream';
    const fromMime =
      contentType === 'application/pdf'
        ? '.pdf'
        : contentType.startsWith('image/')
          ? ''
          : '';
    const rawExt = extname(file.originalname || '')
      .toLowerCase()
      .replace(/[^\w.]/g, '');
    const ext =
      fromMime ||
      (rawExt &&
      ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.csv', '.txt'].includes(
        rawExt,
      )
        ? rawExt
        : '');
    // Always random key — original filename never appears in path
    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}${ext}`;

    if (!this.s3) {
      return this.putLocal(key, file.buffer, contentType);
    }

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;
  }

  /**
   * Optional: generate thumbnail WebP (max 400px)
   */
  async uploadThumbnail(
    file: Express.Multer.File,
    folder = 'products/thumbs',
  ): Promise<string> {
    if (!this.s3) {
      throw new ServiceUnavailableException('Storage is not configured');
    }

    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}.webp`;
    const buffer = await sharp(file.buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      }),
    );

    return this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;
  }

  /**
   * Delete object by public URL or raw key
   */
  async deleteImage(urlOrKey: string): Promise<void> {
    if (!urlOrKey) return;

    let key = urlOrKey;
    if (urlOrKey.startsWith('http')) {
      try {
        const u = new URL(urlOrKey);
        key = u.pathname.replace(/^\//, '');
        // path-style: /bucket/key
        if (this.bucket && key.startsWith(`${this.bucket}/`)) {
          key = key.slice(this.bucket.length + 1);
        }
      } catch {
        this.logger.warn(`deleteImage: invalid URL ${urlOrKey}`);
        return;
      }
    } else if (key.startsWith('/uploads/')) {
      key = key.slice('/uploads/'.length);
    }

    if (!this.s3) {
      try {
        await unlink(join(this.localRoot, key));
        this.logger.log(`Local deleted ${key}`);
      } catch (e) {
        this.logger.warn(`Local delete failed ${key}: ${String(e)}`);
      }
      return;
    }

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Deleted ${key}`);
    } catch (e) {
      this.logger.error(`deleteImage failed ${key}`, e as Error);
    }
  }

  /**
   * Presigned PUT URL for direct browser upload (optional advanced flow)
   */
  async getPresignedUploadUrl(
    folder = 'products',
    contentType = 'image/webp',
    expiresIn = 600,
  ): Promise<{ url: string; key: string; publicUrl: string }> {
    if (!this.s3) {
      // Local: client still posts to /api/media/upload
      const key = `${folder.replace(/\/$/, '')}/${randomUUID()}.webp`;
      return {
        url: `/api/media/upload`,
        key,
        publicUrl: `/uploads/${key}`,
      };
    }
    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}.webp`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, command, { expiresIn });
    const publicUrl = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;
    return { url, key, publicUrl };
  }
}
