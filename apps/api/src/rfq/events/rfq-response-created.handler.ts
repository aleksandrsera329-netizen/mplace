import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RfqResponseCreatedEvent } from '../../common/events/rfq-response-created.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@EventsHandler(RfqResponseCreatedEvent)
export class RfqResponseCreatedHandler
  implements IEventHandler<RfqResponseCreatedEvent>
{
  private readonly logger = new Logger(RfqResponseCreatedHandler.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
  ) {}

  async handle(event: RfqResponseCreatedEvent) {
    this.logger.log(
      `Offer ${event.responseId} on RFQ ${event.rfqId} from shop ${event.shopId}`,
    );

    if (this.notificationsQueue) {
      await this.notificationsQueue.add('rfq-new-response', {
        rfqId: event.rfqId,
        responseId: event.responseId,
        shopId: event.shopId,
        totalCents: event.totalCents,
      });
    }

    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: event.rfqId },
      select: { id: true, title: true, buyerId: true, number: true },
    });
    if (!rfq?.buyerId) return;

    const amount = (event.totalCents / 100).toLocaleString('ru-RU');
    await this.notifications.notify({
      userId: rfq.buyerId,
      type: 'RFQ_OFFER_RECEIVED',
      title: 'Новое предложение по RFQ',
      body: `По запросу «${rfq.title}» (${rfq.number}) пришло предложение на ${amount}`,
      data: {
        rfqId: event.rfqId,
        responseId: event.responseId,
        shopId: event.shopId,
      },
      link: `/rfq/${event.rfqId}`,
    });
  }
}
