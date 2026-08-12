import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_EMAIL,
  QUEUE_IMPORTS,
  QUEUE_INVENTORY,
  QUEUE_NOTIFICATIONS,
  QUEUE_SEARCH,
} from './queue.constants';
import {
  defaultJobOptions,
  importJobOptions,
} from '../jobs/queues';

@Injectable()
export class QueueProducer {
  private readonly logger = new Logger(QueueProducer.name);

  constructor(
    @Optional() @InjectQueue(QUEUE_EMAIL) private readonly emailQ?: Queue,
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notifyQ?: Queue,
    @Optional() @InjectQueue(QUEUE_SEARCH) private readonly searchQ?: Queue,
    @Optional() @InjectQueue(QUEUE_IMPORTS) private readonly importQ?: Queue,
    @Optional()
    @InjectQueue(QUEUE_INVENTORY)
    private readonly inventoryQ?: Queue,
  ) {}

  get hasEmailQueue() {
    return !!this.emailQ;
  }

  get hasImportQueue() {
    return !!this.importQ;
  }

  async enqueueEmail(job: {
    to: string;
    subject: string;
    body: string;
    template?: string;
    notificationId?: string;
    deliveryId?: string;
  }) {
    if (!this.emailQ) {
      this.logger.debug(`email queue offline: ${job.subject} → ${job.to}`);
      return { queued: false as const };
    }
    const added = await this.emailQ.add('send', job, {
      ...defaultJobOptions,
      attempts: 3,
    });
    return { queued: true as const, jobId: added.id };
  }

  async enqueueNotification(job: {
    userId?: string;
    channel: string;
    title: string;
    body: string;
    meta?: Record<string, unknown>;
  }) {
    if (!this.notifyQ) {
      this.logger.debug(`notify queue offline: ${job.title}`);
      return { queued: false as const };
    }
    const added = await this.notifyQ.add('push', job, {
      ...defaultJobOptions,
    });
    return { queued: true as const, jobId: added.id };
  }

  async enqueueSearchIndex(job: {
    action: 'index' | 'remove';
    productId: string;
  }) {
    if (!this.searchQ) {
      this.logger.debug(`search queue offline: ${job.action} ${job.productId}`);
      return { queued: false as const };
    }
    // Stage 17 job names: index-product / remove-product (+ legacy action names)
    const name =
      job.action === 'remove' ? 'remove-product' : 'index-product';
    const added = await this.searchQ.add(name, job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 200,
    });
    return { queued: true as const, jobId: added.id };
  }

  async enqueueImport(job: {
    importJobId: string;
    shopId: string;
    actorId?: string;
  }) {
    if (!this.importQ) {
      this.logger.debug(
        `import queue offline: importJobId=${job.importJobId}`,
      );
      return { queued: false as const };
    }
    const added = await this.importQ.add('process-import', job, {
      ...importJobOptions,
      jobId: `import-${job.importJobId}`, // de-dupe concurrent confirms
    });
    return { queued: true as const, jobId: added.id };
  }

  async enqueueInventoryRelease() {
    if (!this.inventoryQ) {
      this.logger.debug('inventory queue offline');
      return { queued: false as const };
    }
    const added = await this.inventoryQ.add(
      'release-expired',
      {},
      { ...defaultJobOptions, attempts: 2 },
    );
    return { queued: true as const, jobId: added.id };
  }
}
