import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycDocStatus, KycDocType, UserRole } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationService,
  ) {}

  async uploadKycDocument(
    shopId: string,
    user: JwtPayload,
    file: Express.Multer.File,
    docTypeRaw = 'OTHER',
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }

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

    const isImage = file.mimetype?.startsWith('image/');
    const filePath = isImage
      ? await this.storage.uploadImage(file, 'kyc')
      : await this.storage.uploadFile(file, 'kyc');

    const doc = await this.prisma.kycDocument.create({
      data: {
        shopId,
        uploadedById: user.sub,
        docType,
        fileName: file.originalname || 'kyc-document',
        filePath,
        status: KycDocStatus.PENDING,
      },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'KYC_UPLOAD',
        entityType: 'KycDocument',
        entityId: doc.id,
        meta: JSON.stringify({ shopId, docType, filePath }),
      },
    });

    return doc;
  }

  async getShopKyc(shopId: string, user?: JwtPayload | null) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    // Public list only for admin/merchant-owner; merchants see own shop
    if (user) {
      if (user.role === UserRole.MERCHANT && user.shopId !== shopId) {
        throw new ForbiddenException('Not your shop');
      }
    }

    return this.prisma.kycDocument.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, email: true, name: true } },
        reviewedBy: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async reviewKycDocument(
    docId: string,
    status: string,
    reviewerId: string,
    notes?: string,
  ) {
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
    if (!notifyEmail) {
      const merchant = await this.prisma.user.findFirst({
        where: { shopId: doc.shopId, role: UserRole.MERCHANT },
        select: { email: true, name: true },
      });
      notifyEmail = merchant?.email;
      notifyName = merchant?.name;
    }

    let notification: {
      success: boolean;
      channel: string;
      sentTo?: string;
      status?: string;
      skipped?: string;
    } | null = null;

    if (notifyEmail) {
      notification = await this.notifications.sendKycStatus({
        email: notifyEmail,
        name: notifyName,
        status: next === KycDocStatus.APPROVED ? 'APPROVED' : 'REJECTED',
        reason: notes,
        shopName: doc.shop.name,
      });
    } else {
      notification = {
        success: false,
        channel: 'log',
        skipped: 'no merchant email for shop',
      };
    }

    return { document: doc, notification };
  }

  async deleteKycDocument(docId: string, user: JwtPayload) {
    const doc = await this.prisma.kycDocument.findUnique({
      where: { id: docId },
    });
    if (!doc) throw new NotFoundException('KYC document not found');

    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    const isOwner =
      user.role === UserRole.MERCHANT && user.shopId === doc.shopId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException();
    }
    // Merchant can only delete pending docs
    if (!isAdmin && doc.status !== KycDocStatus.PENDING) {
      throw new ForbiddenException('Only PENDING documents can be deleted');
    }

    if (doc.filePath) {
      await this.storage.deleteImage(doc.filePath);
    }
    await this.prisma.kycDocument.delete({ where: { id: docId } });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'KYC_DELETE',
        entityType: 'KycDocument',
        entityId: docId,
        meta: JSON.stringify({ shopId: doc.shopId, filePath: doc.filePath }),
      },
    });

    return { success: true };
  }
}
