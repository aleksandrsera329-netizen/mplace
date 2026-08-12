import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaVisibility, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { FileSecurityService } from '../common/upload/file-security.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateMediaDto } from './dto/create-media.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly fileSecurity: FileSecurityService,
  ) {}

  /**
   * Upload file, store via StorageService, register MediaAsset with ownership.
   * KYC / PRIVATE → private storage prefix, no public URL.
   */
  async create(
    file: Express.Multer.File,
    dto: CreateMediaDto,
    user: JwtPayload,
  ) {
    if (!dto.entityType?.trim() || !dto.entityId?.trim()) {
      throw new BadRequestException('entityType and entityId are required');
    }

    let visibility = dto.visibility ?? MediaVisibility.PRIVATE;
    if (dto.entityType.toLowerCase() === 'kyc') {
      visibility = MediaVisibility.KYC;
    } else if (
      dto.entityType.toLowerCase() === 'product' &&
      !dto.visibility
    ) {
      visibility = MediaVisibility.PUBLIC;
    }

    // Stage 24: size / ext / MIME / magic-byte / optional ClamAV
    const kind =
      visibility === MediaVisibility.KYC
        ? 'kyc'
        : file?.mimetype?.startsWith('image/')
          ? 'image'
          : 'media';
    const safe = await this.fileSecurity.assertSafe(file, kind as 'kyc' | 'image' | 'media');
    this.fileSecurity.applySafeMeta(file!, safe);

    const shopId =
      dto.shopId ||
      (user.role === UserRole.MERCHANT ? user.shopId : null) ||
      null;

    // Merchants may only attach media to their shop context
    if (
      user.role === UserRole.MERCHANT &&
      shopId &&
      user.shopId &&
      shopId !== user.shopId
    ) {
      throw new ForbiddenException('Cannot upload media for another shop');
    }

    const isImage = safe.mimeType.startsWith('image/');
    let storageKey: string;
    let mimeType: string;
    let sizeBytes: number;

    if (
      visibility === MediaVisibility.KYC ||
      visibility === MediaVisibility.PRIVATE
    ) {
      const folder = this.privateFolderForEntity(
        dto.entityType,
        shopId,
        dto.entityId,
      );
      const uploaded = await this.storage.uploadPrivate(file!, folder, {
        asImage: isImage,
      });
      storageKey = uploaded.storageKey;
      mimeType = uploaded.mimeType;
      sizeBytes = uploaded.sizeBytes;
    } else {
      const folder = this.folderForEntity(dto.entityType);
      const publicUrl = isImage
        ? await this.storage.uploadImage(file!, folder)
        : await this.storage.uploadFile(file!, folder);
      storageKey = this.storage.extractKeyFromUrl(publicUrl);
      mimeType = isImage ? 'image/webp' : safe.mimeType;
      sizeBytes = safe.sizeBytes;
    }

    if (!storageKey) {
      throw new BadRequestException('Failed to resolve storage key');
    }

    // Never store raw client path — only normalized display name
    const media = await this.prisma.mediaAsset.create({
      data: {
        ownerId: user.sub,
        shopId,
        entityType: dto.entityType.trim(),
        entityId: dto.entityId.trim(),
        storageKey,
        originalName: safe.safeOriginalName,
        mimeType,
        sizeBytes,
        visibility,
      },
    });

    return this.toResponse(media);
  }

  /**
   * Legacy upload by folder only — still creates MediaAsset for ownership.
   * folder=kyc forces private KYC storage.
   */
  async createLegacy(
    file: Express.Multer.File,
    folder: string,
    user: JwtPayload,
  ) {
    return this.create(
      file,
      {
        entityType: folder || 'other',
        entityId: user.sub,
        shopId: user.shopId ?? undefined,
        visibility:
          folder === 'kyc'
            ? MediaVisibility.KYC
            : folder === 'products'
              ? MediaVisibility.PUBLIC
              : MediaVisibility.PRIVATE,
      },
      user,
    );
  }

  async findOne(id: string, user?: JwtPayload) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');

    if (
      media.visibility === MediaVisibility.PRIVATE ||
      media.visibility === MediaVisibility.KYC
    ) {
      if (!user) throw new ForbiddenException('Authentication required');
      this.assertCanRead(media, user);
    }

    // KYC never returns a long-lived public URL — short signed URL only
    if (media.visibility === MediaVisibility.KYC) {
      const expiresIn = 180;
      const signedUrl = await this.storage.getSignedUrl(
        media.storageKey,
        expiresIn,
      );
      return {
        ...media,
        url: signedUrl,
        expiresIn,
      };
    }

    return this.toResponse(media);
  }

  async delete(id: string, user: JwtPayload) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Media not found');

    this.assertCanDelete(media, user);

    try {
      await this.storage.deleteImage(media.storageKey);
    } catch (e) {
      this.logger.warn(
        `Physical delete failed for ${media.storageKey}: ${String(e)}`,
      );
    }

    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true, id };
  }

  private toResponse(media: {
    storageKey: string;
    visibility: MediaVisibility;
    [key: string]: unknown;
  }) {
    const publicUrl = this.storage.toPublicUrl(media.storageKey);
    return {
      ...media,
      // Private/KYC: null public url (use signed download)
      url:
        media.visibility === MediaVisibility.PUBLIC
          ? publicUrl
          : publicUrl && !this.storage.isPrivateKey(media.storageKey)
            ? publicUrl
            : null,
    };
  }

  private assertCanDelete(
    media: {
      ownerId: string | null;
      shopId: string | null;
    },
    user: JwtPayload,
  ) {
    const isOwner = media.ownerId === user.sub;
    const isShopOwner =
      !!media.shopId && !!user.shopId && media.shopId === user.shopId;
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    if (!isOwner && !isShopOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this media',
      );
    }
  }

  private assertCanRead(
    media: {
      ownerId: string | null;
      shopId: string | null;
      visibility: MediaVisibility;
    },
    user: JwtPayload,
  ) {
    if (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPER_ADMIN
    ) {
      return;
    }
    if (media.ownerId === user.sub) return;
    if (media.shopId && user.shopId && media.shopId === user.shopId) return;
    throw new ForbiddenException(
      'You do not have permission to view this media',
    );
  }

  private folderForEntity(entityType: string): string {
    const t = entityType.toLowerCase();
    if (t === 'product' || t === 'products') return 'products';
    if (t === 'kyc') return 'kyc';
    if (t === 'user' || t === 'avatar' || t === 'avatars') return 'avatars';
    if (t === 'document' || t === 'documents') return 'documents';
    if (t === 'shop') return 'other';
    return 'other';
  }

  /**
   * Private key path: kyc/{shopId}/{entityId} → private/kyc/...
   */
  private privateFolderForEntity(
    entityType: string,
    shopId: string | null,
    entityId: string,
  ): string {
    const t = entityType.toLowerCase();
    if (t === 'kyc') {
      const shop = shopId || 'unknown';
      return `kyc/${shop}/${entityId}`;
    }
    if (t === 'document' || t === 'documents') {
      return `documents/${entityId}`;
    }
    return `other/${entityId}`;
  }
}
