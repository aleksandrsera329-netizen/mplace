import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../../notifications/notifications.service';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';

/**
 * Stage 19: notifications queue worker.
 * Handles send-notification delivery + legacy job names.
 */
@Processor(QUEUE_NOTIFICATIONS)
export class NotificationJobProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationJobProcessor.name);

  constructor(
    @Optional() private readonly notifications?: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name} [${job.id}]`);

    switch (job.name) {
      case 'send-notification':
        return this.handleSendNotification(job.data);
      case 'push':
        this.logger.log(
          `[notify] user=${job.data?.userId} title=${job.data?.title}`,
        );
        return { ok: true, mode: 'log' };
      case 'order-created-customer':
      case 'order-created-merchant':
      case 'order-status-changed':
      case 'rfq-created-buyer':
      case 'rfq-invited-merchant':
      case 'rfq-new-response':
      case 'rfq-response-accepted':
      case 'rfq-awarded-buyer':
        return { ok: true, handled: job.name };
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return { ok: true, skipped: true };
    }
  }

  private async handleSendNotification(data: {
    notificationId: string;
    sendEmail?: boolean;
    sendTelegram?: boolean;
  }) {
    if (!this.notifications) {
      this.logger.warn('NotificationsService not available');
      return { ok: false };
    }
    return this.notifications.deliver(
      data.notificationId,
      data.sendEmail !== false,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Job ${job?.id} failed: ${error.message}`);
  }
}
