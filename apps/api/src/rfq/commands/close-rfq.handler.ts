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
import { CloseRfqCommand } from './close-rfq.command';

@Injectable()
@CommandHandler(CloseRfqCommand)
export class CloseRfqHandler implements ICommandHandler<CloseRfqCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: CloseRfqCommand) {
    const rfq = await this.prisma.rfqRequest.findUnique({
      where: { id: command.rfqId },
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    const isOwner = rfq.buyerId === command.user.sub;
    const isAdmin =
      command.user.role === UserRole.ADMIN ||
      command.user.role === UserRole.SUPER_ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Only RFQ owner can close');
    }

    const closable: RfqStatus[] = [
      RfqStatus.OPEN,
      RfqStatus.MATCHED,
      RfqStatus.QUOTED,
      RfqStatus.AWARDED,
    ];
    if (!closable.includes(rfq.status)) {
      throw new BadRequestException(
        `Cannot close RFQ in status ${rfq.status}`,
      );
    }

    const closed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.rfqRequest.update({
        where: { id: command.rfqId },
        data: { status: RfqStatus.CLOSED },
      });

      await tx.rfqOffer.updateMany({
        where: { rfqId: command.rfqId, status: RfqOfferStatus.PENDING },
        data: { status: RfqOfferStatus.REJECTED },
      });

      await this.outbox.addToOutbox(tx, 'RfqClosedEvent', {
        rfqId: command.rfqId,
        buyerId: command.user.sub,
        reason: command.reason,
      });

      return updated;
    });

    return closed;
  }
}
