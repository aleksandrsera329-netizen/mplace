import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RfqClosedEvent } from '../../common/events/rfq-closed.event';
import { QUEUE_NOTIFICATIONS } from '../../queue/queue.constants';

@Injectable()
@EventsHandler(RfqClosedEvent)
export class RfqClosedHandler implements IEventHandler<RfqClosedEvent> {
  private readonly logger = new Logger(RfqClosedHandler.name);

  constructor(
    @Optional()
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationsQueue?: Queue,
  ) {}

  async handle(event: RfqClosedEvent) {
    this.logger.log(`RFQ ${event.rfqId} closed by ${event.buyerId}`);
    if (!this.notificationsQueue) return;
    await this.notificationsQueue.add('rfq-closed', {
      rfqId: event.rfqId,
      buyerId: event.buyerId,
      reason: event.reason,
    });
  }
}
