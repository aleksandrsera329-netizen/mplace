import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../../auth/jwt-payload.interface';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { RfqService } from '../../rfq.service';
import { RespondToRfqCommand } from '../respond-to-rfq.command';
import { RespondToRfqHandler } from '../respond-to-rfq.handler';

describe('RespondToRfqHandler', () => {
  let handler: RespondToRfqHandler;
  let rfq: { createOffer: jest.Mock };
  let outbox: { enqueue: jest.Mock };

  const user: JwtPayload = {
    sub: 'merchant-1',
    email: 'm@test.com',
    role: UserRole.MERCHANT,
    shopId: 'shop-1',
  };

  beforeEach(async () => {
    rfq = { createOffer: jest.fn() };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RespondToRfqHandler,
        { provide: RfqService, useValue: rfq },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(RespondToRfqHandler);
  });

  it('should create offer and enqueue RfqResponseCreatedEvent', async () => {
    const offer = {
      id: 'offer-1',
      shopId: 'shop-1',
      totalCents: 25000,
    };
    rfq.createOffer.mockResolvedValue(offer);

    const result = await handler.execute(
      new RespondToRfqCommand(user, 'rfq-1', { items: [] } as any),
    );

    expect(result).toBe(offer);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'RfqResponseCreatedEvent',
      expect.objectContaining({
        responseId: 'offer-1',
        rfqId: 'rfq-1',
        shopId: 'shop-1',
        merchantId: 'merchant-1',
        totalCents: 25000,
      }),
    );
  });
});
