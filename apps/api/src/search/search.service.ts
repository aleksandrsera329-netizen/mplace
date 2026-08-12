import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch, type Index, type SearchParams } from 'meilisearch';

export type ProductSearchDoc = {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  priceCents: number;
  status: string;
  categoryId?: string | null;
  categoryName?: string;
  shopId: string;
  shopName?: string;
  brand?: string | null;
  stock?: number;
  moq?: number | null;
  inStock?: boolean;
  /** Prisma JsonValue or plain object */
  attributes?: unknown;
  imageUrl?: string | null;
  currency?: string;
  createdAt?: Date | string | null;
  category?: { name?: string } | null;
  shop?: { name?: string } | null;
  reservedStock?: number;
};

export type SearchProductsQuery = {
  q?: string;
  category?: string;
  categoryId?: string;
  shopId?: string;
  vendor?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean | string;
  stock?: string; // 'in' | 'out' | 'in stock' | 'out of stock'
  moq?: number;
  moqMax?: number;
  attributes?: Record<string, string> | string;
  page?: number;
  limit?: number;
  sort?: string; // price_asc | price_desc | name_asc | name_desc | newest
};

const FACET_ATTRS = [
  'categoryId',
  'categoryName',
  'brand',
  'shopId',
  'shopName',
  'inStock',
  'status',
] as const;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: Meilisearch | null = null;
  private productsIndex: Index | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get<string>('MEILISEARCH_URL');
    const apiKey =
      this.config.get<string>('MEILISEARCH_API_KEY') ||
      this.config.get<string>('MEILI_MASTER_KEY');

    if (!host) {
      this.logger.warn('MEILISEARCH_URL not set — search disabled');
      return;
    }

    this.client = new Meilisearch({ host, apiKey });

    try {
      await this.client.health();
      const index = this.client.index('products');
      this.productsIndex = index;
      await this.applyIndexSettings(index);
      this.logger.log('Meilisearch connected + products index ready (Stage 17)');
    } catch (e) {
      this.logger.error(
        `Meilisearch connection failed: ${(e as Error).message}`,
      );
      this.client = null;
      this.productsIndex = null;
    }
  }

  private async applyIndexSettings(index: Index) {
    await index.updateSettings({
      searchableAttributes: [
        'name',
        'description',
        'sku',
        'brand',
        'categoryName',
        'shopName',
      ],
      filterableAttributes: [
        'categoryId',
        'categoryName',
        'shopId',
        'shopName',
        'brand',
        'priceCents',
        'stock',
        'status',
        'moq',
        'inStock',
        'attributes',
      ],
      sortableAttributes: ['priceCents', 'createdAt', 'name', 'stock', 'moq'],
      faceting: {
        maxValuesPerFacet: 100,
      },
      pagination: {
        maxTotalHits: 10_000,
      },
    });
  }

  get enabled() {
    return !!this.client && !!this.productsIndex;
  }

  /** Normalize Prisma product → Meilisearch document */
  toDocument(
    product: ProductSearchDoc & {
      attributes?: unknown;
      reservedStock?: number;
    },
  ) {
    const stock = product.stock ?? 0;
    const reserved = product.reservedStock ?? 0;
    const available = Math.max(0, stock - reserved);
    const attrs =
      product.attributes &&
      typeof product.attributes === 'object' &&
      !Array.isArray(product.attributes)
        ? (product.attributes as Record<string, unknown>)
        : {};

    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      priceCents: product.priceCents,
      status: product.status,
      categoryId: product.categoryId ?? null,
      categoryName: product.categoryName || product.category?.name || '',
      shopId: product.shopId,
      shopName: product.shopName || product.shop?.name || '',
      brand: product.brand || '',
      stock: available,
      moq: product.moq ?? 1,
      inStock: available > 0,
      attributes: attrs,
      imageUrl: product.imageUrl || null,
      currency: product.currency || 'USD',
      createdAt:
        product.createdAt instanceof Date
          ? product.createdAt.toISOString()
          : product.createdAt || null,
    };
  }

  async indexProduct(product: ProductSearchDoc) {
    if (!this.productsIndex) return;

    // Only ACTIVE products are searchable
    if (product.status && product.status !== 'ACTIVE') {
      await this.removeProduct(product.id);
      return;
    }

    try {
      await this.productsIndex.addDocuments([this.toDocument(product)]);
    } catch (e) {
      this.logger.error(`indexProduct failed ${product.id}`, e as Error);
      throw e; // let queue retry
    }
  }

  async removeProduct(productId: string) {
    if (!this.productsIndex) return;
    try {
      await this.productsIndex.deleteDocument(productId);
    } catch (e) {
      this.logger.error(`removeProduct failed ${productId}`, e as Error);
      throw e;
    }
  }

  /**
   * Stage 17: full product search with filters + facets.
   */
  async searchProductsAdvanced(query: SearchProductsQuery) {
    const q = (query.q || '').trim();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const filter = this.buildFilter(query);
    const sort = this.buildSort(query.sort);

    if (!this.productsIndex) {
      return {
        hits: [] as unknown[],
        facets: {},
        facetDistribution: {},
        total: 0,
        estimatedTotalHits: 0,
        page,
        limit,
        pageCount: 0,
        query: q,
        processingTimeMs: 0,
        enabled: false,
      };
    }

    const params: SearchParams = {
      limit,
      offset,
      filter: filter || undefined,
      sort: sort.length ? sort : undefined,
      facets: [...FACET_ATTRS],
      attributesToHighlight: ['name', 'description', 'sku'],
      showRankingScore: true,
    };

    const started = Date.now();
    const result = await this.productsIndex.search(q || '', params);
    const processingTimeMs =
      result.processingTimeMs ?? Date.now() - started;
    const total =
      result.estimatedTotalHits ??
      (result as { nbHits?: number }).nbHits ??
      result.hits.length;

    // Map facetDistribution → friendlier facets
    const facetDistribution =
      (result.facetDistribution as Record<
        string,
        Record<string, number>
      >) || {};
    const facets = {
      category: facetDistribution.categoryName || facetDistribution.categoryId || {},
      brand: facetDistribution.brand || {},
      vendor: facetDistribution.shopName || facetDistribution.shopId || {},
      availability: facetDistribution.inStock || {},
      priceRange: this.estimatePriceRange(result.hits as { priceCents?: number }[]),
    };

    return {
      hits: result.hits,
      facets,
      facetDistribution,
      total,
      estimatedTotalHits: total,
      page,
      limit,
      pageCount: Math.ceil(total / limit) || 0,
      query: q,
      processingTimeMs,
      enabled: true,
    };
  }

  /** Backward-compatible thin wrapper */
  async searchProducts(
    query: string,
    options: { limit?: number; filter?: string; offset?: number } = {},
  ) {
    if (!this.productsIndex) {
      return {
        hits: [] as unknown[],
        query,
        estimatedTotalHits: 0,
        processingTimeMs: 0,
      };
    }

    return this.productsIndex.search(query, {
      limit: options.limit || 20,
      offset: options.offset || 0,
      filter: options.filter,
      facets: [...FACET_ATTRS],
    });
  }

  /**
   * Autocomplete / typeahead — short list of name+sku hits.
   * Client can add keyboard navigation on top.
   */
  async autocomplete(q: string, limit = 8) {
    const query = (q || '').trim();
    if (query.length < 1) {
      return { suggestions: [], query, processingTimeMs: 0 };
    }
    if (!this.productsIndex) {
      return { suggestions: [], query, processingTimeMs: 0, enabled: false };
    }

    const result = await this.productsIndex.search(query, {
      limit: Math.min(20, Math.max(1, limit)),
      filter: 'status = ACTIVE',
      attributesToRetrieve: [
        'id',
        'name',
        'sku',
        'brand',
        'priceCents',
        'imageUrl',
        'shopName',
        'categoryName',
      ],
      attributesToHighlight: ['name', 'sku'],
    });

    const suggestions = result.hits.map((h: Record<string, unknown>) => ({
      id: h.id,
      label: h.name,
      sku: h.sku || null,
      brand: h.brand || null,
      priceCents: h.priceCents,
      imageUrl: h.imageUrl || null,
      shopName: h.shopName || null,
      categoryName: h.categoryName || null,
      _formatted: (h as { _formatted?: unknown })._formatted,
    }));

    return {
      suggestions,
      query,
      processingTimeMs: result.processingTimeMs ?? 0,
      enabled: true,
    };
  }

  buildFilter(query: SearchProductsQuery): string {
    const parts: string[] = ['status = ACTIVE'];

    const categoryId = query.categoryId || query.category;
    if (categoryId) {
      // Allow name or id: prefer id equality; if looks like name, use categoryName
      if (categoryId.includes(' ') || /[а-яА-Я]/.test(categoryId)) {
        parts.push(`categoryName = "${this.escape(categoryId)}"`);
      } else {
        parts.push(
          `(categoryId = "${this.escape(categoryId)}" OR categoryName = "${this.escape(categoryId)}")`,
        );
      }
    }

    if (query.shopId) {
      parts.push(`shopId = "${this.escape(query.shopId)}"`);
    } else if (query.vendor) {
      parts.push(
        `(shopId = "${this.escape(query.vendor)}" OR shopName = "${this.escape(query.vendor)}")`,
      );
    }

    if (query.brand) {
      parts.push(`brand = "${this.escape(query.brand)}"`);
    }

    if (query.priceMin != null && !Number.isNaN(Number(query.priceMin))) {
      parts.push(`priceCents >= ${Math.round(Number(query.priceMin))}`);
    }
    if (query.priceMax != null && !Number.isNaN(Number(query.priceMax))) {
      parts.push(`priceCents <= ${Math.round(Number(query.priceMax))}`);
    }

    const inStock = this.parseInStock(query.inStock, query.stock);
    if (inStock === true) parts.push('inStock = true');
    if (inStock === false) parts.push('inStock = false');

    if (query.moq != null && !Number.isNaN(Number(query.moq))) {
      parts.push(`moq <= ${Math.round(Number(query.moq))}`);
    }
    if (query.moqMax != null && !Number.isNaN(Number(query.moqMax))) {
      parts.push(`moq <= ${Math.round(Number(query.moqMax))}`);
    }

    // Dynamic attributes: attributes.color = "red" (Meili nested filter)
    const attrs = this.parseAttributes(query.attributes);
    for (const [key, value] of Object.entries(attrs)) {
      if (!key || value == null || value === '') continue;
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      if (!safeKey) continue;
      parts.push(`attributes.${safeKey} = "${this.escape(String(value))}"`);
    }

    return parts.join(' AND ');
  }

  private parseInStock(
    inStock?: boolean | string,
    stock?: string,
  ): boolean | null {
    if (inStock === true || inStock === 'true' || inStock === '1') return true;
    if (inStock === false || inStock === 'false' || inStock === '0') return false;
    if (stock) {
      const s = stock.toLowerCase().replace(/_/g, ' ').trim();
      if (s === 'in' || s === 'in stock' || s === 'instock') return true;
      if (s === 'out' || s === 'out of stock' || s === 'outofstock') return false;
    }
    return null;
  }

  private parseAttributes(
    raw?: Record<string, string> | string,
  ): Record<string, string> {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // attr format: color:red,size:xl
      const out: Record<string, string> = {};
      for (const part of raw.split(',')) {
        const [k, ...rest] = part.split(':');
        if (k && rest.length) out[k.trim()] = rest.join(':').trim();
      }
      return out;
    }
    return {};
  }

  private buildSort(sort?: string): string[] {
    if (!sort) return [];
    switch (sort.toLowerCase()) {
      case 'price_asc':
      case 'price-asc':
      case 'priceasc':
        return ['priceCents:asc'];
      case 'price_desc':
      case 'price-desc':
      case 'pricedesc':
        return ['priceCents:desc'];
      case 'name_asc':
      case 'name':
        return ['name:asc'];
      case 'name_desc':
        return ['name:desc'];
      case 'newest':
      case 'created_desc':
        return ['createdAt:desc'];
      case 'oldest':
        return ['createdAt:asc'];
      case 'stock_desc':
        return ['stock:desc'];
      default:
        return [];
    }
  }

  private escape(value: string): string {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private estimatePriceRange(hits: { priceCents?: number }[]) {
    if (!hits.length) return { min: null, max: null };
    let min = Infinity;
    let max = -Infinity;
    for (const h of hits) {
      const p = h.priceCents;
      if (typeof p !== 'number') continue;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    if (!Number.isFinite(min)) return { min: null, max: null };
    return { min, max };
  }
}
