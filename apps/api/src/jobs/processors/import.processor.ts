import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MerchantProductsService } from '../../merchant/merchant-products.service';
import { QUEUE_IMPORTS } from '../../queue/queue.constants';

export type ImportJobData = {
  importJobId: string;
  shopId: string;
  actorId?: string;
};

/**
 * Stage 19: product CSV import runs in background after confirm.
 */
@Processor(QUEUE_IMPORTS)
export class ImportJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportJobProcessor.name);

  constructor(private readonly products: MerchantProductsService) {
    super();
  }

  async process(job: Job<ImportJobData>) {
    const { importJobId, shopId, actorId } = job.data || {};
    this.logger.log(
      `[import] job=${job.id} importJobId=${importJobId} shop=${shopId}`,
    );
    if (!importJobId) {
      throw new Error('importJobId required');
    }
    const result = await this.products.processImportJob(
      importJobId,
      actorId,
    );
    this.logger.log(
      `[import] done importJobId=${importJobId} status=${result.status} created=${result.created ?? 0}`,
    );
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ImportJobData> | undefined, error: Error) {
    this.logger.error(
      `[import] job=${job?.id} importJobId=${job?.data?.importJobId} failed: ${error.message}`,
    );
  }
}
