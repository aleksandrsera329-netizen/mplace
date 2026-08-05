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
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = (
      this.config.get<string>('STORAGE_PROVIDER') || 'local'
    ).toLowerCase();

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
          'STORAGE_PROVIDER is r2/s3 but credentials incomplete — storage disabled',
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
      this.logger.warn(
        'STORAGE_PROVIDER=local — remote upload disabled (configure r2|s3 for media)',
      );
    }
  }

  get enabled() {
    return !!this.s3;
  }

  /**
   * Upload image: resize (max 1200), convert to WebP, put to S3/R2.
   * @returns public URL
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'products',
  ): Promise<string> {
    if (!this.s3) {
      throw new ServiceUnavailableException('Storage is not configured');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }

    const key = `${folder.replace(/\/$/, '')}/${randomUUID()}.webp`;

    const buffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
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

    const url = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : `${this.config.get('STORAGE_ENDPOINT')}/${this.bucket}/${key}`;

    this.logger.log(`Uploaded ${key} (${buffer.length} bytes)`);
    return url;
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
    if (!this.s3 || !urlOrKey) return;

    let key = urlOrKey;
    if (urlOrKey.startsWith('http')) {
      try {
        const u = new URL(urlOrKey);
        key = u.pathname.replace(/^\//, '');
        // path-style: /bucket/key
        if (key.startsWith(`${this.bucket}/`)) {
          key = key.slice(this.bucket.length + 1);
        }
      } catch {
        this.logger.warn(`deleteImage: invalid URL ${urlOrKey}`);
        return;
      }
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
      throw new ServiceUnavailableException('Storage is not configured');
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
