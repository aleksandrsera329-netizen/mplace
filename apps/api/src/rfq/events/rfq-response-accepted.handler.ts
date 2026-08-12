import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RfqResponseAcceptedEvent } from '../../common/events/rfq-response-accepted.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';

@Injectable()
@EventsHandler(RfqResponseAcceptedEvent)
export class RfqResponseAcceptedHandler
  implements IEventHandler<RfqResponseAcceptedEvent>
{
  private readonly logger = new Logger(RfqResponseAcceptedHandler.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
  ) {}

  async handle(event: RfqResponseAcceptedEvent) {
    this.logger.log(
      `Offer ${event.responseId} ACCEPTED for RFQ ${event.rfqId}`,
    );
    if (!this.notificationsQueue) return;
    await this.notificationsQueue.add('rfq-response-accepted', {
      responseId: event.responseId,
      rfqId: event.rfqId,
      shopId: event.shopId,
      totalCents: event.totalCents,
    });
    await this.notificationsQueue.add('rfq-awarded-buyer', {
      rfqId: event.rfqId,
      responseId: event.responseId,
    });
  }
}
