import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { QUEUE_NOTIFICATIONS } from '../../../queue/queue.constants';
import { NotificationsService } from '../../../notifications/notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * BullMQ worker for notifications queue.
 * Handles send-notification + legacy order/rfq job names.
 */
@Processor(QUEUE_NOTIFICATIONS)
export class NotificationsCqrsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsCqrsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name} [${job.id}]`);

    switch (job.name) {
      case 'send-notification':
        return this.handleSendNotification(job.data);
      case 'order-created-customer':
        return this.handleOrderCreatedCustomer(job.data);
      case 'order-created-merchant':
        return this.handleOrderCreatedMerchant(job.data);
      case 'order-status-changed':
        return this.handleOrderStatusChanged(job.data);
      case 'rfq-created-buyer':
      case 'rfq-invited-merchant':
      case 'rfq-new-response':
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

  private handleOrderCreatedCustomer(data: {
    orderId: string;
    customerId: string;
    totalCents: number;
    orderNumber?: string;
  }) {
    const num = data.orderNumber || data.orderId.slice(0, 8);
    const amount = (data.totalCents / 100).toLocaleString('ru-RU');
    this.logger.log(
      `[Customer ${data.customerId}] Order ${num} created, amount ${amount}`,
    );
    return { success: true };
  }

  private handleOrderCreatedMerchant(data: {
    orderId: string;
    shopId: string;
    orderNumber?: string;
  }) {
    this.logger.log(
      `[Merchant shop ${data.shopId}] New order ${data.orderNumber || data.orderId}`,
    );
    return { success: true };
  }

  private handleOrderStatusChanged(data: {
    orderId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string | null;
  }) {
    this.logger.log(
      `[Notification] Order ${data.orderId} status ${data.oldStatus} → ${data.newStatus}`,
    );
    return { success: true };
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
