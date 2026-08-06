import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';
  private readonly provider: string;
  /** Local disk root for STORAGE_PROVIDER=local */
  private readonly localRoot: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (
      this.config.get<string>('STORAGE_PROVIDER') || 'local'
    ).toLowerCase();
    this.localRoot =
      this.config.get<string>('STORAGE_LOCAL_PATH') ||
      join(process.cwd(), 'uploads');

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
        `STORAGE_PROVIDER=local — files under ${this.localRoot} (URL /uploads/...)`,
      );
    }
  }

  get enabled() {
    // Always available: S3/R2 when configured, otherwise local disk
    return true;
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
    // Served by nginx from monorepo /uploads or API static
    return `/uploads/${key.replace(/\\/g, '/')}`;
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
    const ext =
      extname(file.originalname || '').toLowerCase().replace(/[^\w.]/g, '') ||
      '';
    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}${ext}`;
    const contentType = file.mimetype || 'application/octet-stream';

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
