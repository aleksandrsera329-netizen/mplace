import {
  forwardRef,
  Logger,
  Module,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MerchantModule } from '../merchant/merchant.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { QUEUE_INVENTORY } from '../queue/queue.constants';
import { inventoryRepeatMs } from './queues';
import { EmailJobProcessor } from './processors/email.processor';
import { NotificationJobProcessor } from './processors/notification.processor';
import { ImportJobProcessor } from './processors/import.processor';
import { InventoryJobProcessor } from './processors/inventory.processor';

/**
 * Stage 19 — Background job workers + periodic schedules.
 * Queue registration lives in QueueModule (BullModule); processors live here.
 */
@Module({
  imports: [forwardRef(() => MerchantModule), WarehouseModule],
  providers: [
    EmailJobProcessor,
    NotificationJobProcessor,
    ImportJobProcessor,
    InventoryJobProcessor,
  ],
  exports: [
    EmailJobProcessor,
    NotificationJobProcessor,
    ImportJobProcessor,
    InventoryJobProcessor,
  ],
})
export class JobsModule implements OnModuleInit {
  private readonly logger = new Logger(JobsModule.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_INVENTORY)
    private readonly inventoryQueue?: Queue,
  ) {}

  async onModuleInit() {
    if (!this.inventoryQueue) {
      this.logger.warn(
        'inventory queue unavailable — releaseExpired scheduler not registered',
      );
      return;
    }

    // Idempotent-ish: remove old repeatable configs with same name, then add
    try {
      const existing = await this.inventoryQueue.getRepeatableJobs();
      for (const r of existing) {
        if (r.name === 'release-expired') {
          await this.inventoryQueue.removeRepeatableByKey(r.key);
        }
      }
    } catch (e) {
      this.logger.debug(
        `repeatable cleanup: ${e instanceof Error ? e.message : e}`,
      );
    }

    await this.inventoryQueue.add(
      'release-expired',
      {},
      {
        repeat: { every: inventoryRepeatMs },
        removeOnComplete: 20,
        removeOnFail: 50,
        attempts: 2,
      },
    );
    this.logger.log(
      `Scheduled inventory release-expired every ${inventoryRepeatMs / 1000}s`,
    );
  }
}
