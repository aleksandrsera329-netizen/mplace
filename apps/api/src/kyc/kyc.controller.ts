import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { KycDocStatus, KycDocType, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

class UploadKycDto {
  @IsEnum(KycDocType)
  docType!: KycDocType;

  @IsString()
  @MinLength(1)
  fileName!: string;

  /** Path or data-url placeholder until real storage */
  @IsString()
  @MinLength(1)
  filePath!: string;
}

class ReviewKycDto {
  @IsEnum(KycDocStatus)
  status!: KycDocStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Controller('kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KycController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Post('documents')
  @Roles(UserRole.MERCHANT)
  async upload(@CurrentUser() user: JwtPayload, @Body() dto: UploadKycDto) {
    if (!user.shopId) {
      return { error: 'No shop linked' };
    }
    return this.prisma.kycDocument.create({
      data: {
        shopId: user.shopId,
        uploadedById: user.sub,
        docType: dto.docType,
        fileName: dto.fileName,
        filePath: dto.filePath,
        status: KycDocStatus.PENDING,
      },
    });
  }

  @Get('me')
  @Roles(UserRole.MERCHANT)
  myDocs(@CurrentUser() user: JwtPayload) {
    if (!user.shopId) return [];
    return this.prisma.kycDocument.findMany({
      where: { shopId: user.shopId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  pending() {
    return this.prisma.kycDocument.findMany({
      where: { status: KycDocStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        shop: { select: { id: true, name: true, slug: true, status: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  @Patch('documents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async review(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    const doc = await this.prisma.kycDocument.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        reviewedById: user.sub,
        reviewedAt: new Date(),
      },
      include: {
        shop: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (dto.status === KycDocStatus.APPROVED) {
      const pending = await this.prisma.kycDocument.count({
        where: { shopId: doc.shopId, status: KycDocStatus.PENDING },
      });
      if (pending === 0) {
        await this.prisma.shop.update({
          where: { id: doc.shopId },
          data: {
            verified: true,
            status: 'ACTIVE',
            kycNotes: dto.notes || 'KYC approved',
          },
        });
      }
    }

    if (dto.status === KycDocStatus.REJECTED) {
      await this.prisma.shop.update({
        where: { id: doc.shopId },
        data: {
          verified: false,
          rejectionReason: dto.notes || 'KYC document rejected',
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: `KYC_${dto.status}`,
        entityType: 'KycDocument',
        entityId: id,
        meta: JSON.stringify({ shopId: doc.shopId, notes: dto.notes }),
      },
    });

    // Notify merchant (uploader or first shop merchant)
    let notifyEmail = doc.uploadedBy?.email;
    let notifyName = doc.uploadedBy?.name;
    if (!notifyEmail) {
      const merchant = await this.prisma.user.findFirst({
        where: {
          shopId: doc.shopId,
          role: { in: [UserRole.MERCHANT] },
        },
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

    if (
      notifyEmail &&
      (dto.status === KycDocStatus.APPROVED ||
        dto.status === KycDocStatus.REJECTED)
    ) {
      notification = await this.notifications.sendKycStatus({
        email: notifyEmail,
        name: notifyName,
        status: dto.status === KycDocStatus.APPROVED ? 'APPROVED' : 'REJECTED',
        reason: dto.notes,
        shopName: doc.shop.name,
      });
    } else if (!notifyEmail) {
      notification = {
        success: false,
        channel: 'log',
        skipped: 'no merchant email for shop',
      };
    }

    return {
      document: doc,
      notification,
    };
  }
}
