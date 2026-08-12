import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RfqResponseRejectedEvent } from '../../common/events/rfq-response-rejected.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';

@Injectable()
@EventsHandler(RfqResponseRejectedEvent)
export class RfqResponseRejectedHandler
  implements IEventHandler<RfqResponseRejectedEvent>
{
  private readonly logger = new Logger(RfqResponseRejectedHandler.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
  ) {}

  async handle(event: RfqResponseRejectedEvent) {
    this.logger.log(`Offer ${event.responseId} REJECTED`);
    if (!this.notificationsQueue) return;
    await this.notificationsQueue.add('rfq-response-rejected', {
      responseId: event.responseId,
      rfqId: event.rfqId,
      shopId: event.shopId,
      reason: event.reason,
    });
  }
}
