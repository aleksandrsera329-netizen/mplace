import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottleLimits } from '../common/throttle/throttle.limits';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * Stage 17: GET /api/search/products
   * Full-text + filters + facets.
   */
  @Throttle(ThrottleLimits.SEARCH)
  @Get('products')
  @ApiOperation({
    summary: 'Search products (Meilisearch) with filters and facets',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'vendor', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'priceMin', required: false })
  @ApiQuery({ name: 'priceMax', required: false })
  @ApiQuery({ name: 'inStock', required: false })
  @ApiQuery({ name: 'stock', required: false, description: 'in | out' })
  @ApiQuery({ name: 'moq', required: false })
  @ApiQuery({
    name: 'attributes',
    required: false,
    description: 'JSON or color:red,size:xl',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'price_asc | price_desc | name_asc | newest',
  })
  searchProducts(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('categoryId') categoryId?: string,
    @Query('shopId') shopId?: string,
    @Query('vendor') vendor?: string,
    @Query('brand') brand?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('inStock') inStock?: string,
    @Query('stock') stock?: string,
    @Query('moq') moq?: string,
    @Query('attributes') attributes?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.search.searchProductsAdvanced({
      q,
      category,
      categoryId,
      shopId,
      vendor,
      brand,
      priceMin: priceMin != null ? Number(priceMin) : undefined,
      priceMax: priceMax != null ? Number(priceMax) : undefined,
      inStock,
      stock,
      moq: moq != null ? Number(moq) : undefined,
      attributes,
      page: page != null ? Number(page) : 1,
      limit: limit != null ? Number(limit) : 20,
      sort,
    });
  }

  /**
   * Autocomplete / typeahead for search box (keyboard-nav ready payload).
   */
  @Throttle(ThrottleLimits.SEARCH)
  @Get('autocomplete')
  @ApiOperation({ summary: 'Product search autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  autocomplete(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.search.autocomplete(
      q || '',
      limit != null ? Number(limit) : 8,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Search engine status' })
  status() {
    return { enabled: this.search.enabled, engine: 'meilisearch' };
  }
}
