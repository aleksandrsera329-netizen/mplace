import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { multerMemoryOptions } from '../common/upload/multer-options';
import { CreateProductDto } from '../catalog/dto/create-product.dto';
import { UpdateProductDto } from '../catalog/dto/update-product.dto';
import { MerchantProductsService } from './merchant-products.service';

class BulkEditDataDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}

class BulkEditDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[];

  @ValidateNested()
  @Type(() => BulkEditDataDto)
  data!: BulkEditDataDto;
}

/**
 * Stage 16: merchant product management.
 * Static routes registered before :id.
 */
@ApiTags('Merchant Products')
@Controller('merchant/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
export class MerchantProductsController {
  constructor(private readonly products: MerchantProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List shop products' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.list(user, {
      status,
      search,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create product' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk update products by ids' })
  bulk(@CurrentUser() user: JwtPayload, @Body() dto: BulkEditDto) {
    return this.products.bulkUpdate(user, dto.ids, dto.data || {});
  }

  // ── Import pipeline (before :id) ───────────────────────

  @Throttle(ThrottleLimits.UPLOAD)
  @Post('import/upload')
  @ApiOperation({ summary: 'Upload CSV for product import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('csv')))
  uploadImport(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.products.uploadImport(user, file);
  }

  @Get('import/:jobId/preview')
  @ApiOperation({ summary: 'Validate import file and preview rows' })
  previewImport(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    return this.products.previewImport(user, jobId);
  }

  @Post('import/:jobId/confirm')
  @ApiOperation({ summary: 'Create products from valid import rows' })
  confirmImport(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    return this.products.confirmImport(user, jobId);
  }

  @Get('import/:jobId')
  getImportJob(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
  ) {
    return this.products.getImportJob(user, jobId);
  }

  // ── Single product ─────────────────────────────────────

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.products.getOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(user, id, dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate product as DRAFT' })
  duplicate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.products.duplicate(user, id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive product (soft delete)' })
  archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.products.archive(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.products.remove(user, id);
  }
}
