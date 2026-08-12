import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocStatus, KycDocType, MediaVisibility, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { patchRequestContext } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger.service';
import { FileSecurityService } from '../common/upload/file-security.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class KycService {
  private readonly slog: StructuredLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
    private readonly inAppNotifications: NotificationsService,
    private readonly fileSecurity: FileSecurityService,
    structuredLogger: StructuredLogger,
  ) {
    this.slog = structuredLogger.child('KycService');
  }

  /**
   * Upload KYC file → private MediaAsset (visibility=KYC) + KycDocument link.
   * Files never get a public /uploads URL.
   */
  async uploadKycDocument(
    shopId: string,
    user: JwtPayload,
    file: Express.Multer.File,
    docTypeRaw = 'OTHER',
  ) {
    const started = Date.now();
    patchRequestContext({ shopId, userId: user.sub });
    // Stage 24: PDF/images only + magic-byte + optional ClamAV
    const safe = await this.fileSecurity.assertSafe(file, 'kyc');
    this.fileSecurity.applySafeMeta(file, safe);

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    // Merchant may only upload for own shop
    if (user.role === UserRole.MERCHANT) {
      if (!user.shopId || user.shopId !== shopId) {
        throw new ForbiddenException('Not your shop');
      }
    } else if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException();
    }

    let docType: KycDocType = KycDocType.OTHER;
    const upper = String(docTypeRaw || 'OTHER').toUpperCase();
    if (upper in KycDocType) {
      docType = upper as KycDocType;
    }

    // Temp entity id until KycDocument is created
    const tempEntityId = `pending-${randomUUID()}`;
    const isImage = safe.mimeType.startsWith('image/');
    const uploaded = await this.storage.uploadPrivate(
      file,
      `kyc/${shopId}/${tempEntityId}`,
      { asImage: isImage },
    );

    const media = await this.prisma.mediaAsset.create({
      data: {
        ownerId: user.sub,
        shopId,
        entityType: 'kyc',
        entityId: tempEntityId,
        storageKey: uploaded.storageKey,
        originalName: safe.safeOriginalName,
        mimeType: uploaded.mimeType,
        sizeBytes: uploaded.sizeBytes,
        visibility: MediaVisibility.KYC,
      },
    });

    const doc = await this.prisma.kycDocument.create({
      data: {
        shopId,
        uploadedById: user.sub,
        docType,
        fileName: safe.safeOriginalName,
        filePath: null, // private — no public path
        mediaAssetId: media.id,
        status: KycDocStatus.PENDING,
      },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } },
        mediaAsset: {
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
            visibility: true,
            sizeBytes: true,
          },
        },
      },
    });

    await this.prisma.mediaAsset.update({
      where: { id: media.id },
      data: { entityId: doc.id },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'KYC_UPLOAD',
        entityType: 'KycDocument',
        entityId: doc.id,
        meta: JSON.stringify({
          shopId,
          docType,
          mediaAssetId: media.id,
          storageKey: uploaded.storageKey,
        }),
      },
    });

    this.slog.info('KYC document uploaded', {
      shopId,
      userId: user.sub,
      status: 'uploaded',
      durationMs: Date.now() - started,
    });

    // Never leak storageKey as public path
    return {
      ...doc,
      mediaAsset: doc.mediaAsset
        ? {
            id: doc.mediaAsset.id,
            mimeType: doc.mediaAsset.mimeType,
            visibility: doc.mediaAsset.visibility,
            sizeBytes: doc.mediaAsset.sizeBytes,
          }
        : null,
      downloadPath: `/api/kyc/documents/${doc.id}/download`,
    };
  }

  /**
   * ACL-checked signed download URL (60–300s). Audit: KYC_DOWNLOAD.
   */
  async getDownloadUrl(documentId: string, user: JwtPayload) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: {
        mediaAsset: true,
        shop: { select: { id: true, name: true } },
      },
    });
    if (!doc) throw new NotFoundException('KYC document not found');

    this.assertCanAccessKyc(doc.shopId, doc.uploadedById, user);

    const storageKey =
      doc.mediaAsset?.storageKey ||
      (doc.filePath ? this.storage.extractKeyFromUrl(doc.filePath) : null);

    if (!storageKey) {
      throw new NotFoundException('KYC file not available');
    }

    const expiresIn = 180; // 3 minutes
    const signedUrl = await this.storage.getSignedUrl(storageKey, expiresIn);

    await this.prisma.auditLog
      .create({
        data: {
          actorId: user.sub,
          action: 'KYC_DOWNLOAD',
          entityType: 'KycDocument',
          entityId: doc.id,
          meta: JSON.stringify({
            shopId: doc.shopId,
            mediaAssetId: doc.mediaAssetId,
            expiresIn,
          }),
        },
      })
      .catch(() => null);

    return {
      url: signedUrl,
      expiresIn,
      documentId: doc.id,
      type: doc.docType,
      fileName: doc.fileName,
    };
  }

  async getShopKyc(shopId: string, user?: JwtPayload | null) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    if (user) {
      if (user.role === UserRole.MERCHANT && user.shopId !== shopId) {
        throw new ForbiddenException('Not your shop');
      }
    }

    const docs = await this.prisma.kycDocument.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } },
        reviewedBy: { select: { id: true, email: true, name: true } },
        mediaAsset: {
          select: {
            id: true,
            mimeType: true,
            visibility: true,
            sizeBytes: true,
          },
        },
      },
    });

    // Strip any residual filePath that points at public /uploads/kyc
    return docs.map((d) => ({
      ...d,
      filePath: null,
      downloadPath: `/api/kyc/documents/${d.id}/download`,
    }));
  }

  async reviewKycDocument(
    docId: string,
    status: string,
    reviewerId: string,
    notes?: string,
  ) {
    const started = Date.now();
    const s = String(status || '').toUpperCase();
    if (s !== 'APPROVED' && s !== 'REJECTED') {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }
    const next =
      s === 'APPROVED' ? KycDocStatus.APPROVED : KycDocStatus.REJECTED;

    const existing = await this.prisma.kycDocument.findUnique({
      where: { id: docId },
    });
    if (!existing) throw new NotFoundException('KYC document not found');
    patchRequestContext({
      shopId: existing.shopId,
      userId: reviewerId,
    });

    const doc = await this.prisma.kycDocument.update({
      where: { id: docId },
      data: {
        status: next,
        notes: notes ?? null,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        shop: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, email: true } },
      },
    });

    if (next === KycDocStatus.APPROVED) {
      const pending = await this.prisma.kycDocument.count({
        where: { shopId: doc.shopId, status: KycDocStatus.PENDING },
      });
      if (pending === 0) {
        await this.prisma.shop.update({
          where: { id: doc.shopId },
          data: {
            verified: true,
            status: 'ACTIVE',
            kycNotes: notes || 'KYC approved',
          },
        });
      }
    }

    if (next === KycDocStatus.REJECTED) {
      await this.prisma.shop.update({
        where: { id: doc.shopId },
        data: {
          verified: false,
          rejectionReason: notes || 'KYC document rejected',
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        action: `KYC_${next}`,
        entityType: 'KycDocument',
        entityId: docId,
        meta: JSON.stringify({ shopId: doc.shopId, notes }),
      },
    });

    let notifyEmail = doc.uploadedBy?.email;
    let notifyName = doc.uploadedBy?.name;
    let notifyUserId = doc.uploadedBy?.id as string | undefined;
    if (!notifyEmail || !notifyUserId) {
      const merchant = await this.prisma.user.findFirst({
        where: { shopId: doc.shopId, role: UserRole.MERCHANT },
        select: { id: true, email: true, name: true },
      });
      notifyEmail = notifyEmail || merchant?.email;
      notifyName = notifyName || merchant?.name;
      notifyUserId = notifyUserId || merchant?.id;
    }

    let notification: {
      success: boolean;
      channel: string;
      sentTo?: string;
      status?: string;
      skipped?: string;
      notificationId?: string;
    } | null = null;

    const approved = next === KycDocStatus.APPROVED;
    const statusLabel = approved ? 'APPROVED' : 'REJECTED';

    // Stage 18: durable in-app + email delivery records
    if (notifyUserId) {
      const created = await this.inAppNotifications.notify({
        userId: notifyUserId,
        type: approved ? 'KYC_APPROVED' : 'KYC_REJECTED',
        title: approved ? 'KYC одобрен' : 'KYC отклонён',
        body: approved
          ? `Документ KYC для «${doc.shop.name}» одобрен${notes ? `: ${notes}` : ''}`
          : `Документ KYC для «${doc.shop.name}» отклонён${notes ? `: ${notes}` : ''}`,
        data: {
          shopId: doc.shopId,
          documentId: docId,
          status: statusLabel,
          notes: notes || null,
        },
        link: '/merchant/kyc',
      });
      notification = {
        success: true,
        channel: 'in_app+email',
        sentTo: notifyEmail,
        status: statusLabel,
        notificationId: created?.id,
      };
    }

    if (notifyEmail) {
      const emailResult = await this.notifications.sendKycStatus({
        email: notifyEmail,
        name: notifyName,
        status: approved ? 'APPROVED' : 'REJECTED',
        reason: notes,
        shopName: doc.shop.name,
      });
      if (!notification) {
        notification = emailResult;
      }
    } else if (!notification) {
      notification = {
        success: false,
        channel: 'log',
        skipped: 'no merchant email for shop',
      };
    }

    this.slog.info('KYC document reviewed', {
      shopId: doc.shopId,
      userId: reviewerId,
      status: next,
      durationMs: Date.now() - started,
    });

    return { document: doc, notification };
  }

  async deleteKycDocument(docId: string, user: JwtPayload) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: docId },
      include: { mediaAsset: true },
    });
    if (!doc) throw new NotFoundException('KYC document not found');

    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const isOwner =
      user.role === UserRole.MERCHANT && user.shopId === doc.shopId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException();
    }
    if (!isAdmin && doc.status !== KycDocStatus.PENDING) {
      throw new ForbiddenException('Only PENDING documents can be deleted');
    }

    if (doc.mediaAsset?.storageKey) {
      await this.storage.deleteImage(doc.mediaAsset.storageKey);
    } else if (doc.filePath) {
      await this.storage.deleteImage(doc.filePath);
    }

    // Unlink then delete media + document
    if (doc.mediaAssetId) {
      await this.prisma.kycDocument.update({
        where: { id: docId },
        data: { mediaAssetId: null },
      });
      await this.prisma.mediaAsset
        .delete({ where: { id: doc.mediaAssetId } })
        .catch(() => null);
    }

    await this.prisma.kycDocument.delete({ where: { id: docId } });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'KYC_DELETE',
        entityType: 'KycDocument',
        entityId: docId,
        meta: JSON.stringify({
          shopId: doc.shopId,
          mediaAssetId: doc.mediaAssetId,
        }),
      },
    });

    return { success: true };
  }

  private assertCanAccessKyc(
    shopId: string,
    uploadedById: string | null | undefined,
    user: JwtPayload,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const isShopOwner = !!user.shopId && user.shopId === shopId;
    const isUploader = !!uploadedById && uploadedById === user.sub;

    if (!isAdmin && !isShopOwner && !isUploader) {
      throw new ForbiddenException('Access denied to this KYC document');
    }
  }
}
