import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';

const ALLOWED_FOLDERS = [
  'products',
  'documents',
  'kyc',
  'avatars',
  'other',
] as const;

class PresignBody {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Universal file upload.
   * folder: products | documents | kyc | avatars | other
   */
  @Post('upload')
  @ApiOperation({ summary: 'Upload media file (image → WebP, docs as-is)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'products' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder = 'products',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const folderNorm = String(folder || 'products').trim() || 'products';
    if (!ALLOWED_FOLDERS.includes(folderNorm as (typeof ALLOWED_FOLDERS)[number])) {
      throw new BadRequestException(
        `Folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 10 MB)');
    }

    const isImage = file.mimetype?.startsWith('image/');
    const url = isImage
      ? await this.storage.uploadImage(file, folderNorm)
      : await this.storage.uploadFile(file, folderNorm);

    return {
      url,
      folder: folderNorm,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /** Delete file by public URL or storage key */
  @Delete()
  @ApiOperation({ summary: 'Delete media by ?url=' })
  async delete(@Query('url') url: string) {
    if (!url) {
      throw new BadRequestException('url query parameter is required');
    }
    await this.storage.deleteImage(url);
    return { success: true };
  }

  /** Presigned URL for direct browser → storage upload (optional) */
  @Post('presign')
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
    const contentType = body.contentType || 'image/webp';
    return this.storage.getPresignedUploadUrl(folder, contentType);
  }
}
