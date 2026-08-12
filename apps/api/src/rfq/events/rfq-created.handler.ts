import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RfqCreatedEvent } from '../../common/events/rfq-created.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@EventsHandler(RfqCreatedEvent)
export class RfqCreatedHandler implements IEventHandler<RfqCreatedEvent> {
  private readonly logger = new Logger(RfqCreatedHandler.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
  ) {}

  async handle(event: RfqCreatedEvent) {
    this.logger.log(`RFQ created: ${event.rfqId} by ${event.buyerId}`);

    if (this.notificationsQueue) {
      await this.notificationsQueue.add('rfq-created-buyer', {
        rfqId: event.rfqId,
        buyerId: event.buyerId,
        title: event.title,
      });
    }

    // Confirm to buyer
    await this.notifications.create({
      userId: event.buyerId,
      type: 'RFQ_CREATED',
      title: 'RFQ создан',
      message: `Запрос «${event.title}» отправлен поставщикам`,
      data: { rfqId: event.rfqId },
      link: `/rfq/${event.rfqId}`,
      sendEmail: false,
    });

    const shopIds =
      event.shopIds?.length > 0
        ? event.shopIds
        : (
            await this.prisma.shop.findMany({
              where: { status: 'ACTIVE' },
              select: { id: true },
              take: 20,
            })
          ).map((s) => s.id);

    for (const shopId of shopIds) {
      if (this.notificationsQueue) {
        await this.notificationsQueue.add('rfq-invited-merchant', {
          rfqId: event.rfqId,
          shopId,
          title: event.title,
        });
      }
      await this.notifications.notifyShopOwners(shopId, {
        type: 'RFQ_CREATED',
        title: 'Новый RFQ',
        message: `Поступил запрос: «${event.title}»`,
        data: { rfqId: event.rfqId, shopId },
        link: `/merchant/rfq/${event.rfqId}`,
        sendEmail: true,
      });
    }
  }
}
