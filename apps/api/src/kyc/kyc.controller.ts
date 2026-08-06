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
import { KycDocStatus, KycDocType, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
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

  /** Legacy JSON body path (pre-uploaded via /media/upload) */
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

  // ── Shop-scoped KYC (Этап 8) ───────────────────────────

  @Post('shops/:id/kyc')
  @Roles(UserRole.MERCHANT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upload KYC document for shop' })
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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
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

  @Patch('kyc/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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

  /** @deprecated prefer POST /shops/:id/kyc with multipart */
  @Post('kyc/documents')
  @Roles(UserRole.MERCHANT)
  async uploadLegacy(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadKycMetaDto,
  ) {
    if (!user.shopId) {
      throw new BadRequestException('No shop linked');
    }
    if (!dto.filePath) {
      throw new BadRequestException(
        'Use multipart POST /shops/:id/kyc or provide filePath',
      );
    }
    return this.prisma.kycDocument.create({
      data: {
        shopId: user.shopId,
        uploadedById: user.sub,
        docType: dto.docType || KycDocType.OTHER,
        fileName: dto.fileName || 'document',
        filePath: dto.filePath,
        status: KycDocStatus.PENDING,
      },
    });
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

  /** @deprecated prefer PATCH /kyc/:id/status */
  @Patch('kyc/documents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  reviewLegacy(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kyc.reviewKycDocument(id, dto.status, user.sub, dto.notes);
  }
}
