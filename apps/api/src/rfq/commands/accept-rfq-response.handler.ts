import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RfqService } from '../rfq.service';
import { AcceptRfqResponseCommand } from './accept-rfq-response.command';

@Injectable()
@CommandHandler(AcceptRfqResponseCommand)
export class AcceptRfqResponseHandler
  implements ICommandHandler<AcceptRfqResponseCommand>
{
  constructor(
    private readonly rfq: RfqService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: AcceptRfqResponseCommand) {
    const offer = await this.prisma.rfqOffer.findFirst({
      where: { id: command.offerId, rfqId: command.rfqId },
    });

    const result = await this.rfq.award(
      command.rfqId,
      command.offerId,
      command.user,
    );

    if (offer) {
      await this.outbox.enqueue('RfqResponseAcceptedEvent', {
        responseId: offer.id,
        rfqId: command.rfqId,
        shopId: offer.shopId,
        buyerId: command.user.sub,
        totalCents: offer.totalCents,
        orderId:
          result && typeof result === 'object' && 'orderId' in result
            ? (result as { orderId: string }).orderId
            : undefined,
      });
    }

    return result;
  }
}
