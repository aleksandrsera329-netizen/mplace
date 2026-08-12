import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../../auth/jwt-payload.interface';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RfqService } from '../../rfq.service';
import { AcceptRfqResponseCommand } from '../accept-rfq-response.command';
import { AcceptRfqResponseHandler } from '../accept-rfq-response.handler';

describe('AcceptRfqResponseHandler', () => {
  let handler: AcceptRfqResponseHandler;
  let rfq: { award: jest.Mock };
  let prisma: { rfqOffer: { findFirst: jest.Mock } };
  let outbox: { enqueue: jest.Mock };

  const user: JwtPayload = {
    sub: 'buyer-1',
    email: 'buyer@test.com',
    role: UserRole.CUSTOMER,
    shopId: null,
  };

  beforeEach(async () => {
    rfq = { award: jest.fn() };
    prisma = { rfqOffer: { findFirst: jest.fn() } };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        AcceptRfqResponseHandler,
        { provide: RfqService, useValue: rfq },
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    handler = module.get(AcceptRfqResponseHandler);
  });

  it('should award offer and enqueue RfqResponseAcceptedEvent', async () => {
    prisma.rfqOffer.findFirst.mockResolvedValue({
      id: 'offer-1',
      shopId: 'shop-1',
      totalCents: 30000,
    });
    const awarded = { id: 'rfq-1', status: 'AWARDED' };
    rfq.award.mockResolvedValue(awarded);

    const result = await handler.execute(
      new AcceptRfqResponseCommand(user, 'rfq-1', 'offer-1'),
    );

    expect(result).toBe(awarded);
    expect(rfq.award).toHaveBeenCalledWith('rfq-1', 'offer-1', user);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      'RfqResponseAcceptedEvent',
      expect.objectContaining({
        responseId: 'offer-1',
        rfqId: 'rfq-1',
        shopId: 'shop-1',
        buyerId: 'buyer-1',
        totalCents: 30000,
      }),
    );
  });

  it('should not enqueue if offer not found before award', async () => {
    prisma.rfqOffer.findFirst.mockResolvedValue(null);
    rfq.award.mockResolvedValue({ id: 'rfq-1' });

    await handler.execute(
      new AcceptRfqResponseCommand(user, 'rfq-1', 'missing'),
    );

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
