import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OutboxService } from '../../common/outbox/outbox.service';
import { CreateRfqCommand } from './create-rfq.command';
import { RfqService } from '../rfq.service';

@Injectable()
@CommandHandler(CreateRfqCommand)
export class CreateRfqHandler implements ICommandHandler<CreateRfqCommand> {
  constructor(
    private readonly rfq: RfqService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(command: CreateRfqCommand) {
    const created = await this.rfq.create(command.user, command.dto);

    const categoryIds = (created.items || [])
      .map((i: { categoryId?: string | null }) => i.categoryId)
      .filter((id: string | null | undefined): id is string => !!id);

    const matchShopIds =
      (created as { matches?: { shopId: string }[] }).matches?.map(
        (m) => m.shopId,
      ) || [];

    await this.outbox.enqueue('RfqCreatedEvent', {
      rfqId: created.id,
      buyerId: command.user.sub,
      title: created.title,
      categoryIds,
      shopIds: matchShopIds,
      number: created.number,
    });

    return created;
  }
}
