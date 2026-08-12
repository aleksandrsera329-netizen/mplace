import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InventoryService } from '../../warehouse/inventory.service';
import { QUEUE_INVENTORY } from '../../queue/queue.constants';

/**
 * Stage 19: inventory background jobs (release expired reservations).
 */
@Processor(QUEUE_INVENTORY)
export class InventoryJobProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryJobProcessor.name);

  constructor(private readonly inventory: InventoryService) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'release-expired') {
      const result = await this.inventory.releaseExpired();
      this.logger.log(
        `[inventory] release-expired job=${job.id} expired=${result.expired}`,
      );
      return result;
    }
    this.logger.warn(`[inventory] unknown job ${job.name}`);
    return { ok: true, skipped: true };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `[inventory] job=${job?.id} failed: ${error.message}`,
    );
  }
}
