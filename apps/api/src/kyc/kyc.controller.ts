import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  KycDocStatus,
  KycDocType,
  Permission,
  UserRole,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { multerMemoryOptions } from '../common/upload/multer-options';
import { PrismaService } from '../prisma/prisma.service';
import { KycService } from './kyc.service';

class UploadKycMetaDto {
  @IsOptional()
  @IsEnum(KycDocType)
  docType?: KycDocType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fileName?: string;

  /** @deprecated Legacy JSON body path — Stage 2 requires multipart private upload */
  @IsOptional()
  @IsString()
  @MinLength(1)
  filePath?: string;
}

class ReviewKycDto {
  @IsEnum(KycDocStatus)
  status!: KycDocStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('KYC')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class KycController {
  constructor(
    private readonly kyc: KycService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Shop-scoped KYC ────────────────────────────────────

  @Throttle(ThrottleLimits.UPLOAD)
  @Post('shops/:id/kyc')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload KYC document (private MediaAsset)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        docType: { type: 'string', example: 'PASSPORT' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('kyc')))
  uploadForShop(
    @Param('id') shopId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('docType') docType?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.kyc.uploadKycDocument(shopId, user, file, docType || 'OTHER');
  }

  @Get('shops/:id/kyc')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List KYC documents for shop' })
  listForShop(
    @Param('id') shopId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.kyc.getShopKyc(shopId, user);
  }

  /**
   * Stage 2: signed download URL (ACL + audit KYC_DOWNLOAD).
   * Without JWT → 401. Cross-shop → 403.
   */
  @Get('kyc/documents/:id/download')
  @Roles(
    UserRole.MERCHANT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiOperation({
    summary: 'Get short-lived signed URL for KYC document download',
  })
  download(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.kyc.getDownloadUrl(id, user);
  }

  @Patch('kyc/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.kyc_approve)
  @ApiOperation({ summary: 'Approve or reject KYC document' })
  reviewStatus(
    @Param('id') id: string,
    @Body() body: ReviewKycDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.kyc.reviewKycDocument(
      id,
      body.status,
      user.sub,
      body.notes,
    );
  }

  @Delete('kyc/:id')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete KYC document' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.kyc.deleteKycDocument(id, user);
  }

  // ── Legacy aliases ─────────────────────────────────────

  /**
   * @deprecated Use multipart POST /shops/:id/kyc (private storage).
   * filePath-based upload is blocked (Stage 2 private KYC).
   */
  @Throttle(ThrottleLimits.UPLOAD)
  @Post('kyc/documents')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('kyc')))
  async uploadDocuments(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadKycMetaDto,
    @Body('shopId') shopIdBody?: string,
    @Body('type') typeBody?: string,
    @Body('docType') docTypeBody?: string,
  ) {
    const shopId = shopIdBody || user.shopId;
    if (!shopId) {
      throw new BadRequestException('No shop linked — provide shopId');
    }
    if (!file) {
      throw new BadRequestException(
        'Multipart file is required. Public filePath uploads are disabled (private KYC). Use POST /shops/:id/kyc',
      );
    }
    const docType = typeBody || docTypeBody || dto.docType || 'OTHER';
    return this.kyc.uploadKycDocument(shopId, user, file, String(docType));
  }

  /** @deprecated prefer GET /shops/:id/kyc */
  @Get('kyc/me')
  @Roles(UserRole.MERCHANT)
  myDocs(@CurrentUser() user: JwtPayload) {
    if (!user.shopId) return [];
    return this.kyc.getShopKyc(user.shopId, user);
  }

  @Get('kyc/pending')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.kyc_read)
  pending() {
    return this.prisma.kycDocument.findMany({
      where: { status: KycDocStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        shop: { select: { id: true, name: true, slug: true, status: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        mediaAsset: {
          select: { id: true, mimeType: true, visibility: true, sizeBytes: true },
        },
      },
    });
  }

  /** @deprecated prefer PATCH /kyc/:id/status */
  @Patch('kyc/documents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.kyc_approve)
  reviewLegacy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kyc.reviewKycDocument(id, dto.status, user.sub, dto.notes);
  }

  /** Alias for Stage 2 review path */
  @Patch('kyc/documents/:id/review')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.kyc_approve)
  reviewAlias(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kyc.reviewKycDocument(id, dto.status, user.sub, dto.notes);
  }
}
