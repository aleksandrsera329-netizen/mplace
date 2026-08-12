import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../../auth/jwt-payload.interface';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { RfqService } from '../../rfq.service';
import { CreateRfqCommand } from '../create-rfq.command';
import { CreateRfqHandler } from '../create-rfq.handler';

describe('CreateRfqHandler', () => {
  let handler: CreateRfqHandler;
  let rfq: { create: jest.Mock };
  let outbox: { enqueue: jest.Mock };

  const user: JwtPayload = {
    sub: 'buyer-1',
    email: 'buyer@test.com',
    role: UserRole.CUSTOMER,
    shopId: null,
  };

  beforeEach(async () => {
    rfq = { create: jest.fn() };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateRfqHandler,
        { provide: RfqService, useValue: rfq },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(CreateRfqHandler);
  });

  it('should create RFQ and enqueue RfqCreatedEvent', async () => {
    const created = {
      id: 'rfq-1',
      number: 'RFQ-1',
      title: 'Need cables',
      items: [{ categoryId: 'cat-1' }],
      matches: [{ shopId: 'shop-1' }],
    };
    rfq.create.mockResolvedValue(created);

    const dto = { title: 'Need cables', items: [] } as any;
    const result = await handler.execute(new CreateRfqCommand(user, dto));

    expect(result).toBe(created);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'RfqCreatedEvent',
      expect.objectContaining({
        rfqId: 'rfq-1',
        buyerId: 'buyer-1',
        title: 'Need cables',
        categoryIds: ['cat-1'],
        shopIds: ['shop-1'],
        number: 'RFQ-1',
      }),
    );
  });
});
