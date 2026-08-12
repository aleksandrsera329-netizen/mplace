import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RfqOfferStatus, RfqStatus, UserRole } from '@prisma/client';
import { OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RejectRfqResponseCommand } from './reject-rfq-response.command';

@Injectable()
@CommandHandler(RejectRfqResponseCommand)
export class RejectRfqResponseHandler
  implements ICommandHandler<RejectRfqResponseCommand>
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: RejectRfqResponseCommand) {
    const offer = await this.prisma.rfqOffer.findFirst({
      where: { id: command.offerId, rfqId: command.rfqId },
      include: { rfq: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const isBuyer = offer.rfq.buyerId === command.user.sub;
    const isAdmin =
      command.user.role === UserRole.ADMIN ||
      command.user.role === UserRole.SUPER_ADMIN;
    if (!isBuyer && !isAdmin) {
      throw new ForbiddenException('Only RFQ owner can reject offers');
    }
    if (offer.status !== RfqOfferStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject offer in status ${offer.status}`,
      );
    }
    if (
      offer.rfq.status === RfqStatus.CLOSED ||
      offer.rfq.status === RfqStatus.CANCELLED
    ) {
      throw new BadRequestException('RFQ is closed');
    }

    const updated = await this.prisma.rfqOffer.update({
      where: { id: offer.id },
      data: { status: RfqOfferStatus.REJECTED },
    });

    await this.outbox.enqueue('RfqResponseRejectedEvent', {
      responseId: offer.id,
      rfqId: command.rfqId,
      shopId: offer.shopId,
      buyerId: command.user.sub,
      reason: command.reason,
    });

    return updated;
  }
}
