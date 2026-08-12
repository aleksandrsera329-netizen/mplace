import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../../search/search.service';
import { QUEUE_SEARCH } from '../queue.constants';

export type SearchIndexJobData = {
  action?: 'index' | 'remove';
  productId: string;
};

/**
 * Stage 17/19: async Meilisearch index / remove (retries on failure).
 * Job names: index | remove | index-product | remove-product
 */
@Processor(QUEUE_SEARCH)
export class SearchIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
  ) {
    super();
  }

  async process(job: Job<SearchIndexJobData>) {
    const productId = job.data?.productId;
    const actionFromName =
      job.name === 'remove-product' || job.name === 'remove'
        ? 'remove'
        : job.name === 'index-product' || job.name === 'index'
          ? 'index'
          : undefined;
    const action = job.data?.action || actionFromName || 'index';

    this.logger.log(
      `[search] job=${job.id} name=${job.name} action=${action} product=${productId}`,
    );
    if (!productId) return { ok: false, reason: 'no productId' };

    if (action === 'remove') {
      await this.search.removeProduct(productId);
      return { ok: true, action: 'remove', productId };
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { name: true } },
        shop: { select: { name: true } },
      },
    });
    if (!product) {
      // Product gone → ensure removed from index
      await this.search.removeProduct(productId).catch(() => null);
      this.logger.warn(`product ${productId} not found — removed from index`);
      return { ok: false, reason: 'not_found' };
    }

    if (product.status !== ProductStatus.ACTIVE) {
      await this.search.removeProduct(productId);
      return { ok: true, action: 'remove', productId, reason: 'not_active' };
    }

    await this.search.indexProduct(product);
    return { ok: true, action: 'index', productId };
  }
}
