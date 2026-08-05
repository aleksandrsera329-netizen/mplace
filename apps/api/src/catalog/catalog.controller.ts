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
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Full-text search via Meilisearch.
   * Must be registered BEFORE products/:id
   */
  @Get('products/search')
  @ApiOperation({ summary: 'Search products via Meilisearch' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  searchProducts(
    @Query('q') q: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.catalog.searchProducts(q || '', {
      limit: limit ? Number(limit) : 20,
      categoryId,
    });
  }

  /**
   * Upload product image (WebP via StorageService).
   * POST /api/products/upload-image  field: file
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.SUPER_ADMIN)
  @Post('products/upload-image')
  @ApiOperation({ summary: 'Upload product image (returns { url })' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only images are allowed');
    }
    return this.catalog.uploadProductImage(file);
  }

  // Public + role-aware product listing (cursor pagination)
  @UseGuards(OptionalJwtAuthGuard)
  @Get('products')
  listProducts(
    @CurrentUser() user: JwtPayload | undefined,
    @Query() dto: ListProductsDto,
  ) {
    return this.catalog.listProducts(user ?? null, dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('products/:id')
  getProduct(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    return this.catalog.getProduct(id, user ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Post('products')
  createProduct(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.catalog.createProduct(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Patch('products/:id')
  updateProduct(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(user, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalog.deleteProduct(user, id);
  }

  @Get('categories')
  listCategories() {
    return this.catalog.listCategories();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  /** Reindex all ACTIVE products into Meilisearch */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('products/reindex')
  @ApiOperation({ summary: 'Reindex all ACTIVE products into Meilisearch' })
  reindexProducts() {
    return this.catalog.reindexAllProducts();
  }
}
