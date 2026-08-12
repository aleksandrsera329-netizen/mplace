import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { multerMemoryOptions } from '../common/upload/multer-options';
import { StorageService } from '../storage/storage.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { MediaService } from './media.service';

class PresignBody {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

const ALLOWED_FOLDERS = [
  'products',
  'documents',
  'kyc',
  'avatars',
  'other',
] as const;

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Upload with ownership (MediaAsset).
   * multipart: file + entityType + entityId + optional shopId + visibility
   */
  @Throttle(ThrottleLimits.UPLOAD)
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload media (owned asset)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'entityType', 'entityId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', example: 'product' },
        entityId: { type: 'string' },
        shopId: { type: 'string' },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'PRIVATE', 'KYC'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('media')))
  async uploadOwned(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMediaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.create(file, dto, user);
  }

  /**
   * Legacy upload by folder — still creates MediaAsset (owner = current user).
   * Prefer POST /media with entityType/entityId.
   */
  @Throttle(ThrottleLimits.UPLOAD)
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Legacy upload by folder (creates MediaAsset for ownership)',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('media')))
  async uploadLegacy(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder = 'products',
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const folderNorm = String(folder || 'products').trim() || 'products';
    if (
      !ALLOWED_FOLDERS.includes(
        folderNorm as (typeof ALLOWED_FOLDERS)[number],
      )
    ) {
      throw new BadRequestException(
        `Folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }
    return this.mediaService.createLegacy(file, folderNorm, user);
  }

  /**
   * Local signed download (HMAC). Used for private/KYC when STORAGE_PROVIDER=local.
   * Token is short-lived; no JWT required (capability URL).
   */
  @Get('signed')
  @ApiOperation({
    summary: 'Stream private object via signed local URL (expires)',
  })
  async signedDownload(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    if (!key || !exp || !sig) {
      throw new BadRequestException('key, exp, sig are required');
    }
    const storageKey = this.storage.verifyLocalSignedUrl(key, exp, sig);
    const { body, contentType } = await this.storage.readObject(storageKey);
    res.setHeader(
      'Content-Type',
      contentType || 'application/octet-stream',
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(body);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Get media metadata by id (KYC/PRIVATE require JWT + ACL; KYC returns signed url)',
  })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.mediaService.findOne(id, user);
  }

  /**
   * Delete by MediaAsset id only — ownership enforced.
   * Insecure DELETE /media?url= was removed (Stage 1).
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete media by id (owner / shop / admin)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mediaService.delete(id, user);
  }

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Presigned upload URL (or local upload hint)' })
  async getPresignedUrl(@Body() body: PresignBody) {
    const folder = body.folder || 'products';
    if (
      !ALLOWED_FOLDERS.includes(folder as (typeof ALLOWED_FOLDERS)[number])
    ) {
      throw new BadRequestException(
        `Folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }
    // KYC must go through private multipart upload, not public presign
    if (folder === 'kyc') {
      throw new BadRequestException(
        'KYC files cannot use public presign. Use POST /shops/:id/kyc',
      );
    }
    const contentType = body.contentType || 'image/webp';
    return this.storage.getPresignedUploadUrl(folder, contentType);
  }
}
