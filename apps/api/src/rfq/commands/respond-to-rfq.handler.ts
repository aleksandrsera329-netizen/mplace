import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OutboxService } from '../../common/outbox/outbox.service';
import { RfqService } from '../rfq.service';
import { RespondToRfqCommand } from './respond-to-rfq.command';

@Injectable()
@CommandHandler(RespondToRfqCommand)
export class RespondToRfqHandler
  implements ICommandHandler<RespondToRfqCommand>
{
  constructor(
    private readonly rfq: RfqService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: RespondToRfqCommand) {
    const offer = await this.rfq.createOffer(
      command.user,
      command.rfqId,
      command.dto,
    );

    await this.outbox.enqueue('RfqResponseCreatedEvent', {
      responseId: offer.id,
      rfqId: command.rfqId,
      shopId: offer.shopId,
      merchantId: command.user.sub,
      totalCents: offer.totalCents,
    });

    return offer;
  }
}
