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
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { multerMemoryOptions } from '../common/upload/multer-options';
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
  @Throttle(ThrottleLimits.SEARCH)
  @Get('products/search')
  @ApiOperation({
    summary: 'Search products via Meilisearch (alias of /search/products)',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'priceMin', required: false })
  @ApiQuery({ name: 'priceMax', required: false })
  @ApiQuery({ name: 'inStock', required: false })
  @ApiQuery({ name: 'sort', required: false })
  searchProducts(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('categoryId') categoryId?: string,
    @Query('shopId') shopId?: string,
    @Query('brand') brand?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('inStock') inStock?: string,
    @Query('sort') sort?: string,
  ) {
    return this.catalog.searchProducts(q || '', {
      limit: limit ? Number(limit) : 20,
      page: page ? Number(page) : 1,
      categoryId,
      shopId,
      brand,
      priceMin: priceMin != null ? Number(priceMin) : undefined,
      priceMax: priceMax != null ? Number(priceMax) : undefined,
      inStock,
      sort,
    });
  }

  /**
   * Upload product image (WebP via StorageService).
   * POST /api/products/upload-image  field: file
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.SUPER_ADMIN)
  @Throttle(ThrottleLimits.UPLOAD)
  @Post('products/upload-image')
  @ApiOperation({ summary: 'Upload product image (returns { url })' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('image')))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
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

  /** Per-warehouse stock for a product (merchant) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.SUPER_ADMIN)
  @Get('products/:id/stocks')
  @ApiOperation({ summary: 'List product stock by warehouse' })
  getProductStocks(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.catalog.getProductStocks(user, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  @Delete('products/:id')
  deleteProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.catalog.deleteProduct(user, id);
  }

  /** List product documents (public) */
  @Get('products/:id/documents')
  @ApiOperation({ summary: 'List product documents (certificates, PDFs, …)' })
  getProductDocuments(@Param('id') productId: string) {
    return this.catalog.getProductDocuments(productId);
  }

  /** Upload product document */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.SUPER_ADMIN)
  @Post('products/:id/documents')
  @ApiOperation({ summary: 'Upload product document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        docType: { type: 'string', example: 'certificate' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', multerMemoryOptions('document')))
  uploadProductDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('docType') docType?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.catalog.addProductDocument(
      productId,
      user,
      file,
      name,
      docType || 'certificate',
    );
  }

  /** Delete product document */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT, UserRole.SUPER_ADMIN)
  @Delete('products/:id/documents/:docId')
  @ApiOperation({ summary: 'Delete product document' })
  deleteProductDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') productId: string,
    @Param('docId') docId: string,
  ) {
    return this.catalog.deleteProductDocument(productId, docId, user);
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
