import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch, type Index } from 'meilisearch';

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
  createdAt?: Date | string;
};

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

      await index.updateSettings({
        searchableAttributes: [
          'name',
          'description',
          'sku',
          'categoryName',
          'shopName',
        ],
        filterableAttributes: [
          'categoryId',
          'shopId',
          'status',
          'priceCents',
        ],
        sortableAttributes: ['priceCents', 'createdAt'],
      });

      this.logger.log('Meilisearch connected + products index ready');
    } catch (e) {
      this.logger.error(
        `Meilisearch connection failed: ${(e as Error).message}`,
      );
      this.client = null;
      this.productsIndex = null;
    }
  }

  get enabled() {
    return !!this.client && !!this.productsIndex;
  }

  async indexProduct(product: ProductSearchDoc & {
    category?: { name?: string } | null;
    shop?: { name?: string } | null;
  }) {
    if (!this.productsIndex) return;

    try {
      await this.productsIndex.addDocuments([
        {
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
          createdAt:
            product.createdAt instanceof Date
              ? product.createdAt.toISOString()
              : product.createdAt || null,
        },
      ]);
    } catch (e) {
      this.logger.error(`indexProduct failed ${product.id}`, e as Error);
    }
  }

  async removeProduct(productId: string) {
    if (!this.productsIndex) return;
    try {
      await this.productsIndex.deleteDocument(productId);
    } catch (e) {
      this.logger.error(`removeProduct failed ${productId}`, e as Error);
    }
  }

  async searchProducts(
    query: string,
    options: { limit?: number; filter?: string; offset?: number } = {},
  ) {
    if (!this.productsIndex) {
      return { hits: [] as unknown[], query, estimatedTotalHits: 0 };
    }

    return this.productsIndex.search(query, {
      limit: options.limit || 20,
      offset: options.offset || 0,
      filter: options.filter,
    });
  }
}
